import type { AgentTopology, TopologyNode, TopologyNodeRole } from "./topology-types.ts";

export type ProjectionGraphNode = {
  labels: string[];
  metadata: { description?: string; name?: string; role?: string };
  node_id: string;
  node_type: string;
};

export type ProjectionGraphEdge = {
  edge_id: string;
  edge_type: string;
  metadata?: { description?: string };
  source_node_id: string;
  target_node_id: string;
};

export type ProjectionAttackGraph = {
  edges: ProjectionGraphEdge[];
  nodes: ProjectionGraphNode[];
  risk_path_ids?: string[];
};

export type ProjectionFinding = { risk_pattern_id: string };

export type TopologyRiskChainNode = {
  caption: string;
  displayName: string;
  graphNodeId: string;
  id: string;
  labels: string[];
  nodeType: string;
  origin: "graph" | "topology";
  role: "agent" | "executor" | "knowledge_base" | "planner" | "retriever" | "source" | "tool";
  trustBoundary: "external" | "internal";
};

export type TopologyRiskChainEdge = {
  carriesUntrustedContent: boolean;
  channel: string;
  description: string;
  id: string;
  label: string;
  origin: "graph" | "topology";
  sourceNodeId: string;
  targetNodeId: string;
};

export type TopologyRiskChain =
  | {
      dataState: "ready";
      edges: TopologyRiskChainEdge[];
      nodes: TopologyRiskChainNode[];
      riskPatternId: "R5" | "R6";
      status: "potential" | "verified";
      topologyType: "planner_executor" | "rag_agent";
    }
  | {
      dataState: "insufficient";
      reason: string;
      topologyType: AgentTopology["topology_type"];
    };

type CreateTopologyRiskChainInput = {
  attackGraph?: ProjectionAttackGraph | null;
  findings?: ProjectionFinding[];
  topology?: AgentTopology | null;
};

const TOPOLOGY_ROLE_VIEW: Record<TopologyNodeRole, Pick<TopologyRiskChainNode, "caption" | "displayName" | "nodeType" | "role">> = {
  AGENT: { caption: "组装上下文并决策", displayName: "主 Agent", nodeType: "AGENT", role: "agent" },
  EXECUTOR: { caption: "执行计划中的动作", displayName: "任务执行", nodeType: "AGENT", role: "executor" },
  KNOWLEDGE_BASE: { caption: "外部知识内容", displayName: "知识库", nodeType: "DATA", role: "knowledge_base" },
  PLANNER: { caption: "接收不可信内容", displayName: "任务规划", nodeType: "AGENT", role: "planner" },
  RETRIEVER: { caption: "检索知识库内容", displayName: "上下文检索", nodeType: "AGENT", role: "retriever" },
};

const GRAPH_NODE_COPY: Record<string, Pick<TopologyRiskChainNode, "caption" | "displayName">> = {
  "browser.open_page": { caption: "不可信网页输入", displayName: "恶意网页" },
  "email.send": { caption: "对外发送动作", displayName: "发送邮件" },
  "External Documents": { caption: "不可信外部文档", displayName: "外部文档" },
};

function normalize(value?: string) {
  return value?.trim().toLowerCase().replaceAll("-", "_") ?? "";
}

function formatChannel(value: string) {
  return value.toUpperCase().replaceAll("_", " ");
}

function isExternal(node: ProjectionGraphNode) {
  const labels = node.labels.map((label) => label.toUpperCase());
  return node.node_type === "SOURCE" || normalize(node.metadata.role) === "external" || labels.includes("UNTRUSTED") || labels.includes("EXTERNAL");
}

function findEntryNode(graph: ProjectionAttackGraph) {
  return graph.nodes.find((node) => node.node_type === "SOURCE")
    ?? graph.nodes.find((node) => normalize(node.metadata.role) === "external")
    ?? graph.nodes.find(isExternal);
}

function findSinkNode(graph: ProjectionAttackGraph, topology: AgentTopology) {
  const toolNames = new Set(topology.nodes.flatMap((node) => node.tools));
  return graph.nodes.find((node) => node.labels.some((label) => label.toUpperCase() === "DANGEROUS"))
    ?? graph.nodes.find((node) => Boolean(node.metadata.name && toolNames.has(node.metadata.name)))
    ?? graph.nodes.find((node) => node.node_type === "TOOL");
}

function findGraphNodeForTopologyNode(graph: ProjectionAttackGraph, node: TopologyNode) {
  return graph.nodes.find((item) => item.node_id === node.id)
    ?? graph.nodes.find((item) => normalize(item.metadata.role) === normalize(node.role));
}

export function orderTopologyNodes(topology: AgentTopology) {
  if (topology.nodes.length === 0) return [];
  const targets = new Set(topology.edges.map((edge) => edge.to_node));
  const start = topology.nodes.find((node) => !targets.has(node.id)) ?? topology.nodes[0];
  const ordered: TopologyNode[] = [];
  const visited = new Set<string>();
  let current: TopologyNode | undefined = start;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    ordered.push(current);
    const nextEdge = topology.edges.find((edge) => edge.from_node === current?.id && !visited.has(edge.to_node));
    current = nextEdge ? topology.nodes.find((node) => node.id === nextEdge.to_node) : undefined;
  }

  return ordered;
}

function createGraphNode(node: ProjectionGraphNode, role: "source" | "tool"): TopologyRiskChainNode {
  const name = node.metadata.name ?? node.node_id;
  const copy = GRAPH_NODE_COPY[name];
  return {
    caption: copy?.caption ?? node.metadata.description ?? node.labels.join(" / "),
    displayName: copy?.displayName ?? name,
    graphNodeId: node.node_id,
    id: node.node_id,
    labels: node.labels,
    nodeType: node.node_type,
    origin: "graph",
    role,
    trustBoundary: isExternal(node) ? "external" : "internal",
  };
}

function createTopologyNode(node: TopologyNode, graphNode: ProjectionGraphNode | undefined): TopologyRiskChainNode {
  const view = TOPOLOGY_ROLE_VIEW[node.role];
  return {
    ...view,
    caption: node.trust_boundary === "external" ? `${view.caption} · 外部边界` : view.caption,
    graphNodeId: graphNode?.node_id ?? node.id,
    id: node.id,
    labels: graphNode?.labels ?? [node.role, node.trust_boundary.toUpperCase()],
    origin: "topology",
    trustBoundary: node.trust_boundary,
  };
}

function findRealEdge(
  topology: AgentTopology,
  graph: ProjectionAttackGraph,
  source: TopologyRiskChainNode,
  target: TopologyRiskChainNode,
): TopologyRiskChainEdge | null {
  const topologyEdge = topology.edges.find((edge) => edge.from_node === source.id && edge.to_node === target.id);
  if (topologyEdge) {
    return {
      carriesUntrustedContent: topologyEdge.carries_untrusted_content,
      channel: topologyEdge.channel,
      description: `${formatChannel(topologyEdge.channel)}：${source.displayName} → ${target.displayName}`,
      id: `topology-${source.id}-${target.id}-${topologyEdge.channel}`,
      label: formatChannel(topologyEdge.channel),
      origin: "topology",
      sourceNodeId: source.id,
      targetNodeId: target.id,
    };
  }

  const graphEdge = graph.edges.find((edge) => edge.source_node_id === source.graphNodeId && edge.target_node_id === target.graphNodeId);
  if (!graphEdge) return null;
  return {
    carriesUntrustedContent: source.trustBoundary === "external" || graphEdge.edge_type.toUpperCase().includes("UNTRUSTED"),
    channel: graphEdge.edge_type.toLowerCase(),
    description: graphEdge.metadata?.description ?? `${source.displayName} → ${target.displayName}`,
    id: `graph-${graphEdge.edge_id}`,
    label: formatChannel(graphEdge.edge_type),
    origin: "graph",
    sourceNodeId: source.id,
    targetNodeId: target.id,
  };
}

export function createTopologyRiskChain({ attackGraph, findings = [], topology }: CreateTopologyRiskChainInput): TopologyRiskChain {
  if (!topology || topology.topology_type === "single") {
    return { dataState: "insufficient", reason: "当前 Agent 未接入多节点拓扑。", topologyType: topology?.topology_type ?? "single" };
  }
  if (!attackGraph) {
    return { dataState: "insufficient", reason: "攻击图谱暂不可用，无法补充拓扑上下文。", topologyType: topology.topology_type };
  }

  const riskPatternId = topology.topology_type === "planner_executor" ? "R5" : "R6";
  if (!(attackGraph.risk_path_ids ?? []).includes(riskPatternId)) {
    return { dataState: "insufficient", reason: "攻击图谱未登记该拓扑的风险路径。", topologyType: topology.topology_type };
  }

  const entry = findEntryNode(attackGraph);
  const sink = findSinkNode(attackGraph, topology);
  const topologyNodes = orderTopologyNodes(topology);
  if (!entry || !sink || topologyNodes.length !== topology.nodes.length) {
    return { dataState: "insufficient", reason: "拓扑与攻击图谱未同时返回完整节点。", topologyType: topology.topology_type };
  }

  const nodes = [
    createGraphNode(entry, "source"),
    ...topologyNodes.map((node) => createTopologyNode(node, findGraphNodeForTopologyNode(attackGraph, node))),
    createGraphNode(sink, "tool"),
  ];
  if (new Set(nodes.map((node) => node.id)).size !== nodes.length) {
    return { dataState: "insufficient", reason: "拓扑节点在攻击图谱中重复出现，无法确定唯一链路。", topologyType: topology.topology_type };
  }

  const edges: TopologyRiskChainEdge[] = [];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const edge = findRealEdge(topology, attackGraph, nodes[index], nodes[index + 1]);
    if (!edge) {
      return { dataState: "insufficient", reason: "拓扑与攻击图谱未同时返回完整连线。", topologyType: topology.topology_type };
    }
    edges.push(edge);
  }

  return {
    dataState: "ready",
    edges,
    nodes,
    riskPatternId,
    status: findings.some((finding) => finding.risk_pattern_id === riskPatternId) ? "verified" : "potential",
    topologyType: topology.topology_type,
  };
}
