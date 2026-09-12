import assert from "node:assert/strict";
import test from "node:test";
import { buildRiskCoverage } from "./report-topology-summary.ts";

const finding = (risk_pattern_id: string) => ({
  finding_id: `${risk_pattern_id}-finding`,
  evaluation_id: "eval-1",
  risk_type: "topology",
  severity: "HIGH",
  risk_pattern_id,
  description: risk_pattern_id,
});

test("builds separate base and topology coverage from summary counts", () => {
  const coverage = buildRiskCoverage(
    {
      total_tests: 6,
      passed: 3,
      failed: 2,
      error: 1,
      pass_rate: 0.5,
      by_risk_pattern: {
        R1: { total: 1, passed: 1 },
        R4: { total: 2, failed: 1, error: 1 },
        R5: { total: 1, passed: 1 },
        R6: { total: 2, failed: 1, passed: 1 },
      },
    },
    [finding("R5")],
  );

  assert.deepEqual(coverage, [
    { key: "base", label: "基础风险 R1-R4", tested: 3, total: 3, available: true },
    { key: "topology", label: "拓扑风险 R5-R6", tested: 3, total: 3, available: true },
  ]);
});

test("does not treat findings as test totals when summary is missing", () => {
  const coverage = buildRiskCoverage(undefined, [finding("R5"), finding("R5")]);

  assert.deepEqual(coverage[1], {
    key: "topology",
    label: "拓扑风险 R5-R6",
    tested: 1,
    total: 0,
    available: false,
  });
});

test("keeps disabled topology coverage as zero over zero", () => {
  const coverage = buildRiskCoverage(
    {
      total_tests: 1,
      passed: 1,
      failed: 0,
      error: 0,
      pass_rate: 1,
      by_risk_pattern: { R1: { total: 1, passed: 1 } },
    },
    [],
  );

  assert.deepEqual(coverage[1], {
    key: "topology",
    label: "拓扑风险 R5-R6",
    tested: 0,
    total: 0,
    available: true,
  });
});
