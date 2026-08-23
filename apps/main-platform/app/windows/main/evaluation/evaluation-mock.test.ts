import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveBatchProgress, summarizeBatchProgress } from "./batch-progress.ts";
import {
  buildMockEventSequence,
  createMockReport,
  createMockRun,
  createMockTestCases,
  isEvaluationMockEnabled,
} from "./evaluation-mock.ts";
import { findActiveInference } from "./inference-status.ts";
import { reduceEvaluationEvent } from "./evaluation-types.ts";

test("evaluation mock is enabled only by evaluationMock=1", () => {
  assert.equal(isEvaluationMockEnabled("?evaluationMock=1"), true);
  assert.equal(isEvaluationMockEnabled("?evaluationMock=0"), false);
  assert.equal(isEvaluationMockEnabled("?evaluationMock=true"), false);
  assert.equal(isEvaluationMockEnabled(""), false);
});

test("mock fixtures produce typed runs, events, progress and report", () => {
  const testCases = createMockTestCases();
  const run = createMockRun("mock-run-001", "llm-agent-v0", testCases.map((item) => item.id), 1_700_000_000_000);
  const events = buildMockEventSequence(run, 1_700_000_000_000);
  const reduced = events.reduce(
    (current, event) => ({ ...current, ...reduceEvaluationEvent(current, event) }),
    { events: [], activeStage: null } as { events: typeof events; activeStage: ReturnType<typeof reduceEvaluationEvent>["activeStage"] },
  );
  const progress = deriveBatchProgress(run.test_case_ids, reduced.events);
  const report = createMockReport(run, reduced.events);

  assert.equal(testCases.length, 4);
  assert.equal(new Set(events.map((event) => event.seq)).size, events.length);
  assert.ok(events.every((event) => event.run_id === run.run_id));
  assert.equal(summarizeBatchProgress(progress).completed, run.test_case_ids.length);
  assert.equal(report.evaluation_id, run.run_id);
  assert.ok(report.findings?.[0]?.evidence?.length);
});

test("mock LLM sequence exposes active inference until its response", () => {
  const run = createMockRun("mock-run-llm", "llm-agent-v0", ["mock-r1"], 1_700_000_000_000);
  const events = buildMockEventSequence(run, 1_700_000_000_000);
  const invokedIndex = events.findIndex((event) => event.type === "AGENT_INVOKED");
  const respondedIndex = events.findIndex((event) => event.type === "AGENT_RESPONDED");
  const pending = events.slice(0, respondedIndex);

  assert.ok(invokedIndex >= 0);
  assert.ok(respondedIndex > invokedIndex);
  assert.ok(findActiveInference(pending, run.agent_id, Date.parse(events[invokedIndex].timestamp) + 1_000));
  assert.equal(findActiveInference(events, run.agent_id, Date.parse(events[respondedIndex].timestamp) + 1_000), null);
});

test("mock non-LLM sequence does not expose inference", () => {
  const run = createMockRun("mock-run-keyword", "corpmate-v0", ["mock-r1"], 1_700_000_000_000);
  const events = buildMockEventSequence(run, 1_700_000_000_000);

  assert.equal(events.some((event) => event.type === "AGENT_INVOKED"), false);
  assert.equal(findActiveInference(events, run.agent_id, 1_700_000_010_000), null);
});
