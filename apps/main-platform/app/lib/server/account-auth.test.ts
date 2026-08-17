import assert from "node:assert/strict";
import test from "node:test";
import {
  accountAuthRequiredResponse,
  accountAuthUnavailableResponse,
  buildAccountAuthHeaders,
  buildAccountAuthUrl,
} from "./account-auth.ts";

test("account auth builds a stable upstream URL", () => {
  assert.equal(
    buildAccountAuthUrl("/api/auth/profile", "https://auth.example.test/root"),
    "https://auth.example.test/root/api/auth/profile",
  );
  assert.equal(buildAccountAuthUrl("/api/auth/profile", null), null);
});

test("account auth forwards only required browser headers", () => {
  const request = new Request("https://app.example.test/api/account/me", {
    headers: {
      Authorization: "Bearer private-token",
      Cookie: "unrelated=cookie",
    },
  });
  const headers = buildAccountAuthHeaders(request, "application/json");

  assert.equal(headers.get("Authorization"), "Bearer private-token");
  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.get("Cookie"), null);
});

test("account auth returns the shared parseable error shape", async () => {
  const unavailable = accountAuthUnavailableResponse();
  const required = accountAuthRequiredResponse();

  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    error: {
      code: "ACCOUNT_AUTH_UNAVAILABLE",
      message: "认证服务未接入，账户资料暂不可用。",
      details: {},
    },
  });
  assert.equal(required.status, 401);
  assert.equal((await required.json()).error.code, "ACCOUNT_AUTH_REQUIRED");
});
