export const DEFAULT_ACCOUNT_AUTH_UNAVAILABLE_MESSAGE = "认证服务未接入，账户资料暂不可用。";

export function resolveAccountAuthUrl() {
  return process.env.MIA_RAG_AUTH_URL?.trim() || null;
}

export function buildAccountAuthUrl(path: string, baseUrl = resolveAccountAuthUrl()) {
  if (!baseUrl) {
    return null;
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return new URL(normalizedPath, normalizedBase).toString();
}

export function accountAuthUnavailableResponse() {
  return Response.json(
    {
      error: {
        code: "ACCOUNT_AUTH_UNAVAILABLE",
        message: DEFAULT_ACCOUNT_AUTH_UNAVAILABLE_MESSAGE,
        details: {},
      },
    },
    { status: 503 },
  );
}

export function accountAuthRequiredResponse() {
  return Response.json(
    {
      error: {
        code: "ACCOUNT_AUTH_REQUIRED",
        message: "请先登录账户。",
        details: {},
      },
    },
    { status: 401 },
  );
}

export function buildAccountAuthHeaders(request: Request, contentType?: string) {
  const headers = new Headers({ Accept: "application/json" });
  const authorization = request.headers.get("authorization");
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  if (contentType) {
    headers.set("Content-Type", contentType);
  }
  return headers;
}
