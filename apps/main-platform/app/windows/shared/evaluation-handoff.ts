"use client";

export type EvaluationHandoff = {
  agentId: string;
  riskPatternId: string;
  testCaseId: string;
};

export const EVALUATION_HANDOFF_STORAGE_KEY = "csy_pending_evaluation_testcase";

export function writeEvaluationHandoff(handoff: EvaluationHandoff) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    EVALUATION_HANDOFF_STORAGE_KEY,
    JSON.stringify(handoff),
  );
}

export function readEvaluationHandoff() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(EVALUATION_HANDOFF_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as EvaluationHandoff;
  } catch {
    return null;
  }
}
