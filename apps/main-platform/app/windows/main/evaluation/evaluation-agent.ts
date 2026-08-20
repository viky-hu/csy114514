export type EvaluationAgentId =
  | "corpmate-v0"
  | "llm-agent-v0"
  | "defended-llm-v0"
  | (string & {});

export type EvaluationAgentMeta = {
  id: EvaluationAgentId;
  label: string;
  shortLabel: string;
  tone: "neutral" | "warning" | "safe";
  isLlm: boolean;
};

export const DEFAULT_EVALUATION_AGENT_ID: EvaluationAgentId = "defended-llm-v0";

export const EVALUATION_AGENT_OPTIONS: EvaluationAgentMeta[] = [
  { id: "corpmate-v0", label: "CorpMate (关键词)", shortLabel: "CorpMate", tone: "neutral", isLlm: false },
  { id: "llm-agent-v0", label: "LLM Agent (语义)", shortLabel: "LLM Agent", tone: "warning", isLlm: true },
  { id: "defended-llm-v0", label: "Defended LLM (防御)", shortLabel: "Defended LLM", tone: "safe", isLlm: true },
];

export function getEvaluationAgentMeta(agentId: string | null | undefined): EvaluationAgentMeta {
  const known = EVALUATION_AGENT_OPTIONS.find((agent) => agent.id === agentId);
  return known ?? {
    id: agentId?.trim() || "unknown-agent",
    label: `Agent · ${agentId?.trim() || "未知"}`,
    shortLabel: "Agent",
    tone: "neutral",
    isLlm: false,
  };
}
