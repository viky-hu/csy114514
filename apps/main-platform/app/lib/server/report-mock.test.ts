import assert from "node:assert/strict";
import test from "node:test";
import { buildMockReportSnapshot } from "./report-mock.ts";
import { renderMarkdown, renderTxt } from "./report-export.ts";

test("mock redteam snapshot exports deterministic facts", () => {
  const snapshot = buildMockReportSnapshot("redteam", "mock-redteam-run-agent");
  assert.equal(snapshot.kind, "redteam");
  assert.match(snapshot.narrative, /已证实绕过/);
  assert.match(renderTxt(snapshot), /已证实绕过/);
  assert.match(renderMarkdown(snapshot), /mock-redteam-run-agent/);
});

test("mock evaluation and comparison snapshots are available without backend records", () => {
  const evaluation = buildMockReportSnapshot("evaluation", "mock-run-123");
  const comparison = buildMockReportSnapshot("comparison", "mock-comparison-123");
  assert.equal(evaluation.kind, "evaluation");
  assert.equal(comparison.kind, "comparison");
  assert.match(renderTxt(comparison), /对比测评总结报告/);
});
