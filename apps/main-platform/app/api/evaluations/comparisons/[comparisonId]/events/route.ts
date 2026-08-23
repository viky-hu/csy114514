import { backendUnavailableResponse, buildAgentEvalBackendUrl, forwardEventStream } from "../../../../../lib/server/backend";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ comparisonId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { comparisonId } = await context.params;
  const url = new URL(buildAgentEvalBackendUrl(`/evaluations/comparisons/${encodeURIComponent(comparisonId)}/events`));
  const after = new URL(request.url).searchParams.get("after");
  if (after) url.searchParams.set("after", after);
  try {
    const upstream = await fetch(url, { headers: { Accept: "text/event-stream", "Last-Event-ID": request.headers.get("Last-Event-ID") || "" }, cache: "no-store", signal: request.signal });
    return forwardEventStream(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
