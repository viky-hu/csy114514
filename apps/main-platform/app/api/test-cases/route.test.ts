import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route.ts";

const ORIGINAL_FETCH = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

test("GET /api/test-cases forwards the uncached list request to the backend", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const testCases = [{ id: "tc_r4_e2e_001", name: "R4 full chain" }];
  globalThis.fetch = (async (input, init) => {
    calls.push({ input: String(input), init });
    return Response.json(testCases);
  }) as typeof fetch;

  const response = await GET(new Request("http://local.test/api/test-cases"));

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), testCases);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "http://127.0.0.1:8000/test-cases");
  assert.equal(calls[0]?.init?.cache, "no-store");
  assert.equal(calls[0]?.init?.headers?.["Accept" as keyof HeadersInit], "application/json");
});

test("GET /api/test-cases returns the shared unavailable error on network failure", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;

  const response = await GET(new Request("http://local.test/api/test-cases"));

  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, "EVALUATION_BACKEND_UNAVAILABLE");
});
