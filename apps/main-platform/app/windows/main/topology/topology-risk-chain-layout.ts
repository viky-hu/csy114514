import { createSmoothEdgePath } from "./topology-graph-geometry.ts";

// Keep the chain centered in the taller overview graph row. All node, edge,
// label, icon, and hit-target coordinates are derived from this same space.
export const TOPOLOGY_RISK_CHAIN_VIEWBOX = { height: 360, width: 920 } as const;
export const TOPOLOGY_RISK_CHAIN_NODE_SIZE = { height: 76, width: 132 } as const;

export type TopologyRiskChainLayoutNode = {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
};

export type TopologyRiskChainLayoutEdge = {
  d: string;
  labelX: number;
  labelY: number;
  sourceNodeId: string;
  targetNodeId: string;
};

export function createTopologyRiskChainLayout(
  nodeIds: string[],
  edgePairs: Array<{ sourceNodeId: string; targetNodeId: string }> = nodeIds.slice(0, -1).map((_, index) => ({
    sourceNodeId: nodeIds[index]!,
    targetNodeId: nodeIds[index + 1]!,
  })),
) {
  const count = nodeIds.length;
  const startX = 92;
  const endX = TOPOLOGY_RISK_CHAIN_VIEWBOX.width - 92;
  const step = count > 1 ? (endX - startX) / (count - 1) : 0;
  const nodes: TopologyRiskChainLayoutNode[] = nodeIds.map((id, index) => ({
    ...TOPOLOGY_RISK_CHAIN_NODE_SIZE,
    id,
    x: count === 1 ? TOPOLOGY_RISK_CHAIN_VIEWBOX.width / 2 : startX + step * index,
    y: 180 + (index % 2 === 0 ? -18 : 18),
  }));
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const edges: TopologyRiskChainLayoutEdge[] = edgePairs.flatMap((pair, edgeIndex) => {
      const source = nodesById.get(pair.sourceNodeId);
      const target = nodesById.get(pair.targetNodeId);
      if (!source || !target) return [];
      const offset = edgeIndex % 2 === 0 ? -10 : 10;
      const route = createSmoothEdgePath(source, target, offset);
      return {
        d: route.d,
        labelX: route.labelX,
        labelY: route.labelY - 4,
        sourceNodeId: source.id,
        targetNodeId: target.id,
      };
    });

  return { edges, nodes };
}
