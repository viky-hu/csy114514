import { forwardRedTeamJson } from "../../../lib/server/redteam-bff";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const agentId = new URL(request.url).searchParams.get("agent_id");
  return forwardRedTeamJson(request, `/redteam/connections${agentId ? `?agent_id=${encodeURIComponent(agentId)}` : ""}`);
}

export async function POST(request: Request) {
  return forwardRedTeamJson(request, "/redteam/connections", {
    body: await request.text(),
    headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
    method: "POST",
  });
}
