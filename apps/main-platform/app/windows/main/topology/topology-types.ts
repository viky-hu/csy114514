export const TOPOLOGY_TYPES = [
  "single",
  "planner_executor",
  "rag_agent",
] as const;

export type TopologyType = (typeof TOPOLOGY_TYPES)[number];
export type TopologyNodeRole =
  | "AGENT"
  | "EXECUTOR"
  | "KNOWLEDGE_BASE"
  | "PLANNER"
  | "RETRIEVER";
export type TopologyTrustBoundary = "external" | "internal";

export type TopologyNode = {
  id: string;
  role: TopologyNodeRole;
  tools: string[];
  trust_boundary: TopologyTrustBoundary;
};

export type TopologyEdge = {
  carries_untrusted_content: boolean;
  channel: string;
  from_node: string;
  to_node: string;
};

export type AgentTopology = {
  agent_id: string;
  edges: TopologyEdge[];
  nodes: TopologyNode[];
  topology_type: TopologyType;
};

export type TopologyPreset = {
  description: string;
  edge_count: number;
  node_count: number;
  topology_type: TopologyType;
};

export type SetTopologyRequest = {
  preset_name: TopologyType;
};
