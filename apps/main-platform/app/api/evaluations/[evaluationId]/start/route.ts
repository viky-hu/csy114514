import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../../lib/server/backend";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ evaluationId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { evaluationId } = await context.params;
  try {
    const upstream = await fetch(
      buildAgentEvalBackendUrl(
        `/evaluations/${encodeURIComponent(evaluationId)}/start`,
      ),
      {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: request.signal,
      },
    );
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
