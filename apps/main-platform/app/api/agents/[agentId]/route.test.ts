import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route.ts";

const ORIGINAL_FETCH = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

test("GET /api/agents/[agentId] forwards to the encoded backend agent route", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ input: String(input), init });
    return Response.json({ agent_id: "agent 001" });
  }) as typeof fetch;

  const response = await GET(new Request("http://local.test/api/agents/agent%20001"), {
    params: Promise.resolve({ agentId: "agent 001" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { agent_id: "agent 001" });
  assert.equal(calls[0]?.input, "http://127.0.0.1:8000/agents/agent%20001");
  assert.equal(calls[0]?.init?.method, "GET");
});

test("GET /api/agents/[agentId] keeps backend 404 responses parseable", async () => {
  globalThis.fetch = (async () =>
    Response.json({ detail: "Agent not found" }, { status: 404 })) as typeof fetch;

  const response = await GET(new Request("http://local.test/api/agents/missing"), {
    params: Promise.resolve({ agentId: "missing" }),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { detail: "Agent not found" });
});
