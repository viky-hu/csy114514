import { forwardRedTeamEvents } from "../../../../../lib/server/redteam-bff";

export const runtime = "nodejs";
type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const ticket = url.searchParams.get("ticket");
  return forwardRedTeamEvents(
    request,
    `/redteam/runs/${encodeURIComponent(runId)}/events${after ? `?after=${encodeURIComponent(after)}` : ""}`,
    ticket,
  );
}
