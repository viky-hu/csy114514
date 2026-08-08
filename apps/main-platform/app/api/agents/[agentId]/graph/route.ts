import { NextResponse } from "next/server";
import { buildAgentEvalBackendUrl } from "../../../../lib/server/backend";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    agentId: string;
  }>;
};

async function readUpstreamJson(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { agentId } = await context.params;
  const upstreamUrl = buildAgentEvalBackendUrl(
    `/agents/${encodeURIComponent(agentId)}/graph`,
  );

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });
    const payload = await readUpstreamJson(upstream);

    return NextResponse.json(payload, { status: upstream.status });
  } catch {
    return NextResponse.json(
      {
        code: "AGENT_GRAPH_UNAVAILABLE",
        message: "Agent graph backend is not connected.",
      },
      { status: 503 },
    );
  }
}
