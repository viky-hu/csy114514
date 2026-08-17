import {
  accountAuthRequiredResponse,
  accountAuthUnavailableResponse,
  buildAccountAuthHeaders,
  buildAccountAuthUrl,
} from "../../../lib/server/account-auth.ts";
import { forwardJsonResponse } from "../../../lib/server/backend.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = buildAccountAuthUrl("/api/auth/password");
  if (!url) {
    return accountAuthUnavailableResponse();
  }
  if (!request.headers.get("authorization")) {
    return accountAuthRequiredResponse();
  }

  try {
    const body = JSON.stringify(await request.json());
    const upstream = await fetch(url, {
      body,
      cache: "no-store",
      headers: buildAccountAuthHeaders(request, "application/json"),
      method: "POST",
      signal: request.signal,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return accountAuthUnavailableResponse();
  }
}
