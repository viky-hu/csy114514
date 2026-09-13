import type { AgentManifest } from "../../shared/agent-config";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function getErrorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
}

export async function saveAgentManifest(
  manifest: AgentManifest,
  fetcher: Fetcher = (input, init) => fetch(input, init),
) {
  const response = await fetcher("/api/agents", {
    body: JSON.stringify(manifest),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(getErrorMessage(payload, "Agent 保存失败"));
  }
}
