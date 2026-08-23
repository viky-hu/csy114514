import type { EvaluationRun, SequencedEvent } from "./evaluation-types";
import { getEvaluationAgentMeta } from "./evaluation-agent.ts";

export type ActiveInference = {
  invoked: SequencedEvent;
  testCaseId: string | null;
  turnLabel: string;
  startedAt: number;
  waitedSeconds: number;
  isLongWait: boolean;
};

export function isInferenceRunActive(status: EvaluationRun["status"] | undefined, isStarting = false) {
  return isStarting || status === "preflighting" || status === "queued" || status === "running";
}

type CorrelationKey =
  | { kind: "batch"; testCaseId: string; turnIndex: number }
  | { kind: "legacy"; turnId: string; sessionId: string };

function correlationKey(event: SequencedEvent): CorrelationKey | null {
  const payload = event.payload ?? {};
  if (typeof payload.test_case_id === "string" && Number.isInteger(payload.turn_index)) {
    return { kind: "batch", testCaseId: payload.test_case_id, turnIndex: payload.turn_index as number };
  }
  if (typeof payload.turn_id === "string" && typeof payload.session_id === "string") {
    return { kind: "legacy", turnId: payload.turn_id, sessionId: payload.session_id };
  }
  return null;
}

function sameCorrelation(left: CorrelationKey, right: CorrelationKey) {
  if (left.kind !== right.kind) return false;
  return left.kind === "batch" && right.kind === "batch"
    ? left.testCaseId === right.testCaseId && left.turnIndex === right.turnIndex
    : left.kind === "legacy" && right.kind === "legacy"
      ? left.turnId === right.turnId && left.sessionId === right.sessionId
      : false;
}

function turnLabel(event: SequencedEvent, key: CorrelationKey) {
  return key.kind === "batch"
    ? `TestCase ${key.testCaseId} · 第 ${key.turnIndex + 1} 轮`
    : key.turnId;
}

export function findActiveInference(events: SequencedEvent[], agentId: string | null | undefined, now: number): ActiveInference | null {
  if (!getEvaluationAgentMeta(agentId).isLlm) return null;

  const ordered = [...events].sort((left, right) => left.seq - right.seq);
  const responded = ordered
    .filter((event) => event.type === "AGENT_RESPONDED")
    .map(correlationKey)
    .filter((key): key is CorrelationKey => key !== null);
  const pending = ordered
    .filter((event) => event.type === "AGENT_INVOKED")
    .map((invoked) => ({ invoked, key: correlationKey(invoked) }))
    .filter(({ key }) => key !== null && !responded.some((responseKey) => sameCorrelation(key, responseKey)));

  const latest = pending.at(-1);
  if (!latest || !latest.key) return null;
  const startedAt = Date.parse(latest.invoked.timestamp);
  if (!Number.isFinite(startedAt)) return null;
  const waitedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  return {
    invoked: latest.invoked,
    testCaseId: latest.key.kind === "batch" ? latest.key.testCaseId : null,
    turnLabel: turnLabel(latest.invoked, latest.key),
    startedAt,
    waitedSeconds,
    isLongWait: waitedSeconds >= 30,
  };
}
