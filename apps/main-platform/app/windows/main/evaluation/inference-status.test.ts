import assert from "node:assert/strict";
import test from "node:test";

import { findActiveInference, isInferenceRunActive } from "./inference-status.ts";

test("keeps the inference overlay active from start through a non-terminal run", () => {
  assert.equal(isInferenceRunActive(undefined, false), false);
  assert.equal(isInferenceRunActive("ready", false), false);
  assert.equal(isInferenceRunActive("preflighting", false), true);
  assert.equal(isInferenceRunActive("queued", false), true);
  assert.equal(isInferenceRunActive("running", false), true);
  assert.equal(isInferenceRunActive("completed", false), false);
  assert.equal(isInferenceRunActive("failed", false), false);
  assert.equal(isInferenceRunActive("interrupted", false), false);
  assert.equal(isInferenceRunActive("preflight_failed", false), false);
  assert.equal(isInferenceRunActive("ready", true), true);
});

function event(seq: number, type: string, payload: Record<string, unknown>, timestamp = "2026-08-21T00:00:00.000Z") {
  return {
    seq,
    event_id: `evt-${seq}`,
    run_id: "run-001",
    timestamp,
    type,
    payload,
  } as never;
}

test("returns no inference state for CorpMate", () => {
  assert.equal(findActiveInference([
    event(1, "AGENT_INVOKED", { test_case_id: "tc-1", turn_index: 0 }),
  ], "corpmate-v0", Date.parse("2026-08-21T00:00:05.000Z")), null);
});

test("pairs a batch invocation with its matching response and reports elapsed seconds", () => {
  const active = findActiveInference([
    event(2, "AGENT_RESPONDED", { test_case_id: "tc-1", turn_index: 0 }),
    event(1, "AGENT_INVOKED", { test_case_id: "tc-1", turn_index: 0 }),
  ], "llm-agent-v0", Date.parse("2026-08-21T00:00:29.900Z"));

  assert.equal(active, null);

  const pending = findActiveInference([
    event(1, "AGENT_INVOKED", { test_case_id: "tc-1", turn_index: 0 }),
  ], "llm-agent-v0", Date.parse("2026-08-21T00:00:30.000Z"));
  assert.equal(pending?.testCaseId, "tc-1");
  assert.equal(pending?.turnLabel, "TestCase tc-1 · 第 1 轮");
  assert.equal(pending?.waitedSeconds, 30);
  assert.equal(pending?.isLongWait, true);
});

test("selects the latest pending batch invocation after sorting by sequence", () => {
  const active = findActiveInference([
    event(3, "AGENT_INVOKED", { test_case_id: "tc-2", turn_index: 1 }, "2026-08-21T00:00:10.000Z"),
    event(1, "AGENT_INVOKED", { test_case_id: "tc-1", turn_index: 0 }),
  ], "defended-llm-v0", Date.parse("2026-08-21T00:00:15.000Z"));

  assert.equal(active?.testCaseId, "tc-2");
  assert.equal(active?.waitedSeconds, 5);
});

test("pairs legacy R4 events with turn and session identifiers", () => {
  const active = findActiveInference([
    event(1, "AGENT_INVOKED", { turn_id: "turn-2", session_id: "session-2" }),
    event(2, "AGENT_RESPONDED", { turn_id: "turn-1", session_id: "session-1" }),
  ], "defended-llm-v0", Date.parse("2026-08-21T00:00:08.000Z"));

  assert.equal(active?.turnLabel, "turn-2");
  assert.equal(active?.waitedSeconds, 8);
});

test("does not pair events when correlation fields are missing", () => {
  const active = findActiveInference([
    event(1, "AGENT_INVOKED", { test_case_id: "tc-1", turn_index: 0 }),
    event(2, "AGENT_RESPONDED", { test_case_id: "tc-1" }),
  ], "llm-agent-v0", Date.parse("2026-08-21T00:00:08.000Z"));

  assert.equal(active?.testCaseId, "tc-1");
});
