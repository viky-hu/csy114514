"use client";

import { useMemo, useRef, useState } from "react";
import {
  Bot,
  Database,
  FileWarning,
  Globe2,
  MailCheck,
  Search,
} from "lucide-react";
import { createClockwiseRoundedRectPath } from "../shared/graph-svg-primitives";
import { useGraphNodeHoverOutline } from "../shared/useGraphNodeHoverOutline";
import {
  createTopologyRiskChainLayout,
  TOPOLOGY_RISK_CHAIN_VIEWBOX,
} from "./topology-risk-chain-layout";
import type { TopologyRiskChain } from "./topology-projection";

type ReadyTopologyRiskChain = Extract<TopologyRiskChain, { dataState: "ready" }>;

type TopologyRiskChainGraphProps = {
  ariaLabel: string;
  chain: ReadyTopologyRiskChain;
};

const ROLE_ICONS = {
  agent: Bot,
  executor: Bot,
  knowledge_base: Database,
  planner: Bot,
  retriever: Search,
  source: Globe2,
  tool: MailCheck,
} as const;

export function TopologyRiskChainGraph({
  ariaLabel,
  chain,
}: TopologyRiskChainGraphProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const layout = useMemo(
    () => createTopologyRiskChainLayout(chain.nodes.map((node) => node.id)),
    [chain.nodes],
  );
  const nodeKey = chain.nodes.map((node) => node.id).join("|");
  const relatedEdgeIds = useMemo(
    () =>
      new Set(
        chain.edges
          .filter(
            (edge) =>
              edge.sourceNodeId === hoveredNodeId ||
              edge.targetNodeId === hoveredNodeId,
          )
          .map((edge) => edge.id),
      ),
    [chain.edges, hoveredNodeId],
  );

  useGraphNodeHoverOutline({
    activeNodeId: hoveredNodeId,
    nodeKey,
    rootRef,
  });

  return (
    <div ref={rootRef} className="topology-risk-chain-graph">
      <svg
        aria-label={ariaLabel}
        className="topology-risk-chain-svg"
        role="img"
        viewBox={`0 0 ${TOPOLOGY_RISK_CHAIN_VIEWBOX.width} ${TOPOLOGY_RISK_CHAIN_VIEWBOX.height}`}
      >
        <defs>
          <linearGradient id="topology-risk-route" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#3152f4" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.92" />
          </linearGradient>
          <linearGradient id="topology-risk-outline" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#3152f4" />
            <stop offset="55%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#b45cff" />
          </linearGradient>
          <marker
            id="topology-risk-arrow"
            markerHeight="7"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="3.5"
          >
            <path d="M 0 0 L 8 3.5 L 0 7 z" fill="#7c3aed" />
          </marker>
        </defs>

        <g className="topology-risk-routes" aria-hidden="true">
          {layout.edges.map((edgeLayout, index) => {
            const edge = chain.edges[index];
            if (!edge) return null;
            return (
              <g
                key={edge.id}
                className={`topology-risk-edge${relatedEdgeIds.has(edge.id) ? " is-active" : ""}`}
                data-topology-edge-id={edge.id}
              >
                <path
                  className="topology-risk-edge-stroke"
                  d={edgeLayout.d}
                  fill="none"
                  markerEnd="url(#topology-risk-arrow)"
                  pathLength={1}
                  stroke="url(#topology-risk-route)"
                />
                <text
                  className="topology-risk-edge-label"
                  textAnchor="middle"
                  x={edgeLayout.labelX}
                  y={edgeLayout.labelY}
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </g>

        <g className="topology-risk-nodes">
          {chain.nodes.map((node, index) => {
            const nodeLayout = layout.nodes[index]!;
            const Icon = node.role === "source" && chain.riskPatternId === "R6"
              ? FileWarning
              : ROLE_ICONS[node.role];
            const rectPath = createClockwiseRoundedRectPath(nodeLayout);
            return (
              <g
                key={node.id}
                aria-label={`${node.displayName} 节点`}
                className={`topology-risk-node graph-hover-node is-${node.role}${node.trustBoundary === "external" ? " is-external" : ""}${selectedNodeId === node.id ? " is-selected" : ""}`}
                data-hover-node-id={node.id}
                data-topology-node-id={node.id}
                onBlur={() => setHoveredNodeId(null)}
                onClick={() => setSelectedNodeId(node.id)}
                onFocus={() => setHoveredNodeId(node.id)}
                onPointerEnter={() => setHoveredNodeId(node.id)}
                onPointerLeave={() => setHoveredNodeId(null)}
                role="button"
                tabIndex={0}
              >
                <path className="topology-risk-node-surface" d={rectPath} />
                <path
                  className="topology-risk-node-outline graph-hover-outline"
                  d={rectPath}
                  pathLength={1}
                  stroke="url(#topology-risk-outline)"
                />
                <Icon
                  aria-hidden="true"
                  className="topology-risk-node-icon"
                  height={22}
                  width={22}
                  x={nodeLayout.x - 11}
                  y={nodeLayout.y - 31}
                  strokeWidth={1.65}
                />
                <text
                  className="topology-risk-node-label"
                  textAnchor="middle"
                  x={nodeLayout.x}
                  y={nodeLayout.y + 10}
                >
                  {node.displayName}
                </text>
                <text
                  className="topology-risk-node-caption"
                  textAnchor="middle"
                  x={nodeLayout.x}
                  y={nodeLayout.y + 30}
                >
                  {node.caption}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
