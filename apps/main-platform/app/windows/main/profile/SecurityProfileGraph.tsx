"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import {
  Bot,
  Database,
  Fingerprint,
  Globe2,
  KeyRound,
  Mail,
  MailCheck,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import { createClockwiseRoundedRectPath } from "../shared/graph-svg-primitives.ts";
import {
  useFrozenGraphInlineSize,
  type SidebarContentMetrics,
} from "../shared/useFrozenGraphInlineSize";
import {
  PROFILE_COLUMNS,
  PROFILE_COLUMN_INFO_Y,
  PROFILE_GRAPH_BOUNDARY,
  PROFILE_GRAPH_VIEWBOX,
  PROFILE_LAYOUT_BY_NODE_ID,
  buildProfileRouteSegments,
  findProfileHoverColumnId,
  profileHoverBands,
} from "./security-profile-graph-layout";
import type {
  SecurityProfileColumnId,
  SecurityProfileNode,
  SecurityProfileViewModel,
} from "./security-profile-data";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type SecurityProfileGraphProps = {
  isGraphFrozen: boolean;
  sidebarContentMetrics: SidebarContentMetrics;
  viewModel: SecurityProfileViewModel;
};

type DrawSVGTweenVars = gsap.TweenVars & {
  drawSVG?: number | string;
};

type ProfileHotZoneStyleVars = CSSProperties &
  Record<
    | "--profile-hot-height"
    | "--profile-hot-left"
    | "--profile-hot-top"
    | "--profile-hot-width",
    string
  >;

type ProfileNodeOverlayStyleVars = CSSProperties &
  Record<"--node-height" | "--node-left" | "--node-top" | "--node-width", string>;

const PROFILE_BOUNDARY_CLIP_ID = "security-profile-boundary-clip";
const PROFILE_HOVER_NODE_DURATION = 0.26;
const PROFILE_HOVER_NODE_SCALE_X = 1;
const PROFILE_HOVER_NODE_SCALE_Y = 1.035;
const PROFILE_HOVER_NODE_Y = -5;
const PROFILE_COLLAPSED_GRAPH_GAP = 16;
const PROFILE_COMPANION_MIN_INLINE_SIZE = 270;
const PROFILE_STACK_INLINE_SIZE = 920;

const PERMISSION_LABELS: Record<string, string> = {
  ALLOW: "允许",
  CONFIRM: "需确认",
  DENY: "禁止",
};

const NODE_KIND_LABELS: Record<SecurityProfileNode["kind"], string> = {
  agent: "画像主体",
  data: "数据边界",
  memory: "记忆资产",
  source: "外部来源",
  tool: "工具权限",
};

const NODE_ICONS: Record<SecurityProfileNode["kind"], LucideIcon> = {
  agent: Bot,
  data: Mail,
  memory: Database,
  source: Globe2,
  tool: MailCheck,
};

function getProfileFallbackGraphInlineSize(openInlineSize: number) {
  if (openInlineSize <= PROFILE_STACK_INLINE_SIZE) {
    return openInlineSize;
  }

  const availableInlineSize = Math.max(
    openInlineSize - PROFILE_COLLAPSED_GRAPH_GAP,
    0,
  );
  const inspectorInlineSize = Math.max(
    PROFILE_COMPANION_MIN_INLINE_SIZE,
    (availableInlineSize * 0.36) / 1.36,
  );

  return Math.max(availableInlineSize - inspectorInlineSize, 0);
}

function getNodeClassName(
  node: SecurityProfileNode,
  activeColumnId: SecurityProfileColumnId | null,
  selectedNodeId: string,
) {
  const classes = [
    "security-profile-svg-node",
    `is-${node.kind}`,
    node.columnId === activeColumnId ? "is-active" : "",
    node.id === selectedNodeId ? "is-selected" : "",
    node.permission ? `has-${node.permission.toLowerCase()}` : "",
    ...node.labels.map((label) => `has-${label.toLowerCase()}`),
  ];

  return classes.filter(Boolean).join(" ");
}

function getProfileHotZoneStyle(
  band: (typeof profileHoverBands)[number],
): ProfileHotZoneStyleVars {
  return {
    "--profile-hot-height": `${
      (PROFILE_GRAPH_BOUNDARY.height / PROFILE_GRAPH_VIEWBOX.height) * 100
    }%`,
    "--profile-hot-left": `${(band.xStart / PROFILE_GRAPH_VIEWBOX.width) * 100}%`,
    "--profile-hot-top": `${
      (PROFILE_GRAPH_BOUNDARY.y / PROFILE_GRAPH_VIEWBOX.height) * 100
    }%`,
    "--profile-hot-width": `${
      ((band.xEnd - band.xStart) / PROFILE_GRAPH_VIEWBOX.width) * 100
    }%`,
  };
}

function getProfileNodeOverlayStyle(
  layout: (typeof PROFILE_LAYOUT_BY_NODE_ID)[string],
): ProfileNodeOverlayStyleVars {
  return {
    "--node-height": `${(layout.height / PROFILE_GRAPH_VIEWBOX.height) * 100}%`,
    "--node-left": `${
      ((layout.x - layout.width / 2) / PROFILE_GRAPH_VIEWBOX.width) * 100
    }%`,
    "--node-top": `${
      ((layout.y - layout.height / 2) / PROFILE_GRAPH_VIEWBOX.height) * 100
    }%`,
    "--node-width": `${(layout.width / PROFILE_GRAPH_VIEWBOX.width) * 100}%`,
  };
}

function isReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function SecurityProfileInspector({ node }: { node: SecurityProfileNode }) {
  const Icon =
    node.kind === "agent"
      ? Bot
      : node.kind === "memory"
        ? Database
        : node.kind === "tool"
          ? KeyRound
          : node.kind === "data"
            ? Mail
            : ShieldAlert;

  return (
    <aside className="security-profile-inspector" aria-label="节点详情">
      <div className="security-profile-inspector-heading">
        <span className="security-profile-inspector-icon">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div>
          <span>{NODE_KIND_LABELS[node.kind]}</span>
          <h2>{node.label}</h2>
        </div>
      </div>

      <p>{node.detail}</p>

      <dl className="security-profile-meta-list">
        {node.meta.map((item) => (
          <div key={`${item.label}-${item.value}`}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
        {node.permission ? (
          <div>
            <dt>调用策略</dt>
            <dd>{PERMISSION_LABELS[node.permission] ?? node.permission}</dd>
          </div>
        ) : null}
      </dl>

      <div className="security-profile-evidence">
        <span>画像依据</span>
        <ul>
          {node.evidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

export function SecurityProfileGraph({
  isGraphFrozen,
  sidebarContentMetrics,
  viewModel,
}: SecurityProfileGraphProps) {
  const rootRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const activeColumnRef = useRef<SecurityProfileColumnId | null>(null);
  const animatedColumnRef = useRef<SecurityProfileColumnId | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(viewModel.agent.id);
  const [hoverColumnId, setHoverColumnId] =
    useState<SecurityProfileColumnId | null>(null);
  const graphFreeze = useFrozenGraphInlineSize({
    collapsedContentInlineSize: sidebarContentMetrics.collapsedInlineSize,
    fallbackOpenInlineSize: getProfileFallbackGraphInlineSize(
      sidebarContentMetrics.openInlineSize,
    ),
    gap: PROFILE_COLLAPSED_GRAPH_GAP,
    graphRef: mapRef,
    isGraphFrozen,
    minCompanionInlineSize: PROFILE_COMPANION_MIN_INLINE_SIZE,
    shouldStack:
      sidebarContentMetrics.openInlineSize <= PROFILE_STACK_INLINE_SIZE,
  });

  const nodesById = useMemo(
    () => new Map(viewModel.nodes.map((node) => [node.id, node])),
    [viewModel.nodes],
  );
  const selectedNode = nodesById.get(selectedNodeId) ?? viewModel.agent;
  const activeColumnId = hoverColumnId;
  const routeSegments = useMemo(() => buildProfileRouteSegments(), []);
  const activeRouteIds = useMemo(() => {
    if (!activeColumnId) {
      return new Set<string>();
    }

    const activeColumns = new Set([activeColumnId]);

    return new Set(
      routeSegments
        .filter((segment) => {
          const source = nodesById.get(segment.sourceNodeId);
          const target = nodesById.get(segment.targetNodeId);

          return (
            (source && activeColumns.has(source.columnId)) ||
            (target && activeColumns.has(target.columnId))
          );
        })
        .map((segment) => segment.id),
    );
  }, [activeColumnId, nodesById, routeSegments]);

  const activateColumn = useCallback((nextColumnId: SecurityProfileColumnId | null) => {
    if (activeColumnRef.current === nextColumnId) {
      return;
    }

    activeColumnRef.current = nextColumnId;
    setHoverColumnId(nextColumnId);
  }, []);

  const setActiveColumnFromClientX = useCallback(
    (clientX: number) => {
      const graphRoot = graphRef.current;

      if (!graphRoot) {
        return;
      }

      const bounds = graphRoot.getBoundingClientRect();
      const viewBoxX =
        ((clientX - bounds.left) / bounds.width) * PROFILE_GRAPH_VIEWBOX.width;

      activateColumn(findProfileHoverColumnId(viewBoxX));
    },
    [activateColumn],
  );

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
          const boundary = root.querySelector<SVGRectElement>(
            ".security-profile-map-boundary",
          );
          const columnBands = gsap.utils.toArray<SVGRectElement>(
            ".security-profile-column-band",
            root,
          );
          const columnInfos = gsap.utils.toArray<SVGGElement>(
            ".security-profile-column-info",
            root,
          );
          const routePaths = gsap.utils.toArray<SVGPathElement>(
            ".security-profile-route",
            root,
          );
          const nodeGroups = gsap.utils.toArray<SVGGElement>(
            ".security-profile-svg-node",
            root,
          );
          const hoverOutlines = gsap.utils.toArray<SVGPathElement>(
            ".security-profile-hover-outline",
            root,
          );
          const hotZones = gsap.utils.toArray<HTMLElement>(
            ".security-profile-hot-zone",
            root,
          );
          const pageRevealTargets = gsap.utils.toArray<HTMLElement>(
            ".security-profile-reveal",
            root,
          );
          const boundaryTargets = boundary ? [boundary] : [];

          gsap.set(hotZones, {
            "--profile-hot-rail-alpha": 0,
            autoAlpha: 0,
          });
          gsap.set(hoverOutlines, {
            drawSVG: "0% 0%",
          } as DrawSVGTweenVars);

          if (reduceMotion) {
            gsap.set(pageRevealTargets, { autoAlpha: 1, y: 0 });
            gsap.set(
              [...boundaryTargets, ...columnBands, ...columnInfos, ...nodeGroups],
              {
                autoAlpha: 1,
                scaleX: 1,
                scaleY: 1,
                y: 0,
              },
            );
            gsap.set(routePaths, { drawSVG: "0% 100%" } as DrawSVGTweenVars);

            return;
          }

          gsap.set(boundaryTargets, { autoAlpha: 0 });
          gsap.set(columnBands, { autoAlpha: 0 });
          gsap.set(columnInfos, { autoAlpha: 0, y: -2 });
          gsap.set(routePaths, { drawSVG: "0% 0%" } as DrawSVGTweenVars);
          gsap.set(nodeGroups, {
            autoAlpha: 0,
            transformOrigin: "center center",
            scaleX: 0.98,
            scaleY: 0.98,
            y: 8,
          });

          const timeline = gsap.timeline({
            defaults: { ease: LINE_DRAW_EASE },
          });

          timeline
            .fromTo(
              pageRevealTargets,
              { autoAlpha: 0, y: 14 },
              {
                autoAlpha: 1,
                duration: 0.56,
                stagger: 0.06,
                y: 0,
              },
            )
            .to(boundaryTargets, {
              autoAlpha: 1,
              duration: 0.28,
            }, "<0.1")
            .to(
              columnBands,
              {
                autoAlpha: 1,
                duration: 0.44,
                stagger: 0.07,
              },
              "<0.04",
            )
            .to(
              columnInfos,
              {
                autoAlpha: 1,
                duration: 0.32,
                stagger: 0.06,
                y: 0,
              },
              "<0.08",
            )
            .to(
              routePaths,
              {
                drawSVG: "0% 100%",
                duration: 0.62,
                stagger: 0.1,
              } as DrawSVGTweenVars,
              "<0.12",
            )
            .to(
              nodeGroups,
              {
                autoAlpha: 1,
                duration: 0.42,
                scaleX: 1,
                scaleY: 1,
                stagger: 0.045,
                y: 0,
              },
              "<0.18",
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
      const previousColumnId = animatedColumnRef.current;

      if (!root || previousColumnId === activeColumnId) {
        return;
      }

      const reduceMotion = isReducedMotion();
      const hotZones = gsap.utils.toArray<HTMLElement>(
        ".security-profile-hot-zone",
        root,
      );
      const nodeGroups = gsap.utils.toArray<SVGGElement>(
        ".security-profile-svg-node",
        root,
      );
      const hoverOutlines = gsap.utils.toArray<SVGPathElement>(
        ".security-profile-hover-outline",
        root,
      );
      const columnIndexById = new Map(
        profileHoverBands.map((band, index) => [band.id, index]),
      );
      const deactivateColumn = (columnId: SecurityProfileColumnId | null) => {
        if (!columnId) {
          return;
        }

        const columnIndex = columnIndexById.get(columnId);
        const columnNodes = nodeGroups.filter(
          (node) => node.dataset.profileColumnId === columnId,
        );
        const columnOutlines = hoverOutlines.filter(
          (outline) => outline.dataset.profileColumnId === columnId,
        );

        if (columnIndex !== undefined) {
          gsap.to(hotZones[columnIndex], {
            "--profile-hot-rail-alpha": 0,
            autoAlpha: 0,
            duration: reduceMotion ? 0 : 0.2,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
        gsap.to(columnNodes, {
          duration: reduceMotion ? 0 : 0.24,
          ease: "power2.out",
          overwrite: "auto",
          scaleX: 1,
          scaleY: 1,
          y: 0,
        });
        gsap.set(columnOutlines, {
          drawSVG: "0% 0%",
        } as DrawSVGTweenVars);
      };

      const activateCurrentColumn = (columnId: SecurityProfileColumnId) => {
        const columnIndex = columnIndexById.get(columnId);
        const columnNodes = nodeGroups.filter(
          (node) => node.dataset.profileColumnId === columnId,
        );
        const columnOutlines = hoverOutlines.filter(
          (outline) => outline.dataset.profileColumnId === columnId,
        );

        if (columnIndex !== undefined) {
          gsap.to(hotZones[columnIndex], {
            "--profile-hot-rail-alpha": 1,
            autoAlpha: 1,
            duration: reduceMotion ? 0 : 0.24,
            ease: "power2.out",
            overwrite: "auto",
          });
        }
        gsap.to(columnNodes, {
          duration: reduceMotion ? 0 : PROFILE_HOVER_NODE_DURATION,
          ease: "power2.out",
          overwrite: "auto",
          scaleX: PROFILE_HOVER_NODE_SCALE_X,
          scaleY: PROFILE_HOVER_NODE_SCALE_Y,
          y: PROFILE_HOVER_NODE_Y,
        });

        if (reduceMotion) {
          gsap.set(columnOutlines, {
            drawSVG: "0% 100%",
          } as DrawSVGTweenVars);
        } else {
          gsap.fromTo(
            columnOutlines,
            { drawSVG: "0% 0%" } as DrawSVGTweenVars,
            {
              drawSVG: "0% 100%",
              duration: 0.52,
              ease: "power2.inOut",
              overwrite: "auto",
            } as DrawSVGTweenVars,
          );
        }
      };

      animatedColumnRef.current = activeColumnId;
      deactivateColumn(previousColumnId);
      if (activeColumnId) {
        activateCurrentColumn(activeColumnId);
      }
    },
    { dependencies: [activeColumnId], revertOnUpdate: false, scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      className="security-profile-page"
      aria-label="安全画像"
      data-sidebar-graph-layout={graphFreeze.layout}
      style={graphFreeze.graphStyle}
    >
      <header className="security-profile-header security-profile-reveal">
        <div>
          <span className="overview-kicker">Agent 边界图</span>
          <h1>{viewModel.agent.label} 的能力边界</h1>
          <p>
            平台已识别外部来源、长期记忆、敏感数据与需确认工具；请逐项核对画像是否符合预期。
          </p>
        </div>
        <div className="security-profile-permission-summary" aria-label="权限摘要">
          {Object.entries(viewModel.permissionCounts).map(([permission, count]) => (
            <span key={permission} className={`is-${permission.toLowerCase()}`}>
              <strong>{count}</strong>
              {PERMISSION_LABELS[permission] ?? permission}
            </span>
          ))}
        </div>
      </header>

      <div className="security-profile-workspace">
        <div
          ref={mapRef}
          className="security-profile-map security-profile-reveal"
        >
          <div
            ref={graphRef}
            className="security-profile-map-stage"
            onPointerEnter={(event) => setActiveColumnFromClientX(event.clientX)}
            onPointerLeave={() => activateColumn(null)}
            onPointerMove={(event) => setActiveColumnFromClientX(event.clientX)}
          >
            <div className="security-profile-hot-zone-layer" aria-hidden="true">
              {profileHoverBands.map((band) => (
                <div
                  key={band.id}
                  className={`security-profile-hot-zone${
                    band.id === activeColumnId ? " is-active" : ""
                  }`}
                  data-profile-column-id={band.id}
                  style={getProfileHotZoneStyle(band)}
                />
              ))}
            </div>

            <svg
              aria-label="Agent 外部来源、工具、数据与记忆边界关系图"
              className="security-profile-svg"
              role="img"
              viewBox={`0 0 ${PROFILE_GRAPH_VIEWBOX.width} ${PROFILE_GRAPH_VIEWBOX.height}`}
            >
              <defs>
                <linearGradient
                  id="security-profile-route-stroke"
                  x1="0"
                  x2="1"
                  y1="0"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#4f7cff" stopOpacity="0.82" />
                  <stop offset="28%" stopColor="#3b82f6" stopOpacity="0.96" />
                  <stop offset="55%" stopColor="#6d5ef7" stopOpacity="0.98" />
                  <stop offset="78%" stopColor="#8b5cf6" stopOpacity="0.94" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.9" />
                </linearGradient>
                <filter
                  id="security-profile-outline-glow"
                  x="-25%"
                  y="-40%"
                  width="150%"
                  height="180%"
                >
                  <feDropShadow
                    dx="0"
                    dy="0"
                    floodColor="#b9d6ff"
                    floodOpacity="0.62"
                    stdDeviation="3.4"
                  />
                </filter>
                <clipPath
                  id={PROFILE_BOUNDARY_CLIP_ID}
                  clipPathUnits="userSpaceOnUse"
                >
                  <rect
                    x={PROFILE_GRAPH_BOUNDARY.x}
                    y={PROFILE_GRAPH_BOUNDARY.y}
                    width={PROFILE_GRAPH_BOUNDARY.width}
                    height={PROFILE_GRAPH_BOUNDARY.height}
                    rx={PROFILE_GRAPH_BOUNDARY.rx}
                  />
                </clipPath>
              </defs>
              <rect
                className="security-profile-map-boundary"
                x={PROFILE_GRAPH_BOUNDARY.x}
                y={PROFILE_GRAPH_BOUNDARY.y}
                width={PROFILE_GRAPH_BOUNDARY.width}
                height={PROFILE_GRAPH_BOUNDARY.height}
                rx={PROFILE_GRAPH_BOUNDARY.rx}
              />
              {profileHoverBands.map((band) => (
                <rect
                  key={`${band.id}-band`}
                  className={`security-profile-column-band is-${band.id}`}
                  x={band.xStart}
                  y={PROFILE_GRAPH_BOUNDARY.y + 8}
                  width={band.xEnd - band.xStart}
                  height={PROFILE_GRAPH_BOUNDARY.height - 16}
                  rx="8"
                />
              ))}
              <g className="security-profile-column-info-layer" aria-hidden="true">
                {PROFILE_COLUMNS.map((column) => (
                  <g
                    key={column.id}
                    className="security-profile-column-info"
                    transform={`translate(${column.labelX}, ${PROFILE_COLUMN_INFO_Y})`}
                  >
                    <text
                      className="security-profile-column-label"
                      x={0}
                      y={0}
                      textAnchor="middle"
                    >
                      {column.infoLines.label}
                    </text>
                    <text
                      className="security-profile-column-title"
                      x={0}
                      y={24}
                      textAnchor="middle"
                    >
                      {column.infoLines.title}
                    </text>
                    <text
                      className="security-profile-column-subtitle"
                      x={0}
                      y={45}
                      textAnchor="middle"
                    >
                      {column.infoLines.summary}
                    </text>
                  </g>
                ))}
              </g>
              <g
                className="security-profile-routes"
                aria-hidden="true"
                clipPath={`url(#${PROFILE_BOUNDARY_CLIP_ID})`}
              >
                {routeSegments.map((segment) => (
                  <path
                    key={segment.id}
                    className={`security-profile-route is-route-tone-${segment.routeTone} is-${segment.visualIntent} ${
                      activeRouteIds.has(segment.id) ? "is-active" : ""
                    }`}
                    d={segment.d}
                    stroke="url(#security-profile-route-stroke)"
                    data-profile-route-id={segment.id}
                    data-profile-route-tone={segment.routeTone}
                    data-profile-visual-intent={segment.visualIntent}
                    pathLength={1}
                  />
                ))}
              </g>
              <g
                className="security-profile-nodes"
                clipPath={`url(#${PROFILE_BOUNDARY_CLIP_ID})`}
              >
                {viewModel.nodes.map((node) => {
                  const layout = PROFILE_LAYOUT_BY_NODE_ID[node.id];

                  if (!layout) {
                    return null;
                  }

                  const Icon = NODE_ICONS[node.kind];
                  const rectPath = createClockwiseRoundedRectPath(layout);
                  const iconX = layout.x - 12;
                  const iconY = layout.y - 34;
                  const caption = node.permission
                    ? PERMISSION_LABELS[node.permission]
                    : node.subtitle;

                  return (
                    <g
                      key={node.id}
                      aria-label={`${NODE_KIND_LABELS[node.kind]}：${node.label}`}
                      className={getNodeClassName(
                        node,
                        activeColumnId,
                        selectedNodeId,
                      )}
                      data-profile-column-id={node.columnId}
                      data-profile-node-id={node.id}
                    >
                      <path
                        className="security-profile-node-surface"
                        d={rectPath}
                      />
                      <path
                        className="security-profile-hover-outline"
                        d={rectPath}
                        data-profile-column-id={node.columnId}
                        filter="url(#security-profile-outline-glow)"
                        stroke="url(#security-profile-route-stroke)"
                      />
                      <Icon
                        aria-hidden="true"
                        className="security-profile-node-icon"
                        height={24}
                        width={24}
                        x={iconX}
                        y={iconY}
                        strokeWidth={1.65}
                      />
                      <text
                        className="security-profile-node-label"
                        x={layout.x}
                        y={layout.y + 14}
                        textAnchor="middle"
                      >
                        {node.label}
                      </text>
                      <text
                        className="security-profile-node-caption"
                        x={layout.x}
                        y={layout.y + 34}
                        textAnchor="middle"
                      >
                        {caption}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>

            <div className="security-profile-node-hitbox-layer" aria-hidden="false">
              {viewModel.nodes.map((node) => {
                const layout = PROFILE_LAYOUT_BY_NODE_ID[node.id];

                if (!layout) {
                  return null;
                }

                return (
                  <button
                    key={`${node.id}-hitbox`}
                    type="button"
                    aria-label={`${NODE_KIND_LABELS[node.kind]}：${node.label}`}
                    className={`security-profile-node-hitbox${
                      node.id === selectedNodeId ? " is-selected" : ""
                    }`}
                    data-profile-column-id={node.columnId}
                    data-profile-node-id={node.id}
                    onBlur={() => activateColumn(null)}
                    onClick={() => setSelectedNodeId(node.id)}
                    onFocus={() => activateColumn(node.columnId)}
                    style={getProfileNodeOverlayStyle(layout)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className="security-profile-reveal">
          <SecurityProfileInspector node={selectedNode} />
        </div>
      </div>

      <footer className="security-profile-footer security-profile-reveal">
        <span>
          <Fingerprint size={15} aria-hidden="true" />
          数据来自当前 Agent fixture 与攻击图谱 fixture
        </span>
        <span>当前页面只做画像确认，不判定攻击链成立</span>
      </footer>
    </section>
  );
}
