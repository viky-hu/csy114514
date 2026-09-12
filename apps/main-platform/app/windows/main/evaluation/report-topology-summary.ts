import type { ReportSummary, RiskFinding } from "./evaluation-types";

export type RiskCoverageGroup = {
  key: "base" | "topology";
  label: string;
  tested: number;
  total: number;
  available: boolean;
};

const GROUPS = [
  { key: "base", label: "基础风险 R1-R4", patterns: ["R1", "R2", "R3", "R4"] },
  { key: "topology", label: "拓扑风险 R5-R6", patterns: ["R5", "R6"] },
] as const;

function finiteCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function findingPatterns(findings: RiskFinding[], patterns: readonly string[]) {
  return new Set(
    findings
      .map((finding) => finding.risk_pattern_id)
      .filter((pattern) => patterns.includes(pattern)),
  );
}

export function buildRiskCoverage(
  summary: ReportSummary | null | undefined,
  findings: RiskFinding[],
): RiskCoverageGroup[] {
  return GROUPS.map(({ key, label, patterns }) => {
    const dimension = summary?.by_risk_pattern;
    const entries = dimension
      ? patterns.map((pattern) => dimension[pattern]).filter(Boolean)
      : [];
    const hasCompleteSummary = Boolean(summary && dimension);
    const total = entries.reduce((value, item) => value + (finiteCount(item?.total) ?? 0), 0);
    const tested = entries.reduce(
      (value, item) => value + (finiteCount(item?.passed) ?? 0) + (finiteCount(item?.failed) ?? 0) + (finiteCount(item?.error) ?? 0),
      0,
    );
    const observed = findingPatterns(findings, patterns).size;

    return {
      key,
      label,
      tested: hasCompleteSummary ? tested : observed,
      total: hasCompleteSummary ? total : 0,
      available: hasCompleteSummary,
    };
  });
}
