"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import {
  Bot,
  Database,
  Globe2,
  KeyRound,
  Mail,
  MailCheck,
  Search,
  ShieldAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import { createClockwiseRoundedRectPath } from "../shared/graph-svg-primitives.ts";
import { useGraphNodeHoverOutline } from "../shared/useGraphNodeHoverOutline";
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
  profileHoverBands,
} from "./security-profile-graph-layout";
import type {
  SecurityProfileNode,
  SecurityProfileViewModel,
} from "./security-profile-data";
import { createTopologySecurityProfileViewModel } from "./security-profile-data";
import { DefenseVisualizationStage } from "./DefenseVisualizationStage";
import type { AgentTopology, TopologyNodeRole } from "../topology/topology-types";
import type { ProjectionAttackGraph } from "../topology/topology-projection";

gsap.registerPlugin(useGSAP, DrawSVGPlugin);

type SecurityProfileGraphProps = {
  attackGraph?: ProjectionAttackGraph | null;
  /**
   * Where the rendered profile came from. `mock` means the Agent profile API was
   * not reachable and the page falls back to the fixture baseline, so the badge
   * must never claim a real backend reading.
   */
  dataSource?: "api" | "mock";
  errorMessage?: string;
  isGraphFrozen: boolean;
  sidebarContentMetrics: SidebarContentMetrics;
  topology?: AgentTopology;
  viewModel: SecurityProfileViewModel;
};

type DrawSVGTweenVars = gsap.TweenVars & {
  drawSVG?: number | string;
};

type ProfileNodeOverlayStyleVars = CSSProperties &
  Record<"--node-height" | "--node-left" | "--node-top" | "--node-width", string>;

const PROFILE_BOUNDARY_CLIP_ID = "security-profile-boundary-clip";
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

const TOPOLOGY_ROLE_ICONS: Record<TopologyNodeRole, LucideIcon> = {
  AGENT: Bot,
  EXECUTOR: Bot,
  KNOWLEDGE_BASE: Database,
  PLANNER: Bot,
  RETRIEVER: Search,
};

function getProfileNodeIcon(node: SecurityProfileNode): LucideIcon {
  return node.topologyRole
    ? TOPOLOGY_ROLE_ICONS[node.topologyRole]
    : NODE_ICONS[node.kind];
}

function formatRouteChannelLabel(channel: string) {
  return channel.toUpperCase().replaceAll("_", " ");
}

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
  selectedNodeId: string,
  hoveredNodeId: string | null,
) {
  const classes = [
    "security-profile-svg-node",
    `is-${node.kind}`,
    node.id === hoveredNodeId ? "is-active" : "",
    node.id === selectedNodeId ? "is-selected" : "",
    node.permission ? `has-${node.permission.toLowerCase()}` : "",
    ...node.labels.map((label) => `has-${label.toLowerCase()}`),
  ];

  return classes.filter(Boolean).join(" ");
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
  const Icon = node.topologyRole
    ? TOPOLOGY_ROLE_ICONS[node.topologyRole]
    : node.kind === "agent"
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
  attackGraph,
  dataSource = "mock",
  errorMessage,
  isGraphFrozen,
  sidebarContentMetrics,
  topology,
  viewModel,
}: SecurityProfileGraphProps) {
  const rootRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState(viewModel.agent.id);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [screen, setScreen] = useState<"profile" | "defense">("profile");
  const [isDefenseRevealed, setIsDefenseRevealed] = useState(false);
  const requestedScreenRef = useRef<"profile" | "defense">("profile");
  const hasScreenRequestRef = useRef(false);
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

  const displayViewModel = useMemo(
    () =>
      topology && topology.topology_type !== "single"
        ? createTopologySecurityProfileViewModel(viewModel, topology, attackGraph)
        : viewModel,
    [attackGraph, topology, viewModel],
  );

  const nodesById = useMemo(
    () => new Map(displayViewModel.nodes.map((node) => [node.id, node])),
    [displayViewModel.nodes],
  );
  const selectedNode = nodesById.get(selectedNodeId) ?? displayViewModel.agent;
  const routeSegments = useMemo(
    () =>
      topology && topology.topology_type !== "single"
        ? buildProfileRouteSegments(displayViewModel.routes)
        : buildProfileRouteSegments(),
    [displayViewModel.routes, topology],
  );
  const activeRouteIds = useMemo(() => {
    if (!hoveredNodeId) {
      return new Set<string>();
    }

    return new Set(
      routeSegments
        .filter((segment) => segment.sourceNodeId === hoveredNodeId || segment.targetNodeId === hoveredNodeId)
        .map((segment) => segment.id),
    );
  }, [hoveredNodeId, routeSegments]);
  const profileNodeKey = displayViewModel.nodes.map((node) => node.id).join("|");

  useGraphNodeHoverOutline({
    activeNodeId: hoveredNodeId,
    nodeKey: profileNodeKey,
    nodeSelector: ".security-profile-svg-node",
    outlineSelector: ".security-profile-hover-outline",
    rootRef,
  });

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
          const pageRevealTargets = gsap.utils.toArray<HTMLElement>(
            ".security-profile-reveal",
            root,
          );
          const boundaryTargets = boundary ? [boundary] : [];

          gsap.set(hoverOutlines, {
            autoAlpha: 0,
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

  const requestScreen = useCallback((nextScreen: "profile" | "defense") => {
    if (requestedScreenRef.current === nextScreen) {
      return;
    }

    requestedScreenRef.current = nextScreen;
    hasScreenRequestRef.current = true;
    if (nextScreen === "profile") {
      setIsDefenseRevealed(false);
    }
    setScreen(nextScreen);
  }, []);

  useGSAP(
    () => {
      const root = rootRef.current;
      const profileScreen = root?.querySelector<HTMLElement>(
        ".security-profile-profile-screen",
      );
      const defenseScreen = root?.querySelector<HTMLElement>(
        ".security-profile-defense-screen",
      );

      if (!profileScreen || !defenseScreen) {
        return;
      }

      gsap.killTweensOf([profileScreen, defenseScreen]);

      if (!hasScreenRequestRef.current) {
        // Every menu entry mounts a fresh screen stack at the profile baseline.
        gsap.set(profileScreen, { autoAlpha: 1 });
        gsap.set(defenseScreen, { autoAlpha: 0 });
        setIsDefenseRevealed(false);
        return;
      }

      hasScreenRequestRef.current = false;
      const reducedMotion = isReducedMotion();
      setIsDefenseRevealed(false);

      if (reducedMotion) {
        gsap.set(profileScreen, { autoAlpha: screen === "profile" ? 1 : 0 });
        gsap.set(defenseScreen, { autoAlpha: screen === "defense" ? 1 : 0 });
        setIsDefenseRevealed(screen === "defense");
        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: "power3.inOut" },
      });

      if (screen === "defense") {
        gsap.set(profileScreen, { autoAlpha: 1 });
        gsap.set(defenseScreen, { autoAlpha: 0 });
        timeline
          .to(profileScreen, { autoAlpha: 0, duration: 0.34 })
          .call(() => setIsDefenseRevealed(true), [], 0.22)
          .to(defenseScreen, { autoAlpha: 1, duration: 0.38 }, 0.22);
      } else {
        gsap.set(profileScreen, { autoAlpha: 0 });
        gsap.set(defenseScreen, { autoAlpha: 1 });
        timeline
          .to(defenseScreen, { autoAlpha: 0, duration: 0.28 })
          .to(profileScreen, { autoAlpha: 1, duration: 0.38 }, "<0.06");
      }

      return () => {
        timeline.kill();
        gsap.killTweensOf([profileScreen, defenseScreen]);
      };
    },
    { dependencies: [screen], revertOnUpdate: false, scope: rootRef },
  );

  return (
    <section
      ref={rootRef}
      className="security-profile-page"
      aria-label="安全画像"
      data-sidebar-graph-layout={graphFreeze.layout}
      style={graphFreeze.graphStyle}
    >
      <div className="security-profile-page-track">
        <section
          className="security-profile-page-screen security-profile-profile-screen"
          aria-label="安全画像第一页"
          aria-hidden={screen !== "profile"}
        >
          <header className="security-profile-header security-profile-reveal">
        <div>
          <span className="security-profile-eyebrow-row">
            <span className="overview-kicker">Agent 边界图</span>
            <span className={`security-profile-inline-badge is-${dataSource}`}>
              {dataSource === "api" ? "真实接入" : "示例预览"}
            </span>
          </span>
          <h1>{displayViewModel.agent.label} 的能力边界</h1>
          {topology?.topology_type === "single" ? (
            <p>平台已识别外部来源、长期记忆、敏感数据与需确认工具。</p>
          ) : null}
          {errorMessage ? (
            <p className="security-profile-source-note">{errorMessage}</p>
          ) : null}
        </div>
        <div className="security-profile-permission-summary" aria-label="权限摘要">
          {Object.entries(displayViewModel.permissionCounts).map(([permission, count]) => (
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
            onPointerLeave={() => setHoveredNodeId(null)}
          >
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
                clipPath={`url(#${PROFILE_BOUNDARY_CLIP_ID})`}
              >
                {routeSegments.map((segment) => (
                  <g
                    key={segment.id}
                    aria-label={`${formatRouteChannelLabel(segment.channel ?? segment.id)} 通道`}
                    className="security-profile-route-control"
                    onClick={() => setSelectedNodeId(segment.sourceNodeId)}
                    onFocus={() => setHoveredNodeId(segment.sourceNodeId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedNodeId(segment.sourceNodeId);
                      }
                    }}
                    onPointerEnter={() => setHoveredNodeId(segment.sourceNodeId)}
                    onPointerLeave={() => setHoveredNodeId(null)}
                    role="button"
                    tabIndex={0}
                  >
                    <path className="security-profile-route-hitbox" d={segment.d} fill="none" />
                    <path
                      className={`security-profile-route is-route-tone-${segment.routeTone} is-${segment.visualIntent} ${
                        activeRouteIds.has(segment.id) ? "is-active" : ""
                      } ${segment.carriesUntrustedContent ? "is-untrusted" : ""}`}
                      d={segment.d}
                      stroke="url(#security-profile-route-stroke)"
                      data-profile-route-id={segment.id}
                      data-profile-route-channel={segment.channel ?? ""}
                      data-profile-route-tone={segment.routeTone}
                      data-profile-visual-intent={segment.visualIntent}
                      pathLength={1}
                    />
                    {segment.channel ? (
                      <text
                        className="security-profile-route-label"
                        x={segment.labelX}
                        y={segment.labelY}
                        textAnchor="middle"
                      >
                        {formatRouteChannelLabel(segment.channel)}
                      </text>
                    ) : null}
                  </g>
                ))}
              </g>
              <g
                className="security-profile-nodes"
                clipPath={`url(#${PROFILE_BOUNDARY_CLIP_ID})`}
              >
                {displayViewModel.nodes.map((node) => {
                  const layout = PROFILE_LAYOUT_BY_NODE_ID[node.id];

                  if (!layout) {
                    return null;
                  }

                  const Icon = getProfileNodeIcon(node);
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
                        selectedNodeId,
                        hoveredNodeId,
                      )}
                      data-hover-node-id={node.id}
                      data-profile-column-id={node.columnId}
                      data-profile-node-id={node.id}
                    >
                      <path
                        className="security-profile-node-surface"
                        d={rectPath}
                      />
                      <path
                        className="security-profile-hover-outline graph-hover-outline"
                        d={rectPath}
                        data-profile-column-id={node.columnId}
                        filter="url(#security-profile-outline-glow)"
                        pathLength={1}
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
              {displayViewModel.nodes.map((node) => {
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
                    onBlur={() => setHoveredNodeId(null)}
                    onClick={() => setSelectedNodeId(node.id)}
                    onFocus={() => setHoveredNodeId(node.id)}
                    onPointerEnter={() => setHoveredNodeId(node.id)}
                    onPointerLeave={() => setHoveredNodeId(null)}
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
            <button
              className="security-profile-defense-cta"
              type="button"
              aria-label="进入防御机制可视化"
              title="进入防御机制可视化"
              onClick={() => requestScreen("defense")}
            >
              <svg
                className="security-profile-defense-cta-svg"
                viewBox="0 0 1000 112"
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="查看防御机制"
              >
                <g className="security-profile-defense-cta-content">
                  <text
                    className="security-profile-defense-cta-bracket"
                    x="340"
                    y="65"
                    textAnchor="middle"
                  >
                    [
                  </text>
                  <g
                    className="security-profile-defense-cta-mouse"
                    transform="translate(386 42)"
                    aria-hidden="true"
                  >
                    <rect
                      className="security-profile-defense-cta-mouse-shell"
                      x="0"
                      y="0"
                      width="18"
                      height="28"
                      rx="9"
                    />
                    <rect
                      className="security-profile-defense-cta-left-click"
                      x="1.5"
                      y="1.5"
                      width="7.5"
                      height="14"
                      rx="5"
                      fill="#6d5ef7"
                    />
                    <path
                      className="security-profile-defense-cta-mouse-divider"
                      d="M9 1.5v14"
                    />
                    <rect
                      className="security-profile-defense-cta-mouse-wheel"
                      x="7.5"
                      y="6"
                      width="2.5"
                      height="6"
                      rx="1.25"
                    />
                  </g>
                  <text
                    className="security-profile-defense-cta-title"
                    x="535"
                    y="65"
                    textAnchor="middle"
                  >
                    查看防御机制
                  </text>
                  <text
                    className="security-profile-defense-cta-bracket"
                    x="660"
                    y="65"
                    textAnchor="middle"
                  >
                    ]
                  </text>
                </g>
              </svg>
            </button>
          </footer>
        </section>

        <DefenseVisualizationStage
          isVisible={isDefenseRevealed}
          onReturn={() => requestScreen("profile")}
        />
      </div>
    </section>
  );
}
