export const TOPOLOGY_RISK_CHAIN_VIEWBOX = { height: 260, width: 920 } as const;
export const TOPOLOGY_RISK_CHAIN_NODE_SIZE = { height: 86, width: 124 } as const;

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

export function createTopologyRiskChainLayout(nodeIds: string[]) {
  const count = nodeIds.length;
  const startX = 82;
  const endX = 838;
  const step = count > 1 ? (endX - startX) / (count - 1) : 0;
  const nodes: TopologyRiskChainLayoutNode[] = nodeIds.map((id, index) => ({
    ...TOPOLOGY_RISK_CHAIN_NODE_SIZE,
    id,
    x: count === 1 ? TOPOLOGY_RISK_CHAIN_VIEWBOX.width / 2 : startX + step * index,
    y: 136,
  }));
  const edges: TopologyRiskChainLayoutEdge[] = nodes
    .slice(0, -1)
    .map((source, index) => {
      const target = nodes[index + 1]!;
      const start = source.x + source.width / 2;
      const end = target.x - target.width / 2;
      return {
        d: `M ${start} ${source.y} L ${end} ${target.y}`,
        labelX: (start + end) / 2,
        labelY: source.y - source.height / 2 - 16,
        sourceNodeId: source.id,
        targetNodeId: target.id,
      };
    });

  return { edges, nodes };
}
