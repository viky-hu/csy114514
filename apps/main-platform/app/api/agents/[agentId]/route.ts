import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../lib/server/backend.ts";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ agentId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { agentId } = await context.params;

  try {
    const upstream = await fetch(
      buildAgentEvalBackendUrl(`/agents/${encodeURIComponent(agentId)}`),
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        method: "GET",
        signal: request.signal,
      },
    );

    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
