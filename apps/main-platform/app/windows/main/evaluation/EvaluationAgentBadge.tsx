"use client";

import { Bot, Brain, ShieldCheck } from "lucide-react";
import { getEvaluationAgentMeta } from "./evaluation-agent";

function AgentIcon({ agentId }: { agentId: string }) {
  if (agentId === "llm-agent-v0") return Brain;
  if (agentId === "defended-llm-v0") return ShieldCheck;
  return Bot;
}

export function EvaluationAgentBadge({
  agentId,
  compact = false,
}: {
  agentId: string | null | undefined;
  compact?: boolean;
}) {
  const meta = getEvaluationAgentMeta(agentId);
  const Icon = AgentIcon({ agentId: meta.id });
  return (
    <span className={`evaluation-agent-badge is-${meta.tone} ${compact ? "is-compact" : ""}`} title={meta.label}>
      <Icon size={compact ? 13 : 14} aria-hidden="true" />
      <span>{compact ? meta.shortLabel : meta.label}</span>
    </span>
  );
}
