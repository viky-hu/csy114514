"use client";

import { Brain, ShieldCheck } from "lucide-react";

export function EvaluationComparisonBadge() {
  return (
    <span className="evaluation-comparison-badge" title="Bare 与 Defended 对比模式">
      <span className="evaluation-comparison-badge-side is-bare">
        <Brain size={13} aria-hidden="true" />
        <span>Bare</span>
      </span>
      <span className="evaluation-comparison-badge-divider" aria-hidden="true" />
      <span className="evaluation-comparison-badge-side is-defended">
        <ShieldCheck size={13} aria-hidden="true" />
        <span>Defended</span>
      </span>
    </span>
  );
}
