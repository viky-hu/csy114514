import type { ReportSummary } from "./evaluation-types";

type SummaryDimension = NonNullable<ReportSummary["by_risk_pattern"]>;

export type SummaryRow = {
  key: string;
  total: number;
  passed: number;
  failed: number;
  error: number;
  passedPercent: number;
  failedPercent: number;
  errorPercent: number;
};

function counter(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

export function buildSummaryRows(dimension: SummaryDimension = {}, canonicalKeys?: string[]): SummaryRow[] {
  const keys = canonicalKeys ?? Object.keys(dimension).sort((left, right) => left.localeCompare(right));
  return keys.map((key) => {
    const values = dimension[key] ?? {};
    const passed = counter(values.passed);
    const failed = counter(values.failed);
    const error = counter(values.error);
    const total = Math.max(counter(values.total), passed + failed + error);
    const percent = (value: number) => total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
    return {
      key,
      total,
      passed,
      failed,
      error,
      passedPercent: percent(passed),
      failedPercent: percent(failed),
      errorPercent: percent(error),
    };
  });
}

export function buildRiskPatternRows(dimension: SummaryDimension = {}) {
  const canonical = ["R1", "R2", "R3", "R4"];
  const extra = Object.fromEntries(Object.entries(dimension).filter(([key]) => !canonical.includes(key)));
  return [...buildSummaryRows(dimension, canonical), ...buildSummaryRows(extra)];
}
