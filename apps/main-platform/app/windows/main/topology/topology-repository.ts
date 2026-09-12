import type {
  AgentTopology,
  SetTopologyRequest,
  TopologyEdge,
  TopologyNode,
  TopologyNodeRole,
  TopologyPreset,
  TopologyTrustBoundary,
  TopologyType,
} from "./topology-types.ts";
import { TOPOLOGY_TYPES } from "./topology-types.ts";

export type TopologyRequestOptions = {
  signal?: AbortSignal;
};

export type TopologyRepositoryResult = {
  errorMessage?: string;
  source: "api" | "mock";
  topology: AgentTopology;
};

export interface TopologyRepository {
  loadAgentTopology(
    agentId: string,
    options?: TopologyRequestOptions,
  ): Promise<TopologyRepositoryResult>;
  loadPresets(options?: TopologyRequestOptions): Promise<TopologyPreset[]>;
  saveAgentTopology(
    agentId: string,
    topologyType: TopologyType,
    options?: TopologyRequestOptions,
  ): Promise<AgentTopology>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type ApiTopologyRepositoryOptions = {
  fallback?: TopologyRepository;
  fetcher?: Fetcher;
};

const FALLBACK_PRESETS: TopologyPreset[] = [
  {
    description: "Single agent with multiple tools — current standard architecture",
    edge_count: 0,
    node_count: 1,
    topology_type: "single",
  },
  {
    description: "Planner-Executor — task planning separated from execution",
    edge_count: 1,
    node_count: 2,
    topology_type: "planner_executor",
  },
  {
    description: "RAG-Agent — retrieval-augmented generation with knowledge base",
    edge_count: 2,
    node_count: 3,
    topology_type: "rag_agent",
  },
];

const FALLBACK_TOPOLOGIES: Record<TopologyType, Omit<AgentTopology, "agent_id">> = {
  planner_executor: {
    edges: [
      {
        carries_untrusted_content: true,
        channel: "task_plan",
        from_node: "planner",
        to_node: "executor",
      },
    ],
    nodes: [
      {
        id: "planner",
        role: "PLANNER",
        tools: [],
        trust_boundary: "internal",
      },
      {
        id: "executor",
        role: "EXECUTOR",
        tools: ["email.send", "memory.write", "browser.open_page"],
        trust_boundary: "internal",
      },
    ],
    topology_type: "planner_executor",
  },
  rag_agent: {
    edges: [
      {
        carries_untrusted_content: true,
        channel: "retrieval",
        from_node: "knowledge_base",
        to_node: "retriever",
      },
      {
        carries_untrusted_content: true,
        channel: "retrieval",
        from_node: "retriever",
        to_node: "agent",
      },
    ],
    nodes: [
      {
        id: "retriever",
        role: "RETRIEVER",
        tools: [],
        trust_boundary: "internal",
      },
      {
        id: "knowledge_base",
        role: "KNOWLEDGE_BASE",
        tools: [],
        trust_boundary: "external",
      },
      {
        id: "agent",
        role: "AGENT",
        tools: ["email.send", "memory.write"],
        trust_boundary: "internal",
      },
    ],
    topology_type: "rag_agent",
  },
  single: {
    edges: [],
    nodes: [
      {
        id: "agent",
        role: "AGENT",
        tools: [],
        trust_boundary: "internal",
      },
    ],
    topology_type: "single",
  },
};

function cloneNode(node: TopologyNode): TopologyNode {
  return { ...node, tools: [...node.tools] };
}

function cloneEdge(edge: TopologyEdge): TopologyEdge {
  return { ...edge };
}

export function createFallbackTopology(
  agentId: string,
  topologyType: TopologyType = "single",
): AgentTopology {
  const topology = FALLBACK_TOPOLOGIES[topologyType];

  return {
    agent_id: agentId,
    edges: topology.edges.map(cloneEdge),
    nodes: topology.nodes.map(cloneNode),
    topology_type: topology.topology_type,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTopologyType(value: unknown): value is TopologyType {
  return typeof value === "string" && TOPOLOGY_TYPES.includes(value as TopologyType);
}

function isTopologyNodeRole(value: unknown): value is TopologyNodeRole {
  return (
    value === "AGENT" ||
    value === "EXECUTOR" ||
    value === "KNOWLEDGE_BASE" ||
    value === "PLANNER" ||
    value === "RETRIEVER"
  );
}

function isTrustBoundary(value: unknown): value is TopologyTrustBoundary {
  return value === "external" || value === "internal";
}

function isTopologyNode(value: unknown): value is TopologyNode {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isTopologyNodeRole(value.role) &&
    isTrustBoundary(value.trust_boundary) &&
    Array.isArray(value.tools) &&
    value.tools.every((tool) => typeof tool === "string")
  );
}

function isTopologyEdge(value: unknown): value is TopologyEdge {
  return (
    isRecord(value) &&
    typeof value.from_node === "string" &&
    typeof value.to_node === "string" &&
    typeof value.channel === "string" &&
    typeof value.carries_untrusted_content === "boolean"
  );
}

function isAgentTopology(value: unknown): value is AgentTopology {
  return (
    isRecord(value) &&
    typeof value.agent_id === "string" &&
    isTopologyType(value.topology_type) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isTopologyNode) &&
    Array.isArray(value.edges) &&
    value.edges.every(isTopologyEdge)
  );
}

function isTopologyPreset(value: unknown): value is TopologyPreset {
  return (
    isRecord(value) &&
    isTopologyType(value.topology_type) &&
    typeof value.description === "string" &&
    typeof value.node_count === "number" &&
    typeof value.edge_count === "number"
  );
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (!isRecord(payload)) {
    return fallback;
  }

  const error = payload.error;
  if (isRecord(error) && typeof error.message === "string") {
    return error.message;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  if (typeof payload.detail === "string") {
    return payload.detail;
  }

  return fallback;
}

export class MockTopologyRepository implements TopologyRepository {
  async loadAgentTopology(agentId: string): Promise<TopologyRepositoryResult> {
    return {
      source: "mock",
      topology: createFallbackTopology(agentId),
    };
  }

  async loadPresets(): Promise<TopologyPreset[]> {
    return FALLBACK_PRESETS.map((preset) => ({ ...preset }));
  }

  async saveAgentTopology(
    agentId: string,
    topologyType: TopologyType,
  ): Promise<AgentTopology> {
    return createFallbackTopology(agentId, topologyType);
  }
}

export class ApiTopologyRepository implements TopologyRepository {
  private readonly fallback: TopologyRepository;
  private readonly fetcher: Fetcher;

  constructor({
    fallback = new MockTopologyRepository(),
    fetcher = (input, init) => fetch(input, init),
  }: ApiTopologyRepositoryOptions = {}) {
    this.fallback = fallback;
    this.fetcher = fetcher;
  }

  async loadAgentTopology(
    agentId: string,
    options: TopologyRequestOptions = {},
  ): Promise<TopologyRepositoryResult> {
    try {
      const response = await this.fetcher(
        `/api/topology/${encodeURIComponent(agentId)}`,
        {
          headers: { Accept: "application/json" },
          method: "GET",
          signal: options.signal,
        },
      );
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        return this.loadFallback(
          agentId,
          getErrorMessage(payload, "Topology backend is not connected."),
        );
      }

      if (!isAgentTopology(payload)) {
        return this.loadFallback(
          agentId,
          "Invalid topology payload returned by backend.",
        );
      }

      return { source: "api", topology: payload };
    } catch {
      return this.loadFallback(agentId, "Topology backend is not connected.");
    }
  }

  async loadPresets(
    options: TopologyRequestOptions = {},
  ): Promise<TopologyPreset[]> {
    try {
      const response = await this.fetcher("/api/topology/presets", {
        headers: { Accept: "application/json" },
        method: "GET",
        signal: options.signal,
      });
      const payload = (await response.json()) as unknown;

      if (response.ok && Array.isArray(payload) && payload.every(isTopologyPreset)) {
        return payload;
      }
    } catch {
      // The local presets keep the configuration workspace usable offline.
    }

    return this.fallback.loadPresets(options);
  }

  async saveAgentTopology(
    agentId: string,
    topologyType: TopologyType,
    options: TopologyRequestOptions = {},
  ): Promise<AgentTopology> {
    const request: SetTopologyRequest = { preset_name: topologyType };
    const response = await this.fetcher(
      `/api/topology/${encodeURIComponent(agentId)}`,
      {
        body: JSON.stringify(request),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
        signal: options.signal,
      },
    );
    const payload = (await response.json()) as unknown;

    if (!response.ok) {
      throw new Error(getErrorMessage(payload, "Unable to save topology."));
    }

    if (!isAgentTopology(payload)) {
      throw new Error("Invalid topology payload returned by backend.");
    }

    return payload;
  }

  private async loadFallback(
    agentId: string,
    errorMessage: string,
  ): Promise<TopologyRepositoryResult> {
    const result = await this.fallback.loadAgentTopology(agentId);

    return {
      ...result,
      errorMessage,
      source: "mock",
    };
  }
}

export const defaultTopologyRepository = new ApiTopologyRepository();

