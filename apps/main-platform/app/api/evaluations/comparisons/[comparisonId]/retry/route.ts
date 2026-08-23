import { backendUnavailableResponse, buildAgentEvalBackendUrl, forwardJsonResponse } from "../../../../../lib/server/backend";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ comparisonId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { comparisonId } = await context.params;
  try {
    const upstream = await fetch(buildAgentEvalBackendUrl(`/evaluations/comparisons/${encodeURIComponent(comparisonId)}/retry`), { method: "POST", body: await request.text(), headers: { "Content-Type": request.headers.get("content-type") || "application/json", Accept: "application/json" }, cache: "no-store", signal: request.signal });
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
