import type { EvaluationRun } from "./evaluation-types";

export type ComparisonSide = "bare" | "defended";
export type ComparisonMode = "bare_vs_defended";
export type ComparisonStatus = "creating" | "queued" | "running_bare" | "running_defended" | "running_parallel" | "completed" | "partial" | "failed";
export type ComparisonStreamEvent = {
  seq: number;
  side: ComparisonSide;
  run_seq: number;
  event: {
    event_id: string;
    run_id: string;
    timestamp: string;
    type: import("./evaluation-types").EventType;
    payload?: Record<string, unknown>;
  };
};
export type ComparisonTransition = "defense_blocked" | "both_pass" | "defense_failed" | "possible_regression" | "incomplete";

export type ComparisonCaseResult = {
  test_case_id: string;
  bare_verdict: string | null;
  defended_verdict: string | null;
  transition: ComparisonTransition;
  bare_findings?: ComparisonFinding[];
  defended_findings?: ComparisonFinding[];
};

export type ComparisonFinding = {
  finding_id?: string | null;
  severity?: string | null;
  description?: string | null;
  rule_types?: string[];
  evidence_count?: number;
};

export type ComparisonSummary = {
  total: number;
  comparable: number;
  bare_passed: number;
  defended_passed: number;
  defense_blocked: number;
  bare_pass_rate: number;
  defended_pass_rate: number;
  pass_rate_delta: number;
};

export type ComparisonRunSnapshot = EvaluationRun;

export type EvaluationComparison = {
  comparison_id: string;
  mode: ComparisonMode;
  test_case_ids: string[];
  bare_run_id: string;
  defended_run_id: string | null;
  status: ComparisonStatus;
  comparison_seed: string;
  bare_run: ComparisonRunSnapshot;
  defended_run: ComparisonRunSnapshot | null;
};

export type ComparisonReport = {
  comparison_id: string;
  mode: ComparisonMode;
  test_case_ids: string[];
  status: ComparisonStatus;
  bare_run_id: string;
  defended_run_id: string | null;
  summary: ComparisonSummary;
  results: ComparisonCaseResult[];
};
