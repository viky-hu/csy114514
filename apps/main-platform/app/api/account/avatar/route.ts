import {
  accountAuthRequiredResponse,
  accountAuthUnavailableResponse,
  buildAccountAuthHeaders,
  buildAccountAuthUrl,
} from "../../../lib/server/account-auth.ts";
import { forwardJsonResponse } from "../../../lib/server/backend.ts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const url = buildAccountAuthUrl("/api/auth/avatar");
  if (!url) {
    return accountAuthUnavailableResponse();
  }
  if (!request.headers.get("authorization")) {
    return accountAuthRequiredResponse();
  }

  try {
    const upstream = await fetch(url, {
      body: await request.arrayBuffer(),
      cache: "no-store",
      headers: buildAccountAuthHeaders(request, request.headers.get("content-type") || undefined),
      method: "POST",
      signal: request.signal,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return accountAuthUnavailableResponse();
  }
}

export async function DELETE(request: Request) {
  const url = buildAccountAuthUrl("/api/auth/avatar");
  if (!url) {
    return accountAuthUnavailableResponse();
  }
  if (!request.headers.get("authorization")) {
    return accountAuthRequiredResponse();
  }

  try {
    const upstream = await fetch(url, {
      cache: "no-store",
      headers: buildAccountAuthHeaders(request),
      method: "DELETE",
      signal: request.signal,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return accountAuthUnavailableResponse();
  }
}
