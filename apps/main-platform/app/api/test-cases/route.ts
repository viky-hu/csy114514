import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../lib/server/backend.ts";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const upstream = await fetch(buildAgentEvalBackendUrl("/test-cases"), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: request.signal,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
