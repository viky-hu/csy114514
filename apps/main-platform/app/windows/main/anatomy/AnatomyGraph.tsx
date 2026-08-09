"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  DatabaseZap,
  Globe2,
  MailCheck,
  MailSearch,
  PlayCircle,
  ShieldQuestion,
} from "lucide-react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import { writeEvaluationHandoff } from "../../shared/evaluation-handoff";
import type {
  AnatomyInput,
  AnatomyMode,
  AnatomyPath,
  AnatomyPathStatus,
  AnatomyViewModel,
} from "./anatomy-data";
import { DEFAULT_ANATOMY_AGENT_ID, anatomyPreviewViewModel } from "./anatomy-fixtures";
import {
  ANATOMY_ACTIVE_NODE_DURATION,
  ANATOMY_ACTIVE_NODE_Y,
  ANATOMY_PHASES,
  ANATOMY_PHASE_LABEL_Y,
  ANATOMY_PHASE_RAIL_PATH,
  ANATOMY_GRAPH_VIEWBOX,
  ANATOMY_LAYOUT_BY_NODE_ID,
  buildAnatomyRouteSegments,
  createClockwiseRoundedRectPath,
  getActiveAnatomyRouteNodeIds,
} from "./anatomy-graph-layout";
import type { AnatomyGraphNodeLayout } from "./anatomy-graph-layout";
import {
  defaultAnatomyRepository,
  type AnatomyRepository,
  type AnatomyRepositoryResult,
} from "./anatomy-repository";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type AttackGraphWorkspaceProps = {
  agentId?: string;
  onNavigate: (key: "run") => void;
  repository?: AnatomyRepository;
};

type DrawSVGTweenVars = gsap.TweenVars & {
  drawSVG?: number | string;
};

type NodeHitboxStyleVars = CSSProperties &
  Record<"--node-height" | "--node-left" | "--node-top" | "--node-width", string>;

type CanonicalNode = {
  caption: string;
  description: string;
  displayName: string;
  id: string;
  labels: string[];
  layout: AnatomyGraphNodeLayout;
  name: string;
  nodeId: string;
  nodeType: string;
};

const NODE_ICONS: Record<AnatomyGraphNodeLayout["role"], LucideIcon> = {
  agent: Bot,
  data: MailSearch,
  memory: DatabaseZap,
  source: Globe2,
  tool: MailCheck,
};

const STATUS_LABELS: Record<AnatomyPathStatus, string> = {
  potential: "待验证",
  verified: "已验证",
};

const STATUS_COPY: Record<AnatomyPathStatus, string> = {
  potential: "来自攻击图谱 risk_path_ids，表示结构命中但尚未完成测试。",
  verified: "来自 evaluation report findings，已经有事件证据命中。",
};

const NODE_DISPLAY_COPY: Record<string, { caption: string; displayName: string }> = {
  "agent-first-pass": {
    caption: "首次处理不可信内容",
    displayName: "Agent 解析",
  },
  "agent-recall": {
    caption: "任务中再次读取上下文",
    displayName: "二次唤起",
  },
  "data-email": {
    caption: "敏感业务内容",
    displayName: "邮件数据",
  },
  "memory-persistent": {
    caption: "跨任务保留指令",
    displayName: "长期记忆",
  },
  "source-browser": {
    caption: "不可信网页输入",
    displayName: "恶意网页",
  },
  "tool-email-read": {
    caption: "读取收件箱",
    displayName: "读取邮件",
  },
  "tool-email-send": {
    caption: "对外发送动作",
    displayName: "发送邮件",
  },
};

function getNodeHitboxStyle(layout: AnatomyGraphNodeLayout): NodeHitboxStyleVars {
  return {
    "--node-height": `${(layout.height / ANATOMY_GRAPH_VIEWBOX.height) * 100}%`,
    "--node-left": `${
      ((layout.x - layout.width / 2) / ANATOMY_GRAPH_VIEWBOX.width) * 100
    }%`,
    "--node-top": `${
      ((layout.y - layout.height / 2) / ANATOMY_GRAPH_VIEWBOX.height) * 100
    }%`,
    "--node-width": `${(layout.width / ANATOMY_GRAPH_VIEWBOX.width) * 100}%`,
  };
}

function isReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function findGraphNode(
  viewModel: AnatomyViewModel,
  layoutId: string,
): CanonicalNode {
  const nodes = viewModel.graph.nodes;
  const layout = ANATOMY_LAYOUT_BY_NODE_ID[layoutId];
  const matchers: Record<string, (node: AnatomyInput["attackGraph"]["nodes"][number]) => boolean> = {
    "agent-first-pass": (node) => node.node_type === "AGENT",
    "agent-recall": (node) => node.node_type === "AGENT",
    "data-email": (node) => node.node_type === "DATA",
    "memory-persistent": (node) => node.node_type === "MEMORY",
    "source-browser": (node) => node.node_type === "SOURCE",
    "tool-email-read": (node) => node.metadata.name === "email.read",
    "tool-email-send": (node) => node.metadata.name === "email.send",
  };
  const node = nodes.find(matchers[layoutId]);
  const displayCopy = NODE_DISPLAY_COPY[layoutId];

  return {
    caption: displayCopy?.caption ?? node?.labels.join(" / ") ?? "",
    description: node?.metadata.description ?? "",
    displayName: displayCopy?.displayName ?? node?.metadata.name ?? layoutId,
    id: layoutId,
    labels: node?.labels ?? [],
    layout,
    name: node?.metadata.name ?? layoutId,
    nodeId: node?.node_id ?? layoutId,
    nodeType: node?.node_type ?? layout.role.toUpperCase(),
  };
}

function selectAnatomyPath(
  viewModel: AnatomyViewModel,
  selectedPathId: string,
): AnatomyViewModel {
  if (viewModel.selectedPathId === selectedPathId) {
    return viewModel;
  }

  return {
    ...viewModel,
    selectedPath:
      viewModel.paths.find((path) => path.id === selectedPathId) ??
      viewModel.selectedPath,
    selectedPathId,
  };
}

function getActiveNodeIds(selectedPath: AnatomyPath | null) {
  return new Set(
    (selectedPath?.steps ?? []).map((step, index) => {
      if (step.stage === "ingress") {
        return "source-browser";
      }

      if (step.stage === "first_pass") {
        return "agent-first-pass";
      }

      if (step.stage === "recall") {
        return "agent-recall";
      }

      if (step.stage === "persistence") {
        return "memory-persistent";
      }

      if (step.stage === "sensitive_read") {
        return "data-email";
      }

      if (step.label === "email.read") {
        return "tool-email-read";
      }

      if (step.stage === "sink") {
        return "tool-email-send";
      }

      return `${step.id}-${index}`;
    }),
  );
}

function getVisibleActiveNodeIds(selectedPath: AnatomyPath | null) {
  const pathId = selectedPath?.id;
  const routeNodeIds = pathId ? getActiveAnatomyRouteNodeIds(pathId) : new Set<string>();

  return new Set([...getActiveNodeIds(selectedPath), ...routeNodeIds]);
}

function AnatomyInspector({
  dataSourceLabel,
  errorMessage,
  mode,
  onVerify,
  path,
  selectedNode,
}: {
  dataSourceLabel: string;
  errorMessage: string | null;
  mode: AnatomyMode;
  onVerify: () => void;
  path: AnatomyPath | null;
  selectedNode: CanonicalNode | null;
}) {
  if (!path) {
    return (
      <aside className="anatomy-inspector" aria-label="攻击路径详情">
        <div className="anatomy-empty-state">
          <ShieldQuestion size={22} aria-hidden="true" />
          <h2>未接入 Agent</h2>
          <p>当前没有可分析的真实图谱。页面会保留预览图谱，方便先确认样式与交互。</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="anatomy-inspector" aria-label={`${path.id} 攻击路径详情`}>
      <div className="anatomy-inspector-heading">
        <span className={`anatomy-status-badge is-${path.status}`}>
          {STATUS_LABELS[path.status]}
        </span>
        <h2>{path.id} · {path.name}</h2>
        <p>{path.story}</p>
      </div>

      <section className="anatomy-detail-block">
        <span>数据来源</span>
        <p>{dataSourceLabel}</p>
        {errorMessage ? <p className="anatomy-source-error">{errorMessage}</p> : null}
      </section>

      <section className="anatomy-detail-block">
        <span>节点详情</span>
        {selectedNode ? (
          <>
            <dl className="anatomy-node-detail-list">
              <div>
                <dt>节点</dt>
                <dd>{selectedNode.displayName}</dd>
              </div>
              <div>
                <dt>原始 ID</dt>
                <dd>{selectedNode.nodeId}</dd>
              </div>
              <div>
                <dt>类型</dt>
                <dd>{selectedNode.nodeType}</dd>
              </div>
              <div>
                <dt>名称</dt>
                <dd>{selectedNode.name}</dd>
              </div>
            </dl>
            <div className="anatomy-label-chip-row" aria-label="安全标签">
              {selectedNode.labels.length > 0 ? (
                selectedNode.labels.map((label) => (
                  <span key={label} className="anatomy-label-chip">
                    {label}
                  </span>
                ))
              ) : (
                <span className="anatomy-label-chip is-empty">无安全标签</span>
              )}
            </div>
            <p>{selectedNode.description || "该节点暂无 description 元数据。"}</p>
          </>
        ) : (
          <p>选择图中的节点后查看节点类型、原始 ID、名称和安全标签。</p>
        )}
      </section>

      <section className="anatomy-detail-block">
        <span>如何验证</span>
        <p>{path.verification.howToVerify}</p>
        <dl className="anatomy-verify-meta">
          <div>
            <dt>TestCase</dt>
            <dd>{path.verification.testCaseId ?? "暂无可执行用例"}</dd>
          </div>
          <div>
            <dt>AttackSeed</dt>
            <dd>{path.verification.seedIds.join(" / ") || "未绑定"}</dd>
          </div>
        </dl>
        {path.verification.testCaseName ? (
          <p className="anatomy-verify-note">{path.verification.testCaseName}</p>
        ) : null}
        <button
          className="anatomy-verify-button"
          disabled={mode === "preview" || !path.testCaseId}
          onClick={onVerify}
          type="button"
        >
          <PlayCircle size={15} aria-hidden="true" />
          {mode === "preview"
            ? "预览态：接入后可验证"
            : path.testCaseId
              ? `验证 ${path.testCaseId}`
              : "暂无可执行用例"}
        </button>
      </section>

      <section className="anatomy-detail-block">
        <span>风险解释</span>
        <p>{STATUS_COPY[path.status]}</p>
        <p>{path.description}</p>
        <dl className="anatomy-risk-meta">
          <div>
            <dt>风险类型</dt>
            <dd>{path.riskType}</dd>
          </div>
          <div>
            <dt>严重等级</dt>
            <dd>{path.severity}</dd>
          </div>
          <div>
            <dt>攻击目标</dt>
            <dd>{path.attackGoal}</dd>
          </div>
          <div>
            <dt>成功条件</dt>
            <dd>{path.successCondition}</dd>
          </div>
        </dl>
      </section>

      <section className="anatomy-detail-block">
        <span>路径步骤</span>
        <ol className="anatomy-step-list">
          {path.steps.map((step, index) => (
            <li key={`${step.id}-${index}`}>
              <span className="anatomy-stage-pill">{step.stageLabel}</span>
              <strong>{step.label}</strong>
              <em>{step.nodeType}</em>
            </li>
          ))}
        </ol>
      </section>

      <section className="anatomy-detail-block">
        <span>报告证据</span>
        {path.evidence.length > 0 ? (
          <ul className="anatomy-evidence-list">
            {path.evidence.map((item) => (
              <li key={item.eventId}>
                <strong>{item.eventId}</strong>
                <p>{item.description}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>暂无 report finding 证据，当前只表示图谱结构存在潜在路径。</p>
        )}
      </section>
    </aside>
  );
}

export function AttackGraphWorkspace({
  agentId = DEFAULT_ANATOMY_AGENT_ID,
  onNavigate,
  repository = defaultAnatomyRepository,
}: AttackGraphWorkspaceProps) {
  const rootRef = useRef<HTMLElement>(null);
  const [selectedPathId, setSelectedPathId] = useState("R4");
  const [selectedNodeId, setSelectedNodeId] = useState("tool-email-send");
  const [repositoryResult, setRepositoryResult] = useState<AnatomyRepositoryResult>({
    source: "mock",
    viewModel: anatomyPreviewViewModel,
  });
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const viewModel = useMemo(
    () => selectAnatomyPath(repositoryResult.viewModel, selectedPathId),
    [repositoryResult.viewModel, selectedPathId],
  );
  const dataSourceLabel =
    repositoryResult.source === "api"
      ? "API 图谱"
      : repositoryResult.errorMessage
        ? "接口不可用，当前保留 Fixture 预览"
        : "Fixture 预览";
  const routeSegments = useMemo(() => buildAnatomyRouteSegments(), []);
  const activeRouteIds = useMemo(
    () =>
      new Set(
        routeSegments
          .filter((segment) => segment.pathIds.includes(viewModel.selectedPathId))
          .map((segment) => segment.id),
      ),
    [routeSegments, viewModel.selectedPathId],
  );
  const activeNodeIds = useMemo(
    () => getVisibleActiveNodeIds(viewModel.selectedPath),
    [viewModel.selectedPath],
  );
  const graphNodes = useMemo(
    () =>
      [
        "source-browser",
        "agent-first-pass",
        "memory-persistent",
        "agent-recall",
        "tool-email-send",
        "memory-persistent",
        "data-email",
        "tool-email-read",
      ]
        .filter((layoutId, index, all) => all.indexOf(layoutId) === index)
        .map((layoutId) => findGraphNode(viewModel, layoutId)),
    [viewModel],
  );
  const selectedNode = useMemo(
    () =>
      graphNodes.find((node) => node.id === selectedNodeId) ??
      graphNodes[0] ??
      null,
    [graphNodes, selectedNodeId],
  );

  useEffect(() => {
    let ignore = false;

    setIsLoadingGraph(true);
    repository
      .load({ agentId, selectedPathId })
      .then((result) => {
        if (!ignore) {
          setRepositoryResult(result);
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoadingGraph(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [agentId, repository, selectedPathId]);

  const verifySelectedPath = useCallback(() => {
    const path = viewModel.selectedPath;

    if (viewModel.mode !== "live" || !path?.testCaseId) {
      return;
    }

    writeEvaluationHandoff({
      agentId: viewModel.agent.id,
      riskPatternId: path.id,
      testCaseId: path.testCaseId,
    });
    onNavigate("run");
  }, [onNavigate, viewModel]);

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      const matchMedia = gsap.matchMedia();

      matchMedia.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          const reduceMotion = Boolean(context.conditions?.reduceMotion);
          const revealTargets = gsap.utils.toArray<HTMLElement>(
            ".anatomy-reveal",
            root,
          );
          const routePaths = gsap.utils.toArray<SVGPathElement>(
            ".anatomy-route-stroke",
            root,
          );
          const nodes = gsap.utils.toArray<SVGGElement>(".anatomy-svg-node", root);

          if (reduceMotion) {
            gsap.set(revealTargets, { autoAlpha: 1, y: 0 });
            gsap.set(nodes, { autoAlpha: 1, y: 0 });
            gsap.set(routePaths, { drawSVG: "0% 100%" } as DrawSVGTweenVars);

            return;
          }

          gsap.set(revealTargets, { autoAlpha: 0, y: 14 });
          gsap.set(routePaths, { drawSVG: "0% 0%" } as DrawSVGTweenVars);
          gsap.set(nodes, {
            autoAlpha: 0,
            scale: 0.98,
            transformOrigin: "center center",
            y: 8,
          });

          const timeline = gsap.timeline({
            defaults: { ease: LINE_DRAW_EASE },
          });

          timeline
            .to(revealTargets, {
              autoAlpha: 1,
              duration: 0.48,
              stagger: 0.055,
              y: 0,
            })
            .to(
              routePaths,
              {
                drawSVG: "0% 100%",
                duration: 0.62,
                stagger: 0.08,
              } as DrawSVGTweenVars,
              "<0.1",
            )
            .to(
              nodes,
              {
                autoAlpha: 1,
                duration: 0.36,
                scale: 1,
                stagger: 0.035,
                y: 0,
              },
              "<0.16",
            );

          return () => {
            timeline.kill();
          };
        },
      );

      return () => {
        matchMedia.revert();
      };
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      const root = rootRef.current;

      if (!root) {
        return;
      }

      const reduceMotion = isReducedMotion();
      const activeRoutes = gsap.utils.toArray<SVGPathElement>(
        ".anatomy-route-stroke.is-active",
        root,
      );
      const activeNodes = gsap.utils.toArray<SVGGElement>(
        ".anatomy-svg-node.is-active",
        root,
      );
      const nodes = gsap.utils.toArray<SVGGElement>(".anatomy-svg-node", root);

      gsap.to(nodes, {
        duration: reduceMotion ? 0 : 0.2,
        ease: "power2.out",
        overwrite: "auto",
        scale: 1,
        y: 0,
      });
      gsap.to(activeNodes, {
        duration: reduceMotion ? 0 : ANATOMY_ACTIVE_NODE_DURATION,
        ease: "power2.out",
        overwrite: "auto",
        scale: 1,
        y: ANATOMY_ACTIVE_NODE_Y,
      });

      if (reduceMotion) {
        gsap.set(activeRoutes, { drawSVG: "0% 100%" } as DrawSVGTweenVars);
      } else {
        gsap.fromTo(
          activeRoutes,
          { drawSVG: "0% 0%" } as DrawSVGTweenVars,
          {
            drawSVG: "0% 100%",
            duration: 0.46,
            ease: "power2.inOut",
            overwrite: "auto",
          } as DrawSVGTweenVars,
        );
      }
    },
    {
      dependencies: [viewModel.selectedPathId],
      revertOnUpdate: false,
      scope: rootRef,
    },
  );

  return (
    <section ref={rootRef} className="anatomy-page" aria-label="攻击图谱工作台">
      <header className="anatomy-header anatomy-reveal">
        <div className="anatomy-header-copy">
          <div className="anatomy-heading-line">
            <span className="overview-kicker">攻击图谱</span>
            <span className="anatomy-inline-badge">
              {isLoadingGraph ? "读取图谱" : dataSourceLabel}
            </span>
          </div>
          <h1>{viewModel.agent.name} 风险路径工作台</h1>
          <p>
            从入口到外发动作观察风险如何传播；默认聚焦 R4 持久间接提示注入，
            并只把 report finding 作为已验证依据。
          </p>
        </div>
      </header>

      <div className="anatomy-body">
        <div className="anatomy-graph-column anatomy-reveal">
          <div className="anatomy-map">
            <div className="anatomy-map-stage">
            <svg
              className="anatomy-svg"
              role="img"
              aria-label="CorpMate 攻击图谱：R4 从恶意网页进入，写入长期记忆，再二次唤起并触发邮件发送"
              viewBox={`0 0 ${ANATOMY_GRAPH_VIEWBOX.width} ${ANATOMY_GRAPH_VIEWBOX.height}`}
            >
              <defs>
                <linearGradient id="anatomy-route-stroke" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#3152f4" stopOpacity="0.22" />
                  <stop offset="38%" stopColor="#4f7cff" stopOpacity="0.9" />
                  <stop offset="72%" stopColor="#7c3aed" stopOpacity="0.94" />
                  <stop offset="100%" stopColor="#b45cff" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient id="anatomy-verified-stroke" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor="#3152f4" stopOpacity="0.48" />
                  <stop offset="55%" stopColor="#7c3aed" stopOpacity="1" />
                  <stop offset="100%" stopColor="#f0447a" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <path
                className="anatomy-phase-rail"
                d={ANATOMY_PHASE_RAIL_PATH}
                fill="none"
              />
              {ANATOMY_PHASES.map((phase) => (
                <g
                  key={phase.id}
                  className={`anatomy-phase is-${phase.id}`}
                  transform={`translate(${phase.x}, ${ANATOMY_PHASE_LABEL_Y})`}
                >
                  <text className="anatomy-column-label" textAnchor="middle" x={0} y={0}>
                    {phase.label}
                  </text>
                  <text className="anatomy-column-title" textAnchor="middle" x={0} y={24}>
                    {phase.title}
                  </text>
                  <text
                    className="anatomy-column-subtitle"
                    textAnchor="middle"
                    x={0}
                    y={45}
                  >
                    {phase.subtitle}
                  </text>
                </g>
              ))}
              <g className="anatomy-routes" aria-hidden="true">
                {routeSegments.map((segment) => (
                  <path
                    key={segment.id}
                    className={`anatomy-route-stroke ${
                      activeRouteIds.has(segment.id) ? "is-active" : ""
                    } is-${viewModel.selectedPath?.status ?? "potential"}`}
                    d={segment.d}
                    data-path-ids={segment.pathIds.join(" ")}
                    fill="none"
                    pathLength={1}
                    stroke={
                      viewModel.selectedPath?.status === "verified" &&
                      activeRouteIds.has(segment.id)
                        ? "url(#anatomy-verified-stroke)"
                        : "url(#anatomy-route-stroke)"
                    }
                  />
                ))}
              </g>
              <g className="anatomy-nodes">
                {graphNodes.map((node) => {
                  const Icon = NODE_ICONS[node.layout.role];
                  const rectPath = createClockwiseRoundedRectPath(node.layout);

                  return (
                    <g
                      key={node.id}
                      className={`anatomy-svg-node is-${node.layout.role} ${
                        activeNodeIds.has(node.id) ? "is-active" : ""
                      }`}
                      data-node-id={node.id}
                    >
                      <path className="anatomy-node-surface" d={rectPath} />
                      <path className="anatomy-node-outline" d={rectPath} />
                      <Icon
                        aria-hidden="true"
                        className="anatomy-node-icon"
                        height={24}
                        width={24}
                        x={node.layout.x - 12}
                        y={node.layout.y - 34}
                        strokeWidth={1.65}
                      />
                      <text
                        className="anatomy-node-label"
                        x={node.layout.x}
                        y={node.layout.y + 14}
                        textAnchor="middle"
                      >
                        {node.displayName}
                      </text>
                      <text
                        className="anatomy-node-caption"
                        x={node.layout.x}
                        y={node.layout.y + 34}
                        textAnchor="middle"
                      >
                        {node.caption || node.nodeType}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            <div className="anatomy-node-hitbox-layer" aria-hidden="false">
              {graphNodes.map((node) => (
                <button
                  key={`${node.id}-hitbox`}
                  aria-label={`${node.displayName} 节点`}
                  className="anatomy-node-hitbox"
                  data-selected={node.id === selectedNode?.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  onFocus={() => setSelectedNodeId(node.id)}
                  style={getNodeHitboxStyle(node.layout)}
                  title={`${node.name}${node.description ? `：${node.description}` : ""}`}
                  type="button"
                />
              ))}
            </div>
          </div>
          </div>

          <div className="anatomy-path-list" aria-label="风险路径筛选">
            {viewModel.paths.map((path) => (
              <button
                key={path.id}
                className={`anatomy-path-card is-${path.status}`}
                data-active={path.id === viewModel.selectedPathId}
                onClick={() => setSelectedPathId(path.id)}
                type="button"
              >
                <span>{path.id}</span>
                <strong>{path.name}</strong>
                <em>{STATUS_LABELS[path.status]}</em>
              </button>
            ))}
          </div>

        </div>

        <div className="anatomy-side anatomy-reveal">
          <AnatomyInspector
            dataSourceLabel={dataSourceLabel}
            errorMessage={repositoryResult.errorMessage ?? null}
            mode={viewModel.mode}
            onVerify={verifySelectedPath}
            path={viewModel.selectedPath}
            selectedNode={selectedNode}
          />
        </div>
      </div>
    </section>
  );
}
