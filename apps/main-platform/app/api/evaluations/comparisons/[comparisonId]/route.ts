import { backendUnavailableResponse, buildAgentEvalBackendUrl, forwardJsonResponse } from "../../../../lib/server/backend";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ comparisonId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { comparisonId } = await context.params;
  try {
    const upstream = await fetch(buildAgentEvalBackendUrl(`/evaluations/comparisons/${encodeURIComponent(comparisonId)}`), { headers: { Accept: "application/json" }, cache: "no-store", signal: request.signal });
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
