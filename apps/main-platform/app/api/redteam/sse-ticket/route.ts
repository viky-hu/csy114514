import { createRedTeamSseTicket } from "../../../lib/server/redteam-bff";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const result = await createRedTeamSseTicket(request);
  return result instanceof Response ? result : Response.json(result, { status: 201 });
}
