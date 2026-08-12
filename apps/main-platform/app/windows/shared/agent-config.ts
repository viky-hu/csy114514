import type { components } from "../../lib/contracts/backend-api";

export type AgentManifest = components["schemas"]["AgentManifest"];

export type HttpMethod = "GET" | "PATCH" | "POST" | "PUT";
export type Permission = "ALLOW" | "CONFIRM" | "DENY";
export type MemoryType = "ephemeral" | "none" | "persistent";

export type CapabilityDefinition = {
  defaultPermission?: Permission;
  labels?: Array<"DANGEROUS" | "PERSISTENT" | "SENSITIVE" | "UNTRUSTED">;
  name: string;
  nodeType?: "MEMORY" | "SOURCE" | "TOOL";
};

export type AgentProfilePayload = {
  agent_id: string;
  manifest: AgentManifest;
};

export type AgentDraftState = {
  agentId: string;
  agentName: string;
  endpoint: string;
  enabledCapabilities: Record<string, boolean>;
  enabledDataSources: Record<string, boolean>;
  headers: string;
  memoryMaxEntries: string;
  memoryType: MemoryType;
  method: HttpMethod;
  requestTemplate: string;
  responsePath: string;
  toolPermissions: Record<string, Permission>;
  version: string;
};

export const HTTP_METHODS: HttpMethod[] = ["POST", "GET", "PUT", "PATCH"];

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  { name: "chat" },
  {
    defaultPermission: "ALLOW",
    labels: ["UNTRUSTED"],
    name: "browser.open_page",
    nodeType: "SOURCE",
  },
  { defaultPermission: "ALLOW", name: "email.list", nodeType: "TOOL" },
  {
    defaultPermission: "ALLOW",
    labels: ["SENSITIVE"],
    name: "email.read",
    nodeType: "TOOL",
  },
  {
    defaultPermission: "CONFIRM",
    labels: ["DANGEROUS"],
    name: "email.send",
    nodeType: "TOOL",
  },
  {
    defaultPermission: "ALLOW",
    labels: ["PERSISTENT"],
    name: "memory.read",
    nodeType: "MEMORY",
  },
  {
    defaultPermission: "ALLOW",
    labels: ["PERSISTENT"],
    name: "memory.write",
    nodeType: "MEMORY",
  },
];

export const DATA_SOURCE_DEFINITIONS = ["browser", "email", "memory"] as const;
export const DEFAULT_AGENT_ID = "corpmate-v0";

export const DEFAULT_HEADERS = '{\n  "Content-Type": "application/json"\n}';
export const DEFAULT_REQUEST_TEMPLATE = '{\n  "message": "{{input}}"\n}';

export const TOOL_DEFINITIONS = CAPABILITY_DEFINITIONS.filter(
  (capability) => capability.defaultPermission,
);

export function createEnabledRecord(names: readonly string[], enabled = true) {
  return Object.fromEntries(names.map((name) => [name, enabled])) as Record<
    string,
    boolean
  >;
}

export function createPermissionRecord(
  entries?: Record<string, string>,
): Record<string, Permission> {
  return Object.fromEntries(
    TOOL_DEFINITIONS.map((capability) => {
      const current = entries?.[capability.name];
      const permission =
        current === "ALLOW" || current === "CONFIRM" || current === "DENY"
          ? current
          : capability.defaultPermission ?? "ALLOW";

      return [capability.name, permission];
    }),
  ) as Record<string, Permission>;
}

export const CORPMATE_AGENT_DRAFT: AgentDraftState = {
  agentId: DEFAULT_AGENT_ID,
  agentName: "CorpMate v0",
  endpoint: "http://127.0.0.1:8000/chat",
  enabledCapabilities: createEnabledRecord(
    CAPABILITY_DEFINITIONS.map((capability) => capability.name),
  ),
  enabledDataSources: createEnabledRecord(DATA_SOURCE_DEFINITIONS),
  headers: DEFAULT_HEADERS,
  memoryMaxEntries: "100",
  memoryType: "persistent",
  method: "POST",
  requestTemplate: DEFAULT_REQUEST_TEMPLATE,
  responsePath: "$.content",
  toolPermissions: createPermissionRecord(),
  version: "0.1.0",
};

export function parseAgentHeaders(value: string) {
  if (!value.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return "Headers must be a JSON object.";
    }

    return parsed as Record<string, unknown>;
  } catch {
    return "Headers JSON cannot be parsed.";
  }
}

export function buildAgentManifest(draft: AgentDraftState): AgentManifest {
  const capabilities = CAPABILITY_DEFINITIONS.filter(
    (capability) => draft.enabledCapabilities[capability.name],
  ).map((capability) => capability.name);
  const dataSources = DATA_SOURCE_DEFINITIONS.filter(
    (source) => draft.enabledDataSources[source],
  );
  const memoryLimit = Number.parseInt(draft.memoryMaxEntries, 10);
  const toolPermissions = Object.fromEntries(
    TOOL_DEFINITIONS.filter(
      (capability) => draft.enabledCapabilities[capability.name],
    ).map((capability) => [
      capability.name,
      draft.toolPermissions[capability.name] ?? capability.defaultPermission ?? "ALLOW",
    ]),
  );

  return {
    agent_id: draft.agentId.trim() || "agent-draft",
    capabilities,
    data_sources: dataSources,
    memory:
      draft.memoryType === "none"
        ? {}
        : {
            type: draft.memoryType,
            ...(Number.isFinite(memoryLimit) && memoryLimit > 0
              ? { max_entries: memoryLimit }
              : {}),
          },
    name: draft.agentName.trim() || "Unnamed Agent",
    tool_permissions: toolPermissions,
    version: draft.version.trim() || "0.1.0",
  };
}

export function createAgentDraftFromProfile(
  profile: AgentProfilePayload,
): AgentDraftState {
  const manifest = profile.manifest;
  const enabledCapabilities = createEnabledRecord(
    CAPABILITY_DEFINITIONS.map((capability) => capability.name),
    false,
  );
  const enabledDataSources = createEnabledRecord(DATA_SOURCE_DEFINITIONS, false);

  for (const capability of manifest.capabilities ?? []) {
    enabledCapabilities[capability] = true;
  }

  for (const source of manifest.data_sources ?? []) {
    enabledDataSources[source] = true;
  }

  const memory = manifest.memory ?? {};
  const memoryTypeValue = memory.type;
  const memoryType =
    memoryTypeValue === "ephemeral" || memoryTypeValue === "persistent"
      ? memoryTypeValue
      : "none";
  const maxEntries = memory.max_entries;

  return {
    ...CORPMATE_AGENT_DRAFT,
    agentId: manifest.agent_id || profile.agent_id,
    agentName: manifest.name,
    enabledCapabilities,
    enabledDataSources,
    memoryMaxEntries:
      typeof maxEntries === "number" && Number.isFinite(maxEntries)
        ? String(maxEntries)
        : CORPMATE_AGENT_DRAFT.memoryMaxEntries,
    memoryType,
    toolPermissions: createPermissionRecord(manifest.tool_permissions),
    version: manifest.version,
  };
}

export function getAgentDraftRiskAssets(draft: AgentDraftState) {
  const selectedCapabilities = CAPABILITY_DEFINITIONS.filter(
    (capability) => draft.enabledCapabilities[capability.name],
  );
  const selectedDataSources = DATA_SOURCE_DEFINITIONS.filter(
    (source) => draft.enabledDataSources[source],
  );

  return {
    dangerous_tools: selectedCapabilities
      .filter((capability) => capability.labels?.includes("DANGEROUS"))
      .map((capability) => capability.name),
    persistent_stores:
      draft.memoryType === "persistent" && selectedDataSources.includes("memory")
        ? ["memory"]
        : [],
    sensitive_tools: selectedCapabilities
      .filter((capability) => capability.labels?.includes("SENSITIVE"))
      .map((capability) => capability.name),
    untrusted_sources: selectedDataSources.includes("browser") ? ["browser"] : [],
  };
}
