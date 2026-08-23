"use client";

import { CircleAlert } from "lucide-react";
import { BatchProgressPanel } from "./BatchProgressPanel";
import { useEvaluationWorkspace } from "./EvaluationWorkspaceProvider";
import { EvaluationTerminal } from "./EvaluationRunWorkspace";
import type { ComparisonSide } from "./comparison-types";

function isRetryable(status: string) {
  return ["failed", "interrupted", "preflight_failed"].includes(status);
}

function sideLabel(side: ComparisonSide) {
  return side === "bare" ? "Bare" : "Defended";
}

export function EvaluationComparisonRunWorkspace() {
  const { comparison, comparisonEvents, comparisonError, retryComparison } = useEvaluationWorkspace();

  if (!comparison || !comparison.defended_run) return null;
  const sides = [
    { side: "bare" as const, run: comparison.bare_run },
    { side: "defended" as const, run: comparison.defended_run },
  ];

  return (
    <section className="evaluation-comparison-run-workspace" aria-label="Bare 与 Defended 实时测评运行">
      <div className="evaluation-comparison-run-content">
        {comparisonError && <div className="evaluation-comparison-error"><CircleAlert size={16} />{comparisonError}</div>}
        <div className="evaluation-comparison-run-grid">
          {sides.map(({ side, run }) => (
            <div className={`evaluation-comparison-run-group is-${side}`} key={side}>
              <BatchProgressPanel
                runOverride={run}
                eventsOverride={comparisonEvents[side]}
                showControls={false}
                sideLabel={sideLabel(side)}
                onRetry={isRetryable(run.status) ? () => void retryComparison(side) : undefined}
              />
              <EvaluationTerminal events={comparisonEvents[side]} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
