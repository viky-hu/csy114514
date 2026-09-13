import { createHmac, timingSafeEqual } from "node:crypto";

import {
  accountAuthRequiredResponse,
  accountAuthUnavailableResponse,
  buildAccountAuthHeaders,
  buildAccountAuthUrl,
} from "./account-auth";
import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardEventStream,
  forwardJsonResponse,
} from "./backend";

type OwnerHeadersResult = Headers | Response;
type SseTicketResult = { ticket: string } | Response;

function readOwner(payload: unknown) {
  const source = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const nested = source.user && typeof source.user === "object" ? source.user as Record<string, unknown> : {};
  const value = source.username ?? nested.username ?? source.user_id ?? nested.user_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function signedOwnerHeaders(owner: string, secret: string) {
  return new Headers({
    "X-Redteam-Owner": owner,
    "X-Redteam-Signature": createHmac("sha256", secret).update(owner).digest("hex"),
  });
}

function ticketOwner(ticket: string | null, secret: string) {
  if (!ticket) return null;
  const [payload, signature] = ticket.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const supplied = Buffer.from(signature, "hex");
  const expectedBytes = Buffer.from(expected, "hex");
  if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { owner?: unknown; expires_at?: unknown };
    if (typeof data.owner !== "string" || typeof data.expires_at !== "number" || data.expires_at <= Date.now()) return null;
    return data.owner;
  } catch {
    return null;
  }
}

export async function redTeamOwnerHeaders(request: Request, sseTicket?: string | null): Promise<OwnerHeadersResult> {
  const secret = process.env.REDTEAM_BFF_SIGNING_SECRET?.trim();
  if (!secret) {
    return accountAuthUnavailableResponse();
  }
  const ticketedOwner = ticketOwner(sseTicket ?? null, secret);
  if (ticketedOwner) return signedOwnerHeaders(ticketedOwner, secret);
  if (sseTicket) return accountAuthRequiredResponse();
  if (!request.headers.get("authorization")) return accountAuthRequiredResponse();
  const profileUrl = buildAccountAuthUrl("/api/auth/profile");
  if (!profileUrl) return accountAuthUnavailableResponse();
  try {
    const profileResponse = await fetch(profileUrl, {
      cache: "no-store",
      headers: buildAccountAuthHeaders(request),
      method: "GET",
      signal: request.signal,
    });
    if (!profileResponse.ok) {
      return accountAuthRequiredResponse();
    }
    const owner = readOwner(await profileResponse.json());
    if (!owner) {
      return accountAuthRequiredResponse();
    }
    return signedOwnerHeaders(owner, secret);
  } catch {
    return accountAuthUnavailableResponse();
  }
}

/** EventSource cannot set Authorization. Issue a short-lived, HMAC-bound ticket after normal BFF authentication. */
export async function createRedTeamSseTicket(request: Request): Promise<SseTicketResult> {
  const ownerHeaders = await redTeamOwnerHeaders(request);
  if (ownerHeaders instanceof Response) return ownerHeaders;
  const secret = process.env.REDTEAM_BFF_SIGNING_SECRET!.trim();
  const payload = Buffer.from(JSON.stringify({
    owner: ownerHeaders.get("X-Redteam-Owner"),
    expires_at: Date.now() + 5 * 60_000,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  return { ticket: `${payload}.${signature}` };
}

export async function forwardRedTeamJson(request: Request, upstreamPath: string, init: RequestInit = {}) {
  const ownerHeaders = await redTeamOwnerHeaders(request);
  if (ownerHeaders instanceof Response) return ownerHeaders;
  try {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    ownerHeaders.forEach((value, key) => headers.set(key, value));
    const upstream = await fetch(buildAgentEvalBackendUrl(upstreamPath), {
      ...init,
      cache: "no-store",
      headers,
      signal: request.signal,
    });
    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}

export async function forwardRedTeamEvents(request: Request, upstreamPath: string, sseTicket?: string | null) {
  const ownerHeaders = await redTeamOwnerHeaders(request, sseTicket);
  if (ownerHeaders instanceof Response) return ownerHeaders;
  try {
    const headers = new Headers({ Accept: "text/event-stream" });
    ownerHeaders.forEach((value, key) => headers.set(key, value));
    const lastEventId = request.headers.get("Last-Event-ID");
    if (lastEventId) headers.set("Last-Event-ID", lastEventId);
    const upstream = await fetch(buildAgentEvalBackendUrl(upstreamPath), {
      cache: "no-store",
      headers,
      signal: request.signal,
    });
    return forwardEventStream(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
