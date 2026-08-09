import type {
  AnatomyInput,
  AnatomyViewModel,
} from "./anatomy-data.ts";
import { createAnatomyViewModel } from "./anatomy-data.ts";
import {
  DEFAULT_ANATOMY_AGENT_ID,
  anatomyPreviewInput,
} from "./anatomy-fixtures.ts";

export type AnatomyRepositoryLoadParams = {
  agentId: string;
  selectedPathId?: string;
};

export type AnatomyRepositoryResult = {
  errorMessage?: string;
  source: "api" | "mock";
  viewModel: AnatomyViewModel;
};

export interface AnatomyRepository {
  load(params: AnatomyRepositoryLoadParams): Promise<AnatomyRepositoryResult>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
type AttackGraphPayload = AnatomyInput["attackGraph"];

type ApiAnatomyRepositoryOptions = {
  fallback?: AnatomyRepository;
  fetcher?: Fetcher;
};

function createPreviewViewModel(selectedPathId = "R4") {
  return createAnatomyViewModel({
    ...anatomyPreviewInput,
    selectedPathId,
  });
}

function createLiveViewModel(
  attackGraph: AttackGraphPayload,
  selectedPathId = "R4",
) {
  return createAnatomyViewModel({
    ...anatomyPreviewInput,
    attackGraph,
    evaluationReport: null,
    mode: "live",
    selectedPathId,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isGraphNode(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.node_id === "string" &&
    typeof value.node_type === "string" &&
    Array.isArray(value.labels) &&
    isRecord(value.metadata)
  );
}

function isGraphEdge(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.edge_id === "string" &&
    typeof value.edge_type === "string" &&
    typeof value.source_node_id === "string" &&
    typeof value.target_node_id === "string"
  );
}

function isAttackGraphPayload(value: unknown): value is AttackGraphPayload {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isGraphNode) &&
    (value.edges === undefined ||
      (Array.isArray(value.edges) && value.edges.every(isGraphEdge))) &&
    Array.isArray(value.risk_path_ids) &&
    value.risk_path_ids.every((pathId) => typeof pathId === "string")
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

  return fallback;
}

export class MockAnatomyRepository implements AnatomyRepository {
  async load({
    selectedPathId,
  }: AnatomyRepositoryLoadParams): Promise<AnatomyRepositoryResult> {
    return {
      source: "mock",
      viewModel: createPreviewViewModel(selectedPathId),
    };
  }
}

export class ApiAnatomyRepository implements AnatomyRepository {
  private readonly fallback: AnatomyRepository;
  private readonly fetcher: Fetcher;

  constructor({
    fallback = new MockAnatomyRepository(),
    fetcher = fetch,
  }: ApiAnatomyRepositoryOptions = {}) {
    this.fallback = fallback;
    this.fetcher = fetcher;
  }

  async load({
    agentId = DEFAULT_ANATOMY_AGENT_ID,
    selectedPathId,
  }: AnatomyRepositoryLoadParams): Promise<AnatomyRepositoryResult> {
    try {
      const response = await this.fetcher(
        `/api/agents/${encodeURIComponent(agentId)}/graph`,
        {
          headers: { Accept: "application/json" },
          method: "GET",
        },
      );
      const payload = (await response.json()) as unknown;

      if (!response.ok) {
        return this.loadFallback(
          { agentId, selectedPathId },
          getErrorMessage(payload, "Agent graph backend is not connected."),
        );
      }

      if (!isAttackGraphPayload(payload)) {
        return this.loadFallback(
          { agentId, selectedPathId },
          "Invalid attack graph payload returned by backend.",
        );
      }

      return {
        source: "api",
        viewModel: createLiveViewModel(payload, selectedPathId),
      };
    } catch {
      return this.loadFallback(
        { agentId, selectedPathId },
        "Agent graph backend is not connected.",
      );
    }
  }

  private async loadFallback(
    params: AnatomyRepositoryLoadParams,
    errorMessage: string,
  ): Promise<AnatomyRepositoryResult> {
    const result = await this.fallback.load(params);

    return {
      ...result,
      errorMessage,
      source: "mock",
    };
  }
}

export const defaultAnatomyRepository = new ApiAnatomyRepository();
