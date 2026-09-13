import type {
  AgentTopology,
  TopologyEdge,
  TopologyNode,
  TopologyNodeRole,
} from "./topology-types.ts";

export type ProjectionGraphNode = {
  labels: string[];
  metadata: {
    name?: string;
    role?: string;
  };
  node_id: string;
  node_type: string;
};

export type ProjectionGraphEdge = {
  edge_id: string;
  edge_type: string;
  metadata?: {
    description?: string;
  };
  source_node_id: string;
  target_node_id: string;
};

export type ProjectionAttackGraph = {
  edges: ProjectionGraphEdge[];
  nodes: ProjectionGraphNode[];
  risk_path_ids: string[];
};

export type ProjectionFinding = {
  risk_pattern_id: string;
};

export type TopologyContextNode = ProjectionGraphNode & {
  contextRole: "entry" | "sink";
};

export type TopologyProjection = {
  attackGraph: ProjectionAttackGraph | null;
  contextNodes: TopologyContextNode[];
  dataState: "ready" | "insufficient";
  edges: TopologyEdge[];
  findings: ProjectionFinding[];
  nodes: TopologyNode[];
  reason: string | null;
  topology: AgentTopology;
};

export type TopologyRiskPath = {
  edges: TopologyEdge[];
  nodeIds: string[];
  riskPatternId: string;
  status: "potential" | "verified";
};

type CreateTopologyProjectionInput = {
  attackGraph?: ProjectionAttackGraph | null;
  findings?: ProjectionFinding[];
  topology: AgentTopology;
};

function normalizedRole(node: ProjectionGraphNode) {
  return node.metadata.role?.trim().toLowerCase() ?? "";
}

function roleName(role: TopologyNodeRole) {
  return role.toLowerCase();
}

function hasLabel(node: ProjectionGraphNode, label: string) {
  return node.labels.some((item) => item.toUpperCase() === label);
}

function findGraphNodeForTopologyNode(
  graph: ProjectionAttackGraph,
  topologyNode: TopologyNode,
) {
  return graph.nodes.find((node) => node.node_id === topologyNode.id)
    ?? graph.nodes.find((node) => normalizedRole(node) === roleName(topologyNode.role));
}

function findEntryNode(graph: ProjectionAttackGraph) {
  return graph.nodes.find(
    (node) => node.node_type === "SOURCE" || normalizedRole(node) === "external",
  );
}

function findSinkNode(graph: ProjectionAttackGraph, topology: AgentTopology) {
  const toolNames = new Set(topology.nodes.flatMap((node) => node.tools));

  return graph.nodes.find(
    (node) => hasLabel(node, "DANGEROUS") || (node.metadata.name ? toolNames.has(node.metadata.name) : false),
  );
}

function topologyNodesForRisk(topology: AgentTopology, riskPatternId: string) {
  if (riskPatternId === "R5" && topology.topology_type === "planner_executor") {
    return topology.nodes.filter(
      (node) => node.role === "PLANNER" || node.role === "EXECUTOR",
    );
  }

  if (riskPatternId === "R6" && topology.topology_type === "rag_agent") {
    return topology.nodes.filter(
      (node) =>
        node.role === "KNOWLEDGE_BASE" ||
        node.role === "RETRIEVER" ||
        node.role === "AGENT",
    );
  }

  return [];
}

export function createTopologyProjection({
  attackGraph = null,
  findings = [],
  topology,
}: CreateTopologyProjectionInput): TopologyProjection {
  if (!attackGraph) {
    return {
      attackGraph: null,
      contextNodes: [],
      dataState: "insufficient",
      edges: topology.edges,
      findings,
      nodes: topology.nodes,
      reason: "攻击图谱暂不可用，无法补充拓扑上下文。",
      topology,
    };
  }

  const resolvedTopologyIds = new Set(
    topology.nodes
      .map((node) => findGraphNodeForTopologyNode(attackGraph, node)?.node_id)
      .filter((nodeId): nodeId is string => Boolean(nodeId)),
  );
  const contextNodes: TopologyContextNode[] = [];
  const entry = findEntryNode(attackGraph);
  const sink = findSinkNode(attackGraph, topology);

  if (entry && !resolvedTopologyIds.has(entry.node_id)) {
    contextNodes.push({ ...entry, contextRole: "entry" });
  }

  if (sink && !resolvedTopologyIds.has(sink.node_id)) {
    contextNodes.push({ ...sink, contextRole: "sink" });
  }

  return {
    attackGraph,
    contextNodes,
    dataState: "ready",
    edges: topology.edges,
    findings,
    nodes: topology.nodes,
    reason: null,
    topology,
  };
}

export function getTopologySummary(projection: TopologyProjection) {
  return {
    nodeCount: projection.nodes.length,
    topologyType: projection.topology.topology_type,
    untrustedChannelCount: projection.edges.filter((edge) => edge.carries_untrusted_content)
      .length,
  };
}

export function getTopologyRiskPath(
  projection: TopologyProjection,
  riskPatternId: string,
): TopologyRiskPath | null {
  if (!projection.attackGraph?.risk_path_ids.includes(riskPatternId)) {
    return null;
  }

  const topologyNodes = topologyNodesForRisk(projection.topology, riskPatternId);

  if (topologyNodes.length === 0) {
    return null;
  }

  const entry = projection.contextNodes.find((node) => node.contextRole === "entry");
  const sink = projection.contextNodes.find((node) => node.contextRole === "sink");
  const topologyNodeIds = topologyNodes.map((node) => node.id);
  const relevantEdges = projection.edges.filter(
    (edge) =>
      topologyNodeIds.includes(edge.from_node) && topologyNodeIds.includes(edge.to_node),
  );

  return {
    edges: relevantEdges,
    nodeIds: [
      ...(entry ? [entry.node_id] : []),
      ...topologyNodeIds,
      ...(sink ? [sink.node_id] : []),
    ],
    riskPatternId,
    status: projection.findings.some(
      (finding) => finding.risk_pattern_id === riskPatternId,
    )
      ? "verified"
      : "potential",
  };
}
