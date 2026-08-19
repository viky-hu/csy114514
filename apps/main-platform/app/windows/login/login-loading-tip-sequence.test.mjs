import assert from "node:assert/strict";
import test from "node:test";

import {
  createLoginLoadingTipSequence,
  createLoginMockLoadingPlan,
  LOGIN_LOADING_MOCK_MAX_MS,
  LOGIN_LOADING_MOCK_MIN_MS,
} from "./login-loading-tip-sequence.ts";

test("login mock loading plan is stable, non-repeating, and fits the blue-screen window", () => {
  const first = createLoginMockLoadingPlan("corpmate-v0");
  const second = createLoginMockLoadingPlan("corpmate-v0");

  assert.deepEqual(second, first);
  assert.ok(first.steps.length >= 3 && first.steps.length <= 5);
  assert.ok(first.totalDurationMs >= LOGIN_LOADING_MOCK_MIN_MS);
  assert.ok(first.totalDurationMs <= LOGIN_LOADING_MOCK_MAX_MS);
  assert.equal(new Set(first.steps.map((step) => step.tip.id)).size, first.steps.length);

  for (const step of first.steps) {
    assert.ok(step.holdMs >= 1050 && step.holdMs <= 1500);
  }
});

test("completion and failure are deferred until the current tip exits", () => {
  const completed = createLoginLoadingTipSequence("corpmate-v0");
  const failed = createLoginLoadingTipSequence("corpmate-v0");

  assert.equal(completed.start().kind, "tip");
  completed.request({ type: "complete" });
  assert.deepEqual(completed.advanceAfterExit(), { kind: "complete" });

  assert.equal(failed.start().kind, "tip");
  failed.request({ message: "Agent 接入失败", type: "failed" });
  assert.deepEqual(failed.advanceAfterExit(), {
    kind: "failed",
    message: "Agent 接入失败",
  });
});

test("a future backend phase event replaces the next tip only at an exit boundary", () => {
  const sequence = createLoginLoadingTipSequence("corpmate-v0");

  assert.equal(sequence.start().kind, "tip");
  sequence.request({ phase: "preflight", type: "phase" });

  const next = sequence.advanceAfterExit();
  assert.equal(next.kind, "tip");
  assert.equal(next.presentation.tip.phase, "preflight");
});
