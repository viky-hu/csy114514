import type { components } from "../../../lib/contracts/backend-api";

export type EvaluationRun = components["schemas"]["EvaluationRun"];
export type EvaluationReport = components["schemas"]["EvaluationReport"];
export type ExecutionTrace = components["schemas"]["ExecutionTrace"];
export type ExecutionEvent = components["schemas"]["ExecutionEvent"];
export type EventType = components["schemas"]["EventType"];
export type ScoreBreakdown = components["schemas"]["ScoreBreakdown"];
export type ReportSummary = components["schemas"]["ReportSummary"];
export type TestCaseSummary = components["schemas"]["TestCaseSummary"];
export type RiskFinding = components["schemas"]["RiskFinding"];
export type CreateEvaluationRequest = components["schemas"]["CreateEvaluationRequest"];

export type SequencedEvent = ExecutionEvent & {
  seq: number;
};

export type EvaluationStage = NonNullable<EvaluationRun["current_stage"]>;

export const EVALUATION_STAGES: EvaluationStage[] = [
  "web_content_injection",
  "persistent_memory_poisoning",
  "unconfirmed_email_send",
];

export function isTerminalStatus(status: EvaluationRun["status"] | undefined) {
  return status === "completed" || status === "failed" || status === "interrupted";
}

export function isEvaluationStage(value: unknown): value is EvaluationStage {
  return typeof value === "string" && EVALUATION_STAGES.includes(value as EvaluationStage);
}

export function eventStage(event: SequencedEvent): EvaluationStage | null {
  const stage = event.payload?.stage;
  if (isEvaluationStage(stage)) {
    return stage;
  }

  if (event.type === "PREFLIGHT_COMPLETED") {
    return "web_content_injection";
  }
  if (event.type === "JUDGE_DECISION" || event.type === "FINDING_CREATED") {
    return "unconfirmed_email_send";
  }
  return null;
}

export function reduceEvaluationEvent(
  current: { events: SequencedEvent[]; activeStage: EvaluationStage | null },
  event: SequencedEvent,
) {
  if (current.events.some((item) => item.seq === event.seq)) {
    return current;
  }
  const events = [...current.events, event].sort((left, right) => left.seq - right.seq);
  const activeStage = [...events]
    .reverse()
    .map(eventStage)
    .find((stage): stage is EvaluationStage => stage !== null);
  return { events, activeStage: activeStage ?? current.activeStage };
}

export function eventText(event: SequencedEvent) {
  const payload = event.payload ?? {};
  const callId = typeof payload.call_id === "string" ? ` ${payload.call_id}` : "";
  const tool = typeof payload.tool_name === "string" ? payload.tool_name : "";
  const messages: Partial<Record<EventType, string>> = {
    PREFLIGHT_COMPLETED: "预检完成：变异页面已注册并可读取",
    PREFLIGHT_FAILED: "预检失败：页面载荷未通过读取校验",
    RUN_STARTED: "Runner 已领取运行，开始执行 TestCase",
    TEST_STARTED: "TestCase 开始执行",
    AGENT_INVOKED: "Agent 会话已调用",
    AGENT_RESPONDED: "Agent 返回响应",
    TOOL_CALLED: `Tool 已调用${tool ? ` · ${tool}` : ""}${callId}`,
    TOOL_RESULT: `${tool || "Tool"} 返回结果${payload.success === false ? " · 运行错误" : ""}`,
    MEMORY_WRITTEN: "持久记忆写入完成",
    JUDGE_DECISION: "Judge 已完成因果裁决",
    FINDING_CREATED: "已生成风险发现与证据绑定",
    RUN_FAILED: "运行因基础设施异常终止",
    RUN_FINISHED: "测评运行结束",
    TEST_COMPLETED: `TestCase 已完成${typeof payload.verdict === "string" ? ` · ${payload.verdict}` : ""}`,
  };
  return messages[event.type] ?? event.type;
}
