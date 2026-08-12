import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "./route.ts";

const ORIGINAL_FETCH = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

test("POST /api/agents forwards AgentManifest to the backend", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ input: String(input), init });
    return Response.json({ agent_id: "agent-001" }, { status: 201 });
  }) as typeof fetch;

  const response = await POST(
    new Request("http://local.test/api/agents", {
      body: JSON.stringify({
        agent_id: "agent-001",
        name: "Agent 001",
        version: "1.0.0",
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { agent_id: "agent-001" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "http://127.0.0.1:8000/agents");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.headers?.["Content-Type" as keyof HeadersInit], "application/json");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
    agent_id: "agent-001",
    name: "Agent 001",
    version: "1.0.0",
  });
});

test("POST /api/agents returns the shared unavailable error on network failure", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;

  const response = await POST(
    new Request("http://local.test/api/agents", {
      body: JSON.stringify({ agent_id: "agent-001", name: "Agent 001" }),
      method: "POST",
    }),
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    error: {
      code: "EVALUATION_BACKEND_UNAVAILABLE",
      details: {},
      message: "Evaluation backend is not connected.",
    },
  });
});
