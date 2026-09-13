import { forwardRedTeamJson } from "../../../../../lib/server/redteam-bff";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  return forwardRedTeamJson(request, `/redteam/runs/${encodeURIComponent(runId)}/report`);
}
