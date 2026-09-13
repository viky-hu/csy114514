import { forwardRedTeamJson } from "../../../lib/server/redteam-bff";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return forwardRedTeamJson(request, "/redteam/runs");
}

export async function POST(request: Request) {
  return forwardRedTeamJson(request, "/redteam/runs", {
    body: await request.text(),
    headers: { "Content-Type": request.headers.get("content-type") || "application/json" },
    method: "POST",
  });
}
