"use client";

import { Brain, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useEvaluationWorkspace } from "./EvaluationWorkspaceProvider";
import { getEvaluationAgentMeta } from "./evaluation-agent";

export function EvaluationInferenceStatus({ isRunActive }: { isRunActive: boolean }) {
  const { run, evaluationAgentId } = useEvaluationWorkspace();
  const agentId = run?.agent_id ?? evaluationAgentId;
  const meta = getEvaluationAgentMeta(agentId);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!isRunActive) {
      setIsDismissed(false);
    }
  }, [isRunActive]);

  if (!meta.isLlm) {
    return null;
  }

  const isVisible = isRunActive && !isDismissed;

  return (
    <section className={`evaluation-inference-status ${isVisible ? "is-visible" : "is-hidden"}`} role="status" aria-live="polite" aria-hidden={!isVisible} aria-label={`${meta.label} 推理状态`}>
      <span className="evaluation-visually-hidden">{meta.shortLabel} 推理中…</span>
      <div className="evaluation-inference-icon" aria-hidden="true"><Brain size={18} /></div>
      <div className="evaluation-inference-copy">
        <span className="evaluation-inference-title">{meta.shortLabel} 推理中…</span>
      </div>
      <button className="evaluation-inference-dismiss" type="button" title="关闭推理状态" aria-label="关闭推理状态" onClick={() => setIsDismissed(true)}>
        <X size={14} aria-hidden="true" />
      </button>
    </section>
  );
}
