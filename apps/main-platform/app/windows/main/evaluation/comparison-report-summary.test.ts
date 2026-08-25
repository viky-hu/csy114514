import assert from "node:assert/strict";
import test from "node:test";
import { deriveComparisonReportSummary } from "./comparison-report-summary.ts";
import type { ComparisonCaseResult } from "./comparison-types.ts";
import type { TestCaseSummary } from "./evaluation-types.ts";

const testCases: TestCaseSummary[] = [
  { id: "tc-r1", name: "网页内容注入", description: "R1 描述", risk_type: "web", severity: "HIGH", target_risk_pattern: "R1", turn_count: 1 },
  { id: "tc-r2", name: "记忆污染", description: "R2 描述", risk_type: "memory", severity: "HIGH", target_risk_pattern: "R2", turn_count: 2 },
  { id: "tc-r3", name: "跨会话状态", description: "R3 描述", risk_type: "state", severity: "MEDIUM", target_risk_pattern: "R3", turn_count: 2 },
  { id: "tc-r4", name: "未确认外发", description: "R4 描述", risk_type: "email", severity: "CRITICAL", target_risk_pattern: "R4", turn_count: 3 },
];

const everyTransition: ComparisonCaseResult[] = [
  {
    test_case_id: "tc-r1",
    bare_verdict: "FAIL",
    defended_verdict: "PASS",
    transition: "defense_blocked",
    bare_findings: [{ severity: "HIGH", description: "Bare finding", rule_types: ["untrusted_web"] }],
  },
  {
    test_case_id: "tc-r2",
    bare_verdict: "FAIL",
    defended_verdict: "FAIL",
    transition: "defense_failed",
    defended_findings: [{ severity: "HIGH", description: "Residual finding", rule_types: ["memory_policy"] }],
  },
  {
    test_case_id: "tc-r3",
    bare_verdict: "PASS",
    defended_verdict: "PASS",
    transition: "both_pass",
  },
  {
    test_case_id: "tc-r4",
    bare_verdict: "PASS",
    defended_verdict: "FAIL",
    transition: "possible_regression",
    defended_findings: [{ severity: "CRITICAL", description: "Regression finding", rule_types: ["confirm_before_send"] }],
  },
  {
    test_case_id: "tc-other",
    bare_verdict: "ERROR",
    defended_verdict: "PASS",
    transition: "incomplete",
  },
];

test("derives coverage, all transitions, pattern results, and risk-priority ledger", () => {
  const report = deriveComparisonReportSummary(everyTransition, testCases);

  assert.deepEqual(report.coverage, { total: 5, comparable: 4, incomplete: 1 });
  assert.deepEqual(report.rates, { barePassed: 2, defendedPassed: 2, barePassRate: 0.5, defendedPassRate: 0.5, passRateDelta: 0 });
  assert.deepEqual(report.transitions, {
    defense_blocked: 1,
    defense_failed: 1,
    both_pass: 1,
    possible_regression: 1,
    incomplete: 1,
  });
  assert.deepEqual(report.ledgerGroups.map((group) => [group.key, group.rows.length]), [
    ["possible_regression", 1],
    ["defense_failed", 1],
    ["incomplete", 1],
    ["defense_blocked", 1],
    ["both_pass", 1],
  ]);
  assert.deepEqual(report.patterns.map((pattern) => [pattern.key, pattern.total, pattern.transitions.defense_blocked, pattern.transitions.defense_failed]), [
    ["R1", 1, 1, 0],
    ["R2", 1, 0, 1],
    ["R3", 1, 0, 0],
    ["R4", 1, 0, 0],
    ["OTHER", 1, 0, 0],
  ]);
  assert.equal(report.conclusion.tone, "critical");
  assert.match(report.conclusion.headline, /可能误伤/);
  assert.equal(report.ledgerGroups[2].rows[0].riskPattern, "OTHER");
});

test("excludes non-PASS/FAIL rows from rate denominator and handles no comparable samples", () => {
  const report = deriveComparisonReportSummary([
    { test_case_id: "tc-r1", bare_verdict: "ERROR", defended_verdict: "PASS", transition: "incomplete" },
    { test_case_id: "tc-r2", bare_verdict: null, defended_verdict: "FAIL", transition: "incomplete" },
  ], testCases);

  assert.deepEqual(report.coverage, { total: 2, comparable: 0, incomplete: 2 });
  assert.deepEqual(report.rates, { barePassed: 0, defendedPassed: 0, barePassRate: 0, defendedPassRate: 0, passRateDelta: 0 });
  assert.equal(report.conclusion.tone, "neutral");
  assert.match(report.conclusion.headline, /样本尚不足/);
});

test("preserves source order within each priority group and safely defaults missing catalog and Finding data", () => {
  const report = deriveComparisonReportSummary([
    { test_case_id: "missing-first", bare_verdict: "FAIL", defended_verdict: "FAIL", transition: "defense_failed" },
    { test_case_id: "tc-r2", bare_verdict: "FAIL", defended_verdict: "FAIL", transition: "defense_failed" },
    { test_case_id: "missing-second", bare_verdict: "PASS", defended_verdict: "FAIL", transition: "possible_regression" },
  ], testCases);

  assert.deepEqual(report.ledgerGroups[0].rows.map((row) => row.test_case_id), ["missing-second"]);
  assert.deepEqual(report.ledgerGroups[1].rows.map((row) => row.test_case_id), ["missing-first", "tc-r2"]);
  assert.equal(report.ledgerGroups[1].rows[0].testCase, null);
  assert.deepEqual(report.ledgerGroups[1].rows[0].findings, { bare: [], defended: [] });
  assert.equal(report.ledgerGroups[1].rows[0].riskPattern, "OTHER");
});

test("calculates signed percentage-point changes without rounding away negative movement", () => {
  const report = deriveComparisonReportSummary([
    { test_case_id: "tc-r1", bare_verdict: "PASS", defended_verdict: "FAIL", transition: "possible_regression" },
    { test_case_id: "tc-r2", bare_verdict: "PASS", defended_verdict: "PASS", transition: "both_pass" },
    { test_case_id: "tc-r3", bare_verdict: "FAIL", defended_verdict: "FAIL", transition: "defense_failed" },
  ], testCases);

  assert.equal(report.rates.passRateDelta, -1 / 3);
  assert.equal(report.passRateDeltaPoints, -33.3);
  assert.match(report.conclusion.detail, /-33.3 个百分点/);
});
