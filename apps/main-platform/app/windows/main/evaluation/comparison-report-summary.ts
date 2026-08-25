import type { ComparisonCaseResult, ComparisonFinding, ComparisonTransition } from "./comparison-types.ts";
import type { TestCaseSummary } from "./evaluation-types.ts";

export const COMPARISON_TRANSITION_ORDER = [
  "possible_regression",
  "defense_failed",
  "incomplete",
  "defense_blocked",
  "both_pass",
] as const satisfies readonly ComparisonTransition[];

export const RISK_PATTERN_ORDER = ["R1", "R2", "R3", "R4", "OTHER"] as const;

export type ComparisonConclusionTone = "positive" | "warning" | "critical" | "neutral";

export type ComparisonLedgerRow = ComparisonCaseResult & {
  testCase: TestCaseSummary | null;
  riskPattern: string;
  findings: {
    bare: ComparisonFinding[];
    defended: ComparisonFinding[];
  };
  severity: string | null;
  ruleTypes: string[];
  redactedSummary: string;
};

export type ComparisonPatternSummary = {
  key: string;
  total: number;
  comparable: number;
  barePassed: number;
  defendedPassed: number;
  transitions: Record<ComparisonTransition, number>;
};

export type ComparisonLedgerGroup = {
  key: ComparisonTransition;
  label: string;
  rows: ComparisonLedgerRow[];
};

export type ComparisonReportSummary = {
  coverage: {
    total: number;
    comparable: number;
    incomplete: number;
  };
  rates: {
    barePassed: number;
    defendedPassed: number;
    barePassRate: number;
    defendedPassRate: number;
    passRateDelta: number;
  };
  passRateDeltaPoints: number;
  transitions: Record<ComparisonTransition, number>;
  patterns: ComparisonPatternSummary[];
  ledgerGroups: ComparisonLedgerGroup[];
  conclusion: {
    tone: ComparisonConclusionTone;
    headline: string;
    detail: string;
  };
};

const TRANSITION_LABELS: Record<ComparisonTransition, string> = {
  defense_blocked: "防御阻断",
  both_pass: "稳定通过",
  defense_failed: "未解决",
  possible_regression: "可能误伤",
  incomplete: "异常/不可比",
};

const EMPTY_TRANSITIONS = (): Record<ComparisonTransition, number> => ({
  defense_blocked: 0,
  both_pass: 0,
  defense_failed: 0,
  possible_regression: 0,
  incomplete: 0,
});

function isComparable(row: Pick<ComparisonCaseResult, "bare_verdict" | "defended_verdict">) {
  return ["PASS", "FAIL"].includes((row.bare_verdict ?? "").toUpperCase())
    && ["PASS", "FAIL"].includes((row.defended_verdict ?? "").toUpperCase());
}

function normalizeRiskPattern(value: string | null | undefined) {
  const pattern = value?.toUpperCase() ?? "";
  return RISK_PATTERN_ORDER.includes(pattern as (typeof RISK_PATTERN_ORDER)[number]) ? pattern : "OTHER";
}

function uniqueRuleTypes(findings: ComparisonFinding[]) {
  return [...new Set(findings.flatMap((finding) => finding.rule_types ?? []).filter(Boolean))];
}

function redactFindingSummary(findings: ComparisonFinding[]) {
  const descriptions = findings
    .map((finding) => finding.description?.trim())
    .filter((description): description is string => Boolean(description));
  return descriptions[0] ?? "未返回可展示的脱敏摘要。";
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? value.toString() : value.toFixed(1);
}

function deriveConclusion(
  coverage: ComparisonReportSummary["coverage"],
  rates: ComparisonReportSummary["rates"],
  transitions: ComparisonReportSummary["transitions"],
  passRateDeltaPoints: number,
): ComparisonReportSummary["conclusion"] {
  const denominator = `安全通过率仅按 ${coverage.comparable} 条双侧均为明确 PASS/FAIL 的可比 Case 计算`;
  if (coverage.comparable === 0) {
    return {
      tone: "neutral",
      headline: "样本尚不足以判断防御成效",
      detail: `本次共 ${coverage.total} 条测试，${coverage.incomplete} 条为异常或不可比结果；${denominator}。`,
    };
  }
  if (transitions.possible_regression > 0) {
    return {
      tone: "critical",
      headline: `检测到 ${transitions.possible_regression} 条可能误伤，需要优先复核`,
      detail: `${denominator}；Defended 相对 Bare 变化 ${formatPoints(passRateDeltaPoints)} 个百分点，另有 ${transitions.defense_failed} 条残余风险未解决。`,
    };
  }
  if (transitions.defense_failed > 0) {
    return {
      tone: "warning",
      headline: `防御已产生改善，但仍有 ${transitions.defense_failed} 条残余风险`,
      detail: `${denominator}；Defended 相对 Bare 提升 ${formatPoints(passRateDeltaPoints)} 个百分点，已阻断 ${transitions.defense_blocked} 条风险路径。`,
    };
  }
  if (rates.passRateDelta > 0 || transitions.defense_blocked > 0) {
    return {
      tone: "positive",
      headline: `防御在 ${coverage.comparable} 条可比 Case 中提升了 ${formatPoints(passRateDeltaPoints)} 个百分点`,
      detail: `${denominator}；已阻断 ${transitions.defense_blocked} 条风险路径，${transitions.both_pass} 条测试保持稳定通过。`,
    };
  }
  return {
    tone: "neutral",
    headline: "防御结果未显示安全通过率提升",
    detail: `${denominator}；${transitions.both_pass} 条测试稳定通过，${coverage.incomplete} 条异常或不可比结果未纳入分母。`,
  };
}

export function deriveComparisonReportSummary(
  results: ComparisonCaseResult[],
  testCases: TestCaseSummary[],
): ComparisonReportSummary {
  const testCaseById = new Map(testCases.map((testCase) => [testCase.id, testCase]));
  const rows: ComparisonLedgerRow[] = results.map((result) => {
    const testCase = testCaseById.get(result.test_case_id) ?? null;
    const findings = {
      bare: result.bare_findings ?? [],
      defended: result.defended_findings ?? [],
    };
    const allFindings = [...findings.bare, ...findings.defended];
    return {
      ...result,
      bare_verdict: result.bare_verdict?.toUpperCase() ?? null,
      defended_verdict: result.defended_verdict?.toUpperCase() ?? null,
      testCase,
      riskPattern: normalizeRiskPattern(testCase?.target_risk_pattern),
      findings,
      severity: testCase?.severity ?? allFindings.find((finding) => finding.severity)?.severity ?? null,
      ruleTypes: uniqueRuleTypes(allFindings),
      redactedSummary: redactFindingSummary(allFindings),
    };
  });
  const comparableRows = rows.filter(isComparable);
  const barePassed = comparableRows.filter((row) => row.bare_verdict === "PASS").length;
  const defendedPassed = comparableRows.filter((row) => row.defended_verdict === "PASS").length;
  const barePassRate = comparableRows.length ? barePassed / comparableRows.length : 0;
  const defendedPassRate = comparableRows.length ? defendedPassed / comparableRows.length : 0;
  const rates = {
    barePassed,
    defendedPassed,
    barePassRate,
    defendedPassRate,
    passRateDelta: defendedPassRate - barePassRate,
  };
  const transitions = rows.reduce((counts, row) => {
    counts[row.transition] += 1;
    return counts;
  }, EMPTY_TRANSITIONS());
  const coverage = {
    total: rows.length,
    comparable: comparableRows.length,
    incomplete: rows.length - comparableRows.length,
  };
  const passRateDeltaPoints = Math.round(rates.passRateDelta * 1000) / 10;
  const patterns = RISK_PATTERN_ORDER
    .map((key) => {
      const patternRows = rows.filter((row) => row.riskPattern === key);
      const comparablePatternRows = patternRows.filter(isComparable);
      return {
        key,
        total: patternRows.length,
        comparable: comparablePatternRows.length,
        barePassed: comparablePatternRows.filter((row) => row.bare_verdict === "PASS").length,
        defendedPassed: comparablePatternRows.filter((row) => row.defended_verdict === "PASS").length,
        transitions: patternRows.reduce((counts, row) => {
          counts[row.transition] += 1;
          return counts;
        }, EMPTY_TRANSITIONS()),
      };
    })
    .filter((pattern) => pattern.total > 0);
  const ledgerGroups = COMPARISON_TRANSITION_ORDER
    .map((key) => ({
      key,
      label: TRANSITION_LABELS[key],
      rows: rows.filter((row) => row.transition === key),
    }))
    .filter((group) => group.rows.length > 0);

  return {
    coverage,
    rates,
    passRateDeltaPoints,
    transitions,
    patterns,
    ledgerGroups,
    conclusion: deriveConclusion(coverage, rates, transitions, passRateDeltaPoints),
  };
}

export function comparisonTransitionLabel(transition: ComparisonTransition) {
  return TRANSITION_LABELS[transition];
}
