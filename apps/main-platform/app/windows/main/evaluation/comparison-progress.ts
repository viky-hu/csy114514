import type { ComparisonCaseResult, ComparisonTransition } from "./comparison-types.ts";

export type ComparisonRow = ComparisonCaseResult;

export function compareComparisonRows(results: ComparisonCaseResult[]): ComparisonRow[] {
  return results.map((result) => ({
    ...result,
    bare_verdict: result.bare_verdict?.toUpperCase() ?? null,
    defended_verdict: result.defended_verdict?.toUpperCase() ?? null,
  }));
}

export function transitionLabel(transition: ComparisonTransition) {
  return {
    defense_blocked: "防御阻断",
    both_pass: "两者通过",
    defense_failed: "防御未生效",
    possible_regression: "可能误伤",
    incomplete: "等待/异常",
  }[transition];
}

export function summarizeComparisonRows(rows: ComparisonRow[]) {
  const comparable = rows.filter((row) => ["PASS", "FAIL"].includes(row.bare_verdict ?? "") && ["PASS", "FAIL"].includes(row.defended_verdict ?? ""));
  const barePassed = comparable.filter((row) => row.bare_verdict === "PASS").length;
  const defendedPassed = comparable.filter((row) => row.defended_verdict === "PASS").length;
  const barePassRate = comparable.length ? barePassed / comparable.length : 0;
  const defendedPassRate = comparable.length ? defendedPassed / comparable.length : 0;
  return {
    total: rows.length,
    comparable: comparable.length,
    defenseBlocked: comparable.filter((row) => row.transition === "defense_blocked").length,
    barePassRate,
    defendedPassRate,
    passRateDelta: defendedPassRate - barePassRate,
  };
}
