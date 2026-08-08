import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AGENT_EVAL_BACKEND_URL,
  backendUnavailableResponse,
  buildAgentEvalBackendUrl,
  forwardEventStream,
  forwardJsonResponse,
} from "./backend.ts";

test("buildAgentEvalBackendUrl joins relative paths against the configured base", () => {
  assert.equal(
    buildAgentEvalBackendUrl("/agents/corpmate-v0/graph", "http://127.0.0.1:8000"),
    "http://127.0.0.1:8000/agents/corpmate-v0/graph",
  );
  assert.equal(
    buildAgentEvalBackendUrl("evaluations/eval-001/report", "https://backend.local/v1"),
    "https://backend.local/v1/evaluations/eval-001/report",
  );
});

test("default backend url stays on localhost for the main-platform BFF", () => {
  assert.equal(DEFAULT_AGENT_EVAL_BACKEND_URL, "http://127.0.0.1:8000");
});

test("JSON proxy preserves status and the unified backend error shape", async () => {
  const forwarded = forwardJsonResponse(
    Response.json({ value: 1 }, { status: 202 }),
  );
  assert.equal(forwarded.status, 202);
  assert.deepEqual(await forwarded.json(), { value: 1 });

  const unavailable = backendUnavailableResponse();
  assert.equal(unavailable.status, 503);
  assert.deepEqual(await unavailable.json(), {
    error: {
      code: "EVALUATION_BACKEND_UNAVAILABLE",
      message: "Evaluation backend is not connected.",
      details: {},
    },
  });
});

test("SSE proxy disables caches and buffering", () => {
  const forwarded = forwardEventStream(
    new Response("data: {}\n\n", {
      headers: { "content-type": "text/event-stream" },
    }),
  );
  assert.equal(forwarded.headers.get("content-type"), "text/event-stream");
  assert.equal(forwarded.headers.get("cache-control"), "no-cache, no-transform");
  assert.equal(forwarded.headers.get("x-accel-buffering"), "no");
});
