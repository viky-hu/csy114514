import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardEventStream,
} from "../../../../lib/server/backend";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ evaluationId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { evaluationId } = await context.params;
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(
    buildAgentEvalBackendUrl(
      `/evaluations/${encodeURIComponent(evaluationId)}/events`,
    ),
  );
  const after = incomingUrl.searchParams.get("after");
  if (after) upstreamUrl.searchParams.set("after", after);

  try {
    const lastEventId = request.headers.get("Last-Event-ID");
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "text/event-stream",
        ...(lastEventId ? { "Last-Event-ID": lastEventId } : {}),
      },
      cache: "no-store",
      signal: request.signal,
    });
    return forwardEventStream(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
