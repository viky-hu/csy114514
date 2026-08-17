import {
  accountAuthRequiredResponse,
  accountAuthUnavailableResponse,
  buildAccountAuthHeaders,
  buildAccountAuthUrl,
} from "../../../lib/server/account-auth.ts";
import { forwardJsonResponse } from "../../../lib/server/backend.ts";

export const runtime = "nodejs";

async function proxyProfile(request: Request, method: "GET" | "PATCH") {
  const url = buildAccountAuthUrl("/api/auth/profile");
  if (!url) {
    return accountAuthUnavailableResponse();
  }
  if (!request.headers.get("authorization")) {
    return accountAuthRequiredResponse();
  }

  try {
    const body = method === "PATCH" ? JSON.stringify(await request.json()) : undefined;
    const upstream = await fetch(url, {
      body,
      cache: "no-store",
      headers: buildAccountAuthHeaders(request, body ? "application/json" : undefined),
      method,
      signal: request.signal,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return accountAuthUnavailableResponse();
  }
}

export async function GET(request: Request) {
  return proxyProfile(request, "GET");
}

export async function PATCH(request: Request) {
  return proxyProfile(request, "PATCH");
}
