import assert from "node:assert/strict";
import test from "node:test";
import {
  buildComparisonSnapshot,
  buildEvaluationSnapshot,
  buildRedTeamSnapshot,
  redactEvent,
  renderMarkdown,
  renderTxt,
  renderPrintHtml,
  type ReportSnapshot,
} from "./report-export.ts";
import type { EvaluationReport, EvaluationRun } from "../../windows/main/evaluation/evaluation-types.ts";

const evaluationReport = {
  report_id: "report-1", evaluation_id: "eval-1", agent_id: "agent-1", overall_score: 42,
  severity: "CRITICAL", conclusion: "检测到可复算风险", findings: [{
    finding_id: "finding-1", evaluation_id: "eval-1", risk_type: "unconfirmed_email_send", severity: "CRITICAL",
    risk_pattern_id: "R4", description: "未确认外发", evidence: [{ event_id: "evt-1", description: "邮箱" }],
    rule_types: ["unconfirmed_external_action"], remediation: "增加确认门控",
  }], score_breakdown: { algorithm_version: "r4-mvp-v1", dimensions: { capability: 80, execution_stability: 90, security: 20 }, deductions: [] },
};

const run = { run_id: "eval-1", agent_id: "agent-1", test_case_ids: ["tc-1"], status: "completed", created_at: "2026-01-01T00:00:00Z", started_at: null, finished_at: "2026-01-01T00:01:00Z", current_stage: null, last_event_seq: 1, report_available: true, error: null };

test("evaluation snapshot adapts report, run and trace", () => {
  const snapshot = buildEvaluationSnapshot(evaluationReport as EvaluationReport, run as EvaluationRun, { trace_id: "trace-1", run_id: "eval-1", agent_id: "agent-1", events: [{ event_id: "evt-1", run_id: "eval-1", timestamp: "2026-01-01T00:00:01Z", type: "TOOL_CALLED", payload: { tool_name: "email.send", token: "secret", arguments: { to: "a@b" } } }] });
  assert.equal(snapshot.kind, "evaluation");
  assert.equal(snapshot.findings.length, 1);
  assert.equal(snapshot.events[0].tool, "email.send");
  assert.equal(JSON.stringify(snapshot), JSON.stringify(snapshot).replace("secret", ""));
});

test("comparison snapshot is an independent summary and counts unknown rows as incomplete", () => {
  const snapshot = buildComparisonSnapshot(
    { comparison_id: "cmp-1", mode: "bare_vs_defended", status: "completed", bare_run_id: "b", defended_run_id: "d", test_case_ids: ["tc-1", "tc-2"], summary: { total: 2, comparable: 1, bare_passed: 0, defended_passed: 1, defense_blocked: 1, bare_pass_rate: 0, defended_pass_rate: 1, pass_rate_delta: 1 }, results: [
      { test_case_id: "tc-1", bare_verdict: "FAIL", defended_verdict: "PASS", transition: "defense_blocked" },
      { test_case_id: "tc-2", bare_verdict: "ERROR", defended_verdict: null, transition: "incomplete" },
    ] },
    [{ id: "tc-1", name: "测试", risk_type: "R1", severity: "HIGH", target_risk_pattern: "R1", turn_count: 1, description: "描述" }],
  );
  assert.equal(snapshot.kind, "comparison");
  assert.equal(snapshot.summary.coverage.incomplete, 1);
  assert.match(snapshot.narrative, /覆盖不足|防御/);
});

test("comparison adapter normalizes empty and unknown rows without trusting reported counts", () => {
  const snapshot = buildComparisonSnapshot({
    comparison_id: "cmp-invalid", mode: "bare_vs_defended", status: "completed", bare_run_id: "b", defended_run_id: "d",
    test_case_ids: [], summary: { total: 999, comparable: 999, bare_passed: 999, defended_passed: 999, defense_blocked: 999, bare_pass_rate: 1, defended_pass_rate: 1, pass_rate_delta: 0 },
    results: [null, { test_case_id: "tc-x", bare_verdict: "UNKNOWN", defended_verdict: null, transition: "not-a-transition" }],
  } as never, []);
  assert.equal(snapshot.summary.coverage.total, 2);
  assert.equal(snapshot.summary.coverage.incomplete, 2);
  assert.match(renderTxt(snapshot), /异常或不可比：2/);
});

test("redteam event redaction uses allowlist and removes controls/secrets", () => {
  const event = redactEvent({ event_id: "evt", timestamp: "2026-01-01T00:00:00Z", type: "VARIANT_EVALUATED", seq: 2, payload: { round: 1, strategy: "prompt_injection", variant_id: "v1", verdict: "FAIL", defense_labels: ["D1"], authorization: "Bearer abc", raw_payload: "do bad", path: "C:\\private", note: "x\u0000y" } });
  assert.equal(event.round, 1);
  assert.equal(event.strategy, "prompt_injection");
  assert.equal("authorization" in event, false);
  assert.equal("raw_payload" in event, false);
  assert.equal("note" in event, false);
});

test("finding and outcome text is sanitized and counts are non-negative integers", () => {
  const snapshot = buildRedTeamSnapshot(
    { run_id: "rt-safe", agent_id: "agent", status: "completed", config: { rounds: 1 } },
    { run_id: "rt-safe", conclusion: "no_bypass_observed", outcome_summary: { confirmed_bypass: -4.8, defense_success: 2.9 } },
    [{ event_id: "e", timestamp: "2026-01-01", type: "X", payload: { policy: "token=secret-value", path: "C:\\private\\x" } }],
  );
  assert.equal(snapshot.statistics["已证实绕过"], 0);
  assert.equal(snapshot.statistics["防守成功"], 2);
  assert.doesNotMatch(renderMarkdown(snapshot), /secret-value|C:\\private/);
});

test("all renderers expose the same canonical facts", () => {
  const snapshot: ReportSnapshot = buildRedTeamSnapshot(
    { run_id: "rt-1", agent_id: "agent", status: "completed", current_round: 2, last_event_seq: 1, report_available: true, selected_seed_ids: ["s1"], config: { rounds: 2, seed_count: 1, variants_per_seed: 1 } },
    { run_id: "rt-1", conclusion: "no_bypass_observed", outcome_summary: { confirmed_bypass: 0, defense_success: 2 }, bypasses: [] },
    [],
  );
  const txt = renderTxt(snapshot); const md = renderMarkdown(snapshot); const html = renderPrintHtml(snapshot);
  for (const output of [txt, md, html]) {
    assert.match(output, /rt-1/);
    assert.match(output, /样本内未观察到绕过/);
  }
  assert.match(txt, /================/);
  assert.match(md, /^# /m);
  assert.match(html, /@page/);
});
