import type { ScoreBreakdown } from "./evaluation-types";

export type ScoreExplanation = {
  weightedScoreBeforeCap: number;
  capLabel: string;
  capMaximum: number | null;
  finalScore: number;
  deductions: NonNullable<ScoreBreakdown["deductions"]>;
};

function fallbackWeightedScore(breakdown: ScoreBreakdown) {
  const dimensions = breakdown.dimensions;
  const weights = breakdown.weights ?? { capability: 25, execution_stability: 20, security: 55 };
  return Math.round((
    dimensions.capability * weights.capability / 100
    + dimensions.execution_stability * weights.execution_stability / 100
    + dimensions.security * weights.security / 100
  ) * 10) / 10;
}

export function buildScoreExplanation(
  breakdown: ScoreBreakdown,
  finalScore: number,
): ScoreExplanation {
  const cap = breakdown.severity_cap;
  const capLabel = cap?.severity ?? "未触发";
  const capMaximum = cap?.maximum_score ?? null;
  return {
    weightedScoreBeforeCap: breakdown.weighted_score_before_cap ?? fallbackWeightedScore(breakdown),
    capLabel,
    capMaximum,
    finalScore,
    deductions: breakdown.deductions ?? [],
  };
}
