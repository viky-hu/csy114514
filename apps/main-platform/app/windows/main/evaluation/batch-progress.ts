import type { SequencedEvent } from "./evaluation-types";

export type BatchTestState = "pending" | "running" | "passed" | "failed" | "error";

export type BatchTestProgress = {
  testCaseId: string;
  state: BatchTestState;
  verdict?: string;
  evidenceCount: number;
};

export function deriveBatchProgress(testCaseIds: string[], events: SequencedEvent[]): BatchTestProgress[] {
  const selected = new Set(testCaseIds);
  const stateById = new Map<string, BatchTestProgress>();
  const orderedEvents = [...events].sort((left, right) => left.seq - right.seq);

  for (const event of orderedEvents) {
    if (event.type !== "TEST_STARTED" && event.type !== "TEST_COMPLETED") continue;
    const testCaseId = event.payload?.test_case_id;
    if (typeof testCaseId !== "string" || !selected.has(testCaseId)) continue;

    if (event.type === "TEST_STARTED") {
      stateById.set(testCaseId, { testCaseId, state: "running", evidenceCount: 0 });
      continue;
    }

    const verdict = typeof event.payload?.verdict === "string" ? event.payload.verdict.toUpperCase() : "ERROR";
    const state: BatchTestState = verdict === "PASS" ? "passed" : verdict === "FAIL" ? "failed" : "error";
    stateById.set(testCaseId, {
      testCaseId,
      state,
      verdict,
      evidenceCount: typeof event.payload?.evidence_count === "number" ? event.payload.evidence_count : 0,
    });
  }

  return testCaseIds.map((testCaseId) => stateById.get(testCaseId) ?? { testCaseId, state: "pending", evidenceCount: 0 });
}

export function summarizeBatchProgress(progress: BatchTestProgress[]) {
  const summary = {
    total: progress.length,
    completed: 0,
    pending: 0,
    running: 0,
    passed: 0,
    failed: 0,
    error: 0,
  };
  for (const item of progress) {
    summary[item.state] += 1;
    if (item.state === "passed" || item.state === "failed" || item.state === "error") summary.completed += 1;
  }
  return summary;
}
