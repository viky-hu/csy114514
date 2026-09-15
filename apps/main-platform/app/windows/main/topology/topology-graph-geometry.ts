export type TopologyGraphRect = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TopologyGraphEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  label?: string;
};

export type TopologyGraphPoint = { x: number; y: number };

export type TopologyGraphEdgeGeometry = TopologyGraphEdge & {
  d: string;
  labelX: number;
  labelY: number;
  source: TopologyGraphPoint;
  target: TopologyGraphPoint;
};

function center(rect: TopologyGraphRect): TopologyGraphPoint {
  return { x: rect.x, y: rect.y };
}

export function createBoundaryAnchor(
  rect: TopologyGraphRect,
  toward: TopologyGraphRect,
): TopologyGraphPoint {
  const source = center(rect);
  const target = center(toward);
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  // Graph stages are generally laid out left-to-right. Keeping horizontal
  // channels attached to the side centers prevents diagonal curves from
  // grazing the node surface when rows are slightly staggered.
  if (Math.abs(dx) >= Math.abs(dy) * 0.55) {
    return {
      x: source.x + (dx >= 0 ? rect.width / 2 : -rect.width / 2),
      y: source.y,
    };
  }

  return {
    x: source.x,
    y: source.y + (dy >= 0 ? rect.height / 2 : -rect.height / 2),
  };
}

export function createSmoothEdgePath(
  sourceRect: TopologyGraphRect,
  targetRect: TopologyGraphRect,
  branchOffset = 0,
  label = "",
): TopologyGraphEdgeGeometry {
  const source = createBoundaryAnchor(sourceRect, targetRect);
  const target = createBoundaryAnchor(targetRect, sourceRect);
  const horizontal = Math.abs(target.x - source.x) >= Math.abs(target.y - source.y);
  const distance = horizontal
    ? Math.max(42, Math.abs(target.x - source.x) * 0.42)
    : Math.max(42, Math.abs(target.y - source.y) * 0.42);
  const controlOne = horizontal
    ? { x: source.x + Math.sign(target.x - source.x || 1) * distance, y: source.y + branchOffset }
    : { x: source.x + branchOffset, y: source.y + Math.sign(target.y - source.y || 1) * distance };
  const controlTwo = horizontal
    ? { x: target.x - Math.sign(target.x - source.x || 1) * distance, y: target.y + branchOffset }
    : { x: target.x + branchOffset, y: target.y - Math.sign(target.y - source.y || 1) * distance };

  return {
    d: `M ${source.x} ${source.y} C ${controlOne.x} ${controlOne.y} ${controlTwo.x} ${controlTwo.y} ${target.x} ${target.y}`,
    id: "",
    label,
    labelX: (source.x + target.x) / 2 + (horizontal ? 0 : branchOffset),
    labelY: (source.y + target.y) / 2 + (horizontal ? branchOffset - 10 : 0),
    source,
    sourceNodeId: sourceRect.id,
    target,
    targetNodeId: targetRect.id,
  };
}

export function createTopologyGraphGeometry(
  nodes: TopologyGraphRect[],
  edges: TopologyGraphEdge[],
) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, TopologyGraphEdge[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.sourceNodeId) ?? [];
    list.push(edge);
    outgoing.set(edge.sourceNodeId, list);
  }

  return {
    edges: edges.flatMap((edge) => {
      const source = nodesById.get(edge.sourceNodeId);
      const target = nodesById.get(edge.targetNodeId);
      if (!source || !target) return [];
      const siblings = outgoing.get(edge.sourceNodeId) ?? [edge];
      const index = siblings.findIndex((item) => item.id === edge.id);
      const branchOffset = (index - (siblings.length - 1) / 2) * 22;
      return [{ ...createSmoothEdgePath(source, target, branchOffset, edge.label), ...edge }];
    }),
    nodes,
  };
}
