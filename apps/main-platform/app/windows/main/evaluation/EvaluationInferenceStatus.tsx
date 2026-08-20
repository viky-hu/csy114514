"use client";

import { Brain, Clock3 } from "lucide-react";
import { useLoadingTip } from "../../shared/loading-tips";
import { useEvaluationWorkspace } from "./EvaluationWorkspaceProvider";
import { getEvaluationAgentMeta } from "./evaluation-agent";

export function EvaluationInferenceStatus() {
  const { run, evaluationAgentId, activeInference } = useEvaluationWorkspace();
  const agentId = run?.agent_id ?? evaluationAgentId;
  const meta = getEvaluationAgentMeta(agentId);
  const runningTip = useLoadingTip("running", { active: Boolean(activeInference) });

  if (!activeInference || !meta.isLlm) {
    return null;
  }

  return (
    <section className={`evaluation-inference-status ${activeInference.isLongWait ? "is-long-wait" : ""}`} role="status" aria-live="polite" aria-label={`${meta.label} 推理状态`}>
      <span className="evaluation-visually-hidden">{meta.shortLabel} {activeInference.isLongWait ? "推理时间较长，请耐心等待" : "正在推理"}</span>
      <div className="evaluation-inference-icon" aria-hidden="true"><Brain size={18} /></div>
      <div className="evaluation-inference-copy">
        <strong>{meta.shortLabel} 推理中…</strong>
        <span>{activeInference.turnLabel}</span>
      </div>
      <div className="evaluation-inference-time">
        <Clock3 size={14} aria-hidden="true" />
        <span aria-hidden="true">已等待 {activeInference.waitedSeconds} 秒</span>
      </div>
      <p aria-hidden="true">{activeInference.isLongWait ? "推理时间较长，请耐心等待…" : runningTip}</p>
    </section>
  );
}
