import assert from "node:assert/strict";
import test from "node:test";

import * as evaluationTypes from "./evaluation-types.ts";

const { eventText, reduceEvaluationEvent } = evaluationTypes;

function event(seq, type, stage) {
  return {
    seq,
    event_id: `evt-${seq}`,
    run_id: "run-001",
    timestamp: "2026-08-08T00:00:00Z",
    type,
    payload: { stage },
  };
}

test("evaluation event reducer orders events, advances stage, and deduplicates replay", () => {
  const initial = { events: [], activeStage: null };
  const second = reduceEvaluationEvent(
    initial,
    event(2, "AGENT_INVOKED", "persistent_memory_poisoning"),
  );
  const ordered = reduceEvaluationEvent(
    second,
    event(1, "PREFLIGHT_COMPLETED", "web_content_injection"),
  );
  const replayed = reduceEvaluationEvent(
    ordered,
    event(2, "AGENT_INVOKED", "persistent_memory_poisoning"),
  );

  assert.deepEqual(ordered.events.map((item) => item.seq), [1, 2]);
  assert.equal(ordered.activeStage, "persistent_memory_poisoning");
  assert.equal(replayed, ordered);
});

test("batch lifecycle events have readable terminal text", () => {
  assert.equal(eventText(event(1, "TEST_STARTED", undefined)), "TestCase 开始执行");
  assert.equal(
    eventText({ ...event(2, "TEST_COMPLETED", undefined), payload: { verdict: "PASS" } }),
    "TestCase 已完成 · PASS",
  );
});

test("legacy R4 exposes PASS or FAIL only from the latest Judge verdict", () => {
  const finalJudgeVerdict = evaluationTypes.finalJudgeVerdict;
  assert.equal(typeof finalJudgeVerdict, "function");
  if (typeof finalJudgeVerdict !== "function") return;

  assert.equal(
    finalJudgeVerdict([
      event(1, "JUDGE_DECISION", undefined),
      { ...event(2, "JUDGE_DECISION", undefined), payload: { verdict: "FAIL" } },
    ]),
    "FAIL",
  );
  assert.equal(
    finalJudgeVerdict([{ ...event(3, "JUDGE_DECISION", undefined), payload: { verdict: "PASS" } }]),
    "PASS",
  );
  assert.equal(
    finalJudgeVerdict([{ ...event(4, "JUDGE_DECISION", undefined), payload: { verdict: "ERROR" } }]),
    null,
  );
  assert.equal(finalJudgeVerdict([event(5, "RUN_FINISHED", undefined)]), null);
});
