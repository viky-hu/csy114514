import type { components } from "../../../lib/contracts/backend-api";

/**
 * Presentation aliases of the generated backend contract.  The repository
 * validates optional wire arrays before components receive these values.
 */
type WireAgentTopology = components["schemas"]["AgentTopology"];
type WireTopologyNode = components["schemas"]["TopologyNode"];

export type TopologyType = WireAgentTopology["topology_type"];
export type TopologyNodeRole = WireTopologyNode["role"];
export type TopologyTrustBoundary = WireTopologyNode["trust_boundary"];
export type TopologyEdge = components["schemas"]["TopologyEdge"];
export type TopologyNode = Omit<WireTopologyNode, "tools"> & {
  tools: NonNullable<WireTopologyNode["tools"]>;
};
export type AgentTopology = Omit<WireAgentTopology, "nodes" | "edges"> & {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
};
export type TopologyPreset = components["schemas"]["PresetSummary"];
export type SetTopologyRequest = components["schemas"]["SetTopologyRequest"];

export const TOPOLOGY_TYPES = [
  "single",
  "planner_executor",
  "rag_agent",
] as const satisfies readonly TopologyType[];
