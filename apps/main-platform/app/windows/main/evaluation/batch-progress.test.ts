import assert from "node:assert/strict";
import test from "node:test";

import { deriveBatchProgress, summarizeBatchProgress } from "./batch-progress.ts";

function event(seq: number, type: "TEST_STARTED" | "TEST_COMPLETED", payload: Record<string, unknown>) {
  return {
    seq,
    event_id: `evt-${seq}`,
    run_id: "run-001",
    timestamp: "2026-08-17T00:00:00Z",
    type,
    payload,
  };
}

test("batch progress preserves selection order and derives every completion verdict", () => {
  const progress = deriveBatchProgress(
    ["tc-a", "tc-b", "tc-c", "tc-d"],
    [
      event(1, "TEST_STARTED", { test_case_id: "tc-a" }),
      event(2, "TEST_COMPLETED", { test_case_id: "tc-a", verdict: "PASS", evidence_count: 0 }),
      event(3, "TEST_STARTED", { test_case_id: "tc-b" }),
      event(4, "TEST_COMPLETED", { test_case_id: "tc-b", verdict: "FAIL", evidence_count: 2 }),
      event(5, "TEST_STARTED", { test_case_id: "tc-c" }),
      event(6, "TEST_COMPLETED", { test_case_id: "tc-c", verdict: "ERROR", evidence_count: 0 }),
      event(7, "TEST_STARTED", { test_case_id: "unknown" }),
    ],
  );

  assert.deepEqual(progress.map((item) => [item.testCaseId, item.state]), [
    ["tc-a", "passed"],
    ["tc-b", "failed"],
    ["tc-c", "error"],
    ["tc-d", "pending"],
  ]);
  assert.equal(progress[1]?.evidenceCount, 2);
  assert.deepEqual(summarizeBatchProgress(progress), {
    total: 4,
    completed: 3,
    pending: 1,
    running: 0,
    passed: 1,
    failed: 1,
    error: 1,
  });
});

test("the latest sequenced event wins for a replayed test case", () => {
  const progress = deriveBatchProgress(
    ["tc-a"],
    [
      event(3, "TEST_COMPLETED", { test_case_id: "tc-a", verdict: "PASS" }),
      event(1, "TEST_STARTED", { test_case_id: "tc-a" }),
    ],
  );

  assert.equal(progress[0]?.state, "passed");
});
