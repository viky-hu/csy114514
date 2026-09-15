import type { TopologyRiskChain } from "./topology-projection";

type ReadyTopologyRiskChain = Extract<TopologyRiskChain, { dataState: "ready" }>;

export type TopologyRiskRailTone = "neutral" | "channel" | "danger" | "potential" | "verified";

export type TopologyRiskRailSegment = {
  id: "entry" | "channel" | "impact" | "status";
  label: string;
  value: string;
  tone: TopologyRiskRailTone;
  relatedNodeIds: string[];
  relatedEdgeIds: string[];
};

export type TopologyRiskRailModel = {
  riskPatternId: ReadyTopologyRiskChain["riskPatternId"];
  status: ReadyTopologyRiskChain["status"];
  segments: TopologyRiskRailSegment[];
  primaryAction: "开始拓扑测评";
  secondaryAction: "进入攻击图谱";
};

function getNode(chain: ReadyTopologyRiskChain, role: ReadyTopologyRiskChain["nodes"][number]["role"]) {
  return chain.nodes.find((node) => node.role === role);
}

function getEdge(chain: ReadyTopologyRiskChain, channel: string) {
  return chain.edges.find((edge) => edge.channel.toLowerCase() === channel);
}

function getEdges(chain: ReadyTopologyRiskChain, channels: string[]) {
  const channelSet = new Set(channels);
  return chain.edges.filter((edge) => channelSet.has(edge.channel.toLowerCase()));
}

export function createTopologyRiskRailModel(chain: ReadyTopologyRiskChain): TopologyRiskRailModel {
  const source = getNode(chain, "source");
  const tool = getNode(chain, "tool");
  const isPlannerExecutor = chain.riskPatternId === "R5";
  const channelEdges = isPlannerExecutor
    ? (getEdge(chain, "task_plan") ? [getEdge(chain, "task_plan")!] : [])
    : getEdges(chain, ["retrieval", "context"]);
  const channelNodes = channelEdges.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]);
  const statusValue = chain.status === "verified" ? "结构命中 · 已验证" : "结构命中 · 待验证";

  return {
    riskPatternId: chain.riskPatternId,
    status: chain.status,
    segments: [
      {
        id: "entry",
        label: "风险入口",
        value: isPlannerExecutor ? "外部输入" : "外部文档",
        tone: "neutral",
        relatedNodeIds: source ? [source.id] : [],
        relatedEdgeIds: chain.edges[0] ? [chain.edges[0].id] : [],
      },
      {
        id: "channel",
        label: "关键通道",
        value: isPlannerExecutor ? "task_plan" : "retrieval / context",
        tone: "channel",
        relatedNodeIds: [...new Set(channelNodes)],
        relatedEdgeIds: channelEdges.map((edge) => edge.id),
      },
      {
        id: "impact",
        label: "风险结果",
        value: isPlannerExecutor ? "计划污染 → 危险工具" : "上下文投毒 → 危险工具",
        tone: "danger",
        relatedNodeIds: [...new Set([...(channelNodes.slice(-1)), ...(tool ? [tool.id] : [])])],
        relatedEdgeIds: chain.edges.slice(Math.max(0, chain.edges.length - 2)).map((edge) => edge.id),
      },
      {
        id: "status",
        label: "验证状态",
        value: statusValue,
        tone: chain.status === "verified" ? "verified" : "potential",
        relatedNodeIds: [],
        relatedEdgeIds: [],
      },
    ],
    primaryAction: "开始拓扑测评",
    secondaryAction: "进入攻击图谱",
  };
}
