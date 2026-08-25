import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../../../lib/server/backend";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ evaluationId: string; callId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { evaluationId, callId } = await context.params;
  const body = await request.text();
  try {
    const upstream = await fetch(
      buildAgentEvalBackendUrl(
        `/evaluations/${encodeURIComponent(evaluationId)}/confirmations/${encodeURIComponent(callId)}`,
      ),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
        cache: "no-store",
        signal: request.signal,
      },
    );
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
