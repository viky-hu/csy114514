import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../lib/server/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const upstream = await fetch(buildAgentEvalBackendUrl("/evaluations"), {
      method: "POST",
      body: await request.text(),
      headers: {
        "Content-Type": request.headers.get("content-type") || "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      signal: request.signal,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
