import type { AgentTopology, TopologyNodeRole } from "../topology/topology-types";
import {
  getAnatomyNodeRole,
  type AnatomyPath,
  type AnatomyPathStep,
} from "./anatomy-data.ts";

/**
 * The negative-strategy anatomy stage draws a risk path on the mature five-phase
 * rail. In topology mode (R5 planner_executor / R6 rag_agent) the chain is not
 * invented from the risk pattern: the middle nodes come from the real topology
 * fetched for the Agent, and the two end nodes come from the real attack-graph
 * nodes the risk path starts and ends with. Every drawn node therefore exists in
 * backend data, and every drawn channel is a real topology edge. When the data is
 * incomplete the plan resolves to `missing` and the stage renders an explicit
 * "path data insufficient" notice instead of a fabricated chain.
 */

export type TopologyChainGraphNode = {
  labels: string[];
  metadata: {
    description?: string;
    name?: string;
    role?: string;
  };
  node_id: string;
  node_type: string;
};

export type TopologyChainNodeView = {
  caption: string;
  displayName: string;
  nodeId: string;
  origin: "graph" | "topology";
  role: AnatomyPathStep["role"];
  trustBoundary: "external" | "internal";
};

export type TopologyChainChannelView = {
  label: string;
  untrusted: boolean;
};

export type TopologyChainPlan =
  | {
      channels: Array<TopologyChainChannelView | null>;
      kind: "ready";
      nodes: TopologyChainNodeView[];
    }
  | {
      kind: "missing";
      missing: string[];
      reason: string;
    };

const TOPOLOGY_ROLE_VIEW: Record<
  TopologyNodeRole,
  { caption: string; displayName: string; role: AnatomyPathStep["role"] }
> = {
  AGENT: {
    caption: "组装上下文并决策",
    displayName: "主 Agent",
    role: "agent",
  },
  EXECUTOR: {
    caption: "执行计划中的动作",
    displayName: "任务执行",
    role: "executor",
  },
  KNOWLEDGE_BASE: {
    caption: "外部信任边界",
    displayName: "知识库",
    role: "knowledge_base",
  },
  PLANNER: {
    caption: "接收不可信内容",
    displayName: "任务规划",
    role: "planner",
  },
  RETRIEVER: {
    caption: "检索知识库内容",
    displayName: "上下文检索",
    role: "retriever",
  },
};

const GRAPH_NODE_VIEW: Record<string, { caption: string; displayName: string }> = {
  "browser.open_page": { caption: "不可信网页输入", displayName: "恶意网页" },
  "email.send": { caption: "对外发送动作", displayName: "发送邮件" },
};

function formatChannelLabel(channel: string) {
  return channel.toUpperCase().replaceAll("_", " ");
}

function getTrustBoundary(labels: string[], fallback: "external" | "internal") {
  const normalized = labels.map((label) => label.toUpperCase());

  if (normalized.includes("UNTRUSTED") || normalized.includes("EXTERNAL")) {
    return "external" as const;
  }

  return fallback;
}

/**
 * Orders topology nodes into a single chain by following real edges, starting at
 * the node that no edge points at. Cycles and forks stop the walk instead of
 * inventing a route.
 */
export function orderTopologyChainNodes(topology: AgentTopology) {
  const { edges, nodes } = topology;

  if (nodes.length === 0) {
    return [];
  }

  const targetIds = new Set(edges.map((edge) => edge.to_node));
  const startNode =
    nodes.find((node) => !targetIds.has(node.id)) ?? nodes[0];
  const ordered: typeof nodes = [];
  const visited = new Set<string>();
  let current = startNode;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    ordered.push(current);
    const next = edges.find(
      (edge) => edge.from_node === current.id && !visited.has(edge.to_node),
    );

    if (!next) {
      break;
    }

    const nextNode = nodes.find((node) => node.id === next.to_node);

    if (!nextNode) {
      break;
    }

    current = nextNode;
  }

  return ordered;
}

function resolveGraphNode(
  graphNodes: TopologyChainGraphNode[],
  step: AnatomyPathStep,
) {
  const byId = graphNodes.find((node) => node.node_id === step.id);

  if (byId) {
    return byId;
  }

  // The step id falls back to a label when the fixture omitted node_id, so a
  // real node is still recognized by its own name - never by a guessed role.
  return graphNodes.find((node) => node.metadata.name === step.label);
}

function createGraphNodeView(
  node: TopologyChainGraphNode,
  step: AnatomyPathStep,
): TopologyChainNodeView {
  const curated = node.metadata.name
    ? GRAPH_NODE_VIEW[node.metadata.name]
    : undefined;
  const displayName =
    curated?.displayName ?? node.metadata.name ?? step.label;

  return {
    caption: curated?.caption ?? node.labels.join(" / "),
    displayName,
    nodeId: node.node_id,
    origin: "graph",
    role: getAnatomyNodeRole(node),
    trustBoundary: getTrustBoundary(node.labels, "internal"),
  };
}

function createTopologyNodeView(node: AgentTopology["nodes"][number]): TopologyChainNodeView {
  const view = TOPOLOGY_ROLE_VIEW[node.role];

  return {
    caption:
      node.trust_boundary === "external"
        ? `${view.caption} · 外部`
        : view.caption,
    displayName: view.displayName,
    nodeId: node.id,
    origin: "topology",
    role: view.role,
    trustBoundary: node.trust_boundary,
  };
}

function findChannel(
  topology: AgentTopology,
  fromNodeId: string,
  toNodeId: string,
): TopologyChainChannelView | null {
  const edge =
    topology.edges.find(
      (item) => item.from_node === fromNodeId && item.to_node === toNodeId,
    ) ??
    topology.edges.find(
      (item) => item.from_node === toNodeId && item.to_node === fromNodeId,
    );

  if (!edge) {
    return null;
  }

  return {
    label: formatChannelLabel(edge.channel),
    untrusted: edge.carries_untrusted_content,
  };
}

export function planTopologyChain(input: {
  graphNodes: TopologyChainGraphNode[];
  path: AnatomyPath | null;
  topology: AgentTopology | undefined;
}): TopologyChainPlan {
  const { graphNodes, path, topology } = input;

  if (!topology || topology.topology_type === "single") {
    return {
      kind: "missing",
      missing: [],
      reason: "当前 Agent 未接入多节点拓扑。",
    };
  }

  if (!path || path.steps.length < 2) {
    return {
      kind: "missing",
      missing: [],
      reason: "攻击图谱未登记该拓扑的风险路径。",
    };
  }

  const chainNodes = orderTopologyChainNodes(topology);

  if (chainNodes.length === 0) {
    return {
      kind: "missing",
      missing: [],
      reason: "拓扑接口未返回节点。",
    };
  }

  const entryStep = path.steps[0];
  const sinkStep = path.steps[path.steps.length - 1];
  const entryNode = resolveGraphNode(graphNodes, entryStep);
  const sinkNode = resolveGraphNode(graphNodes, sinkStep);
  const missing: string[] = [];

  if (!entryNode) {
    missing.push(entryStep.label);
  }

  if (!sinkNode) {
    missing.push(sinkStep.label);
  }

  if (!entryNode || !sinkNode) {
    return {
      kind: "missing",
      missing,
      reason: "拓扑与攻击图谱未同时返回完整节点。",
    };
  }

  const nodes = [
    createGraphNodeView(entryNode, entryStep),
    ...chainNodes.map(createTopologyNodeView),
    createGraphNodeView(sinkNode, sinkStep),
  ];
  const nodeIds = new Set(nodes.map((node) => node.nodeId));

  if (nodeIds.size !== nodes.length) {
    return {
      kind: "missing",
      missing: [],
      reason: "拓扑节点在攻击图谱中重复出现，无法确定唯一链路。",
    };
  }

  const channels: Array<TopologyChainChannelView | null> = [];

  for (let index = 0; index < nodes.length - 1; index += 1) {
    channels.push(findChannel(topology, nodes[index].nodeId, nodes[index + 1].nodeId));
  }

  return { channels, kind: "ready", nodes };
}
