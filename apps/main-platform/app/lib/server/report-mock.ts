import {
  buildMockEventSequence,
  createMockReport,
  createMockRun,
  createMockTrace,
  createMockTestCases,
} from "../../windows/main/evaluation/evaluation-mock.ts";
import type { ComparisonReport, EvaluationComparison } from "../../windows/main/evaluation/comparison-types.ts";
import { buildMockRedTeamEvents, createMockRedTeamConnection, createMockRedTeamReport, createMockRedTeamRun } from "../../windows/main/redteam/redteam-mock.ts";
import { buildComparisonSnapshot, buildEvaluationSnapshot, buildRedTeamSnapshot, type ReportSnapshot } from "./report-export.ts";

function buildMockComparisonReport(comparison: EvaluationComparison): ComparisonReport {
  const results = comparison.test_case_ids.map((testCaseId, index) => {
    const bareVerdict = index === 1 || index === 2 ? "FAIL" : "PASS";
    const defendedVerdict = index === 1 ? "FAIL" : "PASS";
    const transition = bareVerdict === "FAIL" && defendedVerdict === "PASS"
      ? "defense_blocked"
      : bareVerdict === "FAIL" && defendedVerdict === "FAIL"
        ? "defense_failed"
        : "both_pass";
    return {
      test_case_id: testCaseId,
      bare_verdict: bareVerdict,
      defended_verdict: defendedVerdict,
      transition,
      bare_findings: [],
      defended_findings: [],
    } as ComparisonReport["results"][number];
  });
  return {
    comparison_id: comparison.comparison_id,
    mode: comparison.mode,
    test_case_ids: comparison.test_case_ids,
    status: "completed",
    bare_run_id: comparison.bare_run_id,
    defended_run_id: comparison.defended_run_id,
    summary: { total: results.length, comparable: results.length, bare_passed: results.filter((r) => r.bare_verdict === "PASS").length, defended_passed: results.length, defense_blocked: results.filter((r) => r.transition === "defense_blocked").length, bare_pass_rate: 0, defended_pass_rate: 1, pass_rate_delta: 0 },
    results,
  };
}

export function buildMockReportSnapshot(kind: "evaluation" | "comparison" | "redteam", id: string): ReportSnapshot {
  if (kind === "redteam") {
    const agentId = id.replace(/^mock-redteam-run-/, "") || "defended-llm-v0";
    const run = createMockRedTeamRun(createMockRedTeamConnection(agentId));
    const events = buildMockRedTeamEvents({ ...run, run_id: id });
    return buildRedTeamSnapshot({ ...run, run_id: id }, createMockRedTeamReport({ ...run, run_id: id }), events);
  }
  if (kind === "evaluation") {
    const run = createMockRun(id, "defended-llm-v0", createMockTestCases().map((item) => item.id), Date.now(), "completed");
    const events = buildMockEventSequence(run, 1_700_000_000_000);
    return buildEvaluationSnapshot(createMockReport(run, events), run, createMockTrace(run, events));
  }
  const testCaseIds = createMockTestCases().map((item) => item.id);
  const bareRun = createMockRun(`mock-bare-${id}`, "llm-agent-v0", testCaseIds, 1_700_000_000_000, "completed");
  const defendedRun = createMockRun(`mock-defended-${id}`, "defended-llm-v0", testCaseIds, 1_700_000_000_000, "completed");
  const comparison: EvaluationComparison = { comparison_id: id, mode: "bare_vs_defended", test_case_ids: testCaseIds, bare_run_id: bareRun.run_id, defended_run_id: defendedRun.run_id, status: "completed", comparison_seed: "mock-seed", bare_run: bareRun, defended_run: defendedRun };
  return buildComparisonSnapshot(buildMockComparisonReport(comparison), createMockTestCases());
}
