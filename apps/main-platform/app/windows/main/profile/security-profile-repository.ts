import {
  createSecurityProfileViewModel,
  type SecurityProfileInput,
  type SecurityProfileViewModel,
} from "./security-profile-data";

export type SecurityProfileRepositoryResult = {
  errorMessage?: string;
  source: "api" | "mock";
  viewModel: SecurityProfileViewModel;
};

export interface SecurityProfileRepository {
  load(agentId: string): Promise<SecurityProfileRepositoryResult>;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type ApiSecurityProfileRepositoryOptions = {
  fallback: SecurityProfileRepository;
  fetcher?: Fetcher;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isAgentProfilePayload(value: unknown): value is SecurityProfileInput["agentProfile"] {
  return (
    isRecord(value) &&
    typeof value.agent_id === "string" &&
    isRecord(value.manifest) &&
    isRecord(value.capability_profile) &&
    isRecord(value.security_assets)
  );
}

function isAttackGraphPayload(value: unknown): value is SecurityProfileInput["attackGraph"] {
  return isRecord(value) && Array.isArray(value.nodes);
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

export class MockSecurityProfileRepository implements SecurityProfileRepository {
  private readonly fallbackViewModel: SecurityProfileViewModel;

  constructor(fallbackViewModel: SecurityProfileViewModel) {
    this.fallbackViewModel = fallbackViewModel;
  }

  async load(): Promise<SecurityProfileRepositoryResult> {
    return {
      source: "mock",
      viewModel: this.fallbackViewModel,
    };
  }
}

export class ApiSecurityProfileRepository implements SecurityProfileRepository {
  private readonly fallback: SecurityProfileRepository;
  private readonly fetcher: Fetcher;

  constructor({
    fallback,
    fetcher = (input, init) => fetch(input, init),
  }: ApiSecurityProfileRepositoryOptions) {
    this.fallback = fallback;
    this.fetcher = fetcher;
  }

  async load(agentId: string): Promise<SecurityProfileRepositoryResult> {
    try {
      const [profileResponse, graphResponse] = await Promise.all([
        this.fetcher(`/api/agents/${encodeURIComponent(agentId)}`, {
          headers: { Accept: "application/json" },
          method: "GET",
        }),
        this.fetcher(`/api/agents/${encodeURIComponent(agentId)}/graph`, {
          headers: { Accept: "application/json" },
          method: "GET",
        }),
      ]);
      const [profilePayload, graphPayload] = (await Promise.all([
        profileResponse.json(),
        graphResponse.json(),
      ])) as [unknown, unknown];

      if (!profileResponse.ok || !graphResponse.ok) {
        return this.loadFallback(
          agentId,
          getErrorMessage(profilePayload, "Security profile backend is not connected."),
        );
      }

      if (!isAgentProfilePayload(profilePayload) || !isAttackGraphPayload(graphPayload)) {
        return this.loadFallback(
          agentId,
          "Invalid security profile payload returned by backend.",
        );
      }

      return {
        source: "api",
        viewModel: createSecurityProfileViewModel({
          agentProfile: profilePayload,
          attackGraph: graphPayload,
        }),
      };
    } catch {
      return this.loadFallback(agentId, "Security profile backend is not connected.");
    }
  }

  private async loadFallback(
    agentId: string,
    errorMessage: string,
  ): Promise<SecurityProfileRepositoryResult> {
    const result = await this.fallback.load(agentId);

    return {
      ...result,
      errorMessage,
      source: "mock",
    };
  }
}