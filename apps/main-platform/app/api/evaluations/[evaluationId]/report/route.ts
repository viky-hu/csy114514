import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../../lib/server/backend";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ evaluationId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { evaluationId } = await context.params;
  const upstreamUrl = buildAgentEvalBackendUrl(
    `/evaluations/${encodeURIComponent(evaluationId)}/report`,
  );

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
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
