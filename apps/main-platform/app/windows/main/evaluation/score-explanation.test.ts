import assert from "node:assert/strict";
import test from "node:test";

import { buildScoreExplanation } from "./score-explanation.ts";

const base = {
  dimensions: { capability: 100, execution_stability: 100, security: 100 },
  weights: { capability: 25, execution_stability: 20, security: 55 },
  severity_cap: { severity: "HIGH" as const, maximum_score: 59 as const },
  deductions: [],
  algorithm_version: "r4-mvp-v1" as const,
};

test("prefers the server weighted score when it is present", () => {
  const explanation = buildScoreExplanation({
    ...base,
    weighted_score_before_cap: 98.4,
  }, 59);

  assert.equal(explanation.weightedScoreBeforeCap, 98.4);
  assert.equal(explanation.capLabel, "HIGH");
  assert.equal(explanation.capMaximum, 59);
  assert.equal(explanation.finalScore, 59);
});

test("falls back to dimensions multiplied by weights for legacy reports", () => {
  const explanation = buildScoreExplanation({ ...base, severity_cap: null }, 100);

  assert.equal(explanation.weightedScoreBeforeCap, 100);
  assert.equal(explanation.capLabel, "未触发");
  assert.equal(explanation.capMaximum, null);
});

test("exposes critical cap and preserves deduction details", () => {
  const explanation = buildScoreExplanation({
    ...base,
    weighted_score_before_cap: 67,
    severity_cap: { severity: "CRITICAL", maximum_score: 39 },
    deductions: [{ dimension: "security", rule_type: "full_chain_persistent_ipi", points: 100, evidence_event_ids: [] }],
  }, 39);

  assert.equal(explanation.capLabel, "CRITICAL");
  assert.equal(explanation.capMaximum, 39);
  assert.equal(explanation.deductions[0]?.points, 100);
});
