import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../lib/server/backend";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const upstream = await fetch(buildAgentEvalBackendUrl("/topology/presets"), {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      method: "GET",
      signal: request.signal,
    });

    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
