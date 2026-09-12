import {
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardJsonResponse,
} from "../../../lib/server/backend";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ agentId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { agentId } = await context.params;

  try {
    const upstream = await fetch(
      buildAgentEvalBackendUrl(`/topology/${encodeURIComponent(agentId)}`),
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
        method: "GET",
        signal: request.signal,
      },
    );

    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { agentId } = await context.params;

  try {
    const upstream = await fetch(
      buildAgentEvalBackendUrl(`/topology/${encodeURIComponent(agentId)}`),
      {
        body: await request.text(),
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": request.headers.get("Content-Type") ?? "application/json",
        },
        method: "POST",
        signal: request.signal,
      },
    );

    return forwardJsonResponse(upstream);
  } catch {
    return backendUnavailableResponse();
  }
}
