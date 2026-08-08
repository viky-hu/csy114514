export const DEFAULT_AGENT_EVAL_BACKEND_URL = "http://127.0.0.1:8000";

export function resolveAgentEvalBackendUrl() {
  return (
    process.env.AGENT_EVAL_BACKEND_URL?.trim() ||
    DEFAULT_AGENT_EVAL_BACKEND_URL
  );
}

export function buildAgentEvalBackendUrl(path: string, baseUrl = resolveAgentEvalBackendUrl()) {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;

  return new URL(normalizedPath, normalizedBase).toString();
}

export function backendUnavailableResponse() {
  return Response.json(
    {
      error: {
        code: "EVALUATION_BACKEND_UNAVAILABLE",
        message: "Evaluation backend is not connected.",
        details: {},
      },
    },
    { status: 503 },
  );
}

export function forwardJsonResponse(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export function forwardEventStream(upstream: Response) {
  const headers = new Headers({
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    Connection: "keep-alive",
  });
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
