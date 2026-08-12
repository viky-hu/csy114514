import type { components } from "../../lib/contracts/backend-api";
import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../lib/server/backend.ts";

export const runtime = "nodejs";

type AgentManifest = components["schemas"]["AgentManifest"];

export async function POST(request: Request) {
  try {
    const manifest = (await request.json()) as AgentManifest;
    const upstream = await fetch(buildAgentEvalBackendUrl("/agents"), {
      body: JSON.stringify(manifest),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: request.signal,
    });

    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
