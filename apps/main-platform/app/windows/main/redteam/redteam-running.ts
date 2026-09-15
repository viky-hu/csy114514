import type { RedTeamEvent, RedTeamRun } from "./redteam-mock";

export type RedTeamStepState = "waiting" | "running" | "complete" | "error";

export type RedTeamStep = {
  key: "seeds" | "variants" | "evaluation" | "weights";
  title: string;
  state: RedTeamStepState;
  summary: string;
  detail: string;
  code: string;
};

type RedTeamEventKind = "runner" | "agent" | "tool" | "memory" | "judge";

const STEP_COPY = [
  { key: "seeds", title: "选取种子", code: "select_seeds(testCases, seed_count)" },
  { key: "variants", title: "生成变体", code: "mutate_batch(seeds, active, variants_per_seed)" },
  { key: "evaluation", title: "沙箱测评", code: "adapter.evaluate(run_id, variant)" },
  { key: "weights", title: "调整权重", code: "update_weights(weights, feedback)" },
] as const;

function payloadString(event: RedTeamEvent | undefined, key: string) {
  const value = event?.payload?.[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function latest(events: RedTeamEvent[], type: string) {
  return events
    .filter((event) => event.type === type)
    .sort((a, b) => a.seq - b.seq || a.timestamp.localeCompare(b.timestamp))
    .at(-1);
}

function count(events: RedTeamEvent[], type: string) {
  return events.filter((event) => event.type === type).length;
}

function strategyLabel(strategy: string | null) {
  if (!strategy) return "策略待定";
  const labels: Record<string, string> = {
    prompt_injection: "注入策略",
    memory_poisoning: "记忆污染",
    tool_misuse: "工具滥用",
  };
  return labels[strategy] ?? strategy;
}

export function deriveRedTeamSteps(run: RedTeamRun, events: RedTeamEvent[]): RedTeamStep[] {
  const expectedVariants = Math.max(1, run.config.rounds * run.config.seed_count * run.config.variants_per_seed);
  const created = count(events, "VARIANT_CREATED");
  const evaluated = count(events, "VARIANT_EVALUATED");
  const weights = count(events, "WEIGHTS_UPDATED");
  const failed = run.status === "failed";
  const backendComplete = run.status === "completed";
  const completion = [
    events.some((event) => event.type === "SEEDS_SELECTED"),
    created >= expectedVariants,
    evaluated >= expectedVariants,
    weights >= run.config.rounds && backendComplete,
  ];
  const firstIncomplete = completion.findIndex((complete) => !complete);
  const states: RedTeamStepState[] = [
    completion[0] ? "complete" : "waiting",
    completion[1] ? "complete" : "waiting",
    completion[2] ? "complete" : "waiting",
    completion[3] ? "complete" : "waiting",
  ];
  if (firstIncomplete >= 0) {
    if (failed) states[firstIncomplete] = "error";
    else if (run.status === "running") states[firstIncomplete] = "running";
  }

  const seedEvent = latest(events, "SEEDS_SELECTED");
  const variantEvent = latest(events, "VARIANT_CREATED");
  const evaluationEvent = latest(events, "VARIANT_EVALUATED");
  const weightEvent = latest(events, "WEIGHTS_UPDATED");
  const weightAfter = weightEvent?.payload?.weights_after;
  const topWeight = weightAfter && typeof weightAfter === "object"
    ? Object.entries(weightAfter as Record<string, unknown>).sort(([, a], [, b]) => Number(b) - Number(a))[0]
    : null;

  const steps: RedTeamStep[] = [
    {
      ...STEP_COPY[0],
      state: states[0],
      summary: `${payloadString(seedEvent, "count") ?? run.selected_seed_ids.length} 个固定种子已${states[0] === "complete" ? "冻结" : "准备"}`,
      detail: seedEvent ? "后端已锁定本轮样本，不再跨轮次变更" : "等待后端冻结本轮样本集",
    },
    {
      ...STEP_COPY[1],
      state: states[1],
      summary: `${created}/${expectedVariants} 个变体 · ${strategyLabel(payloadString(variantEvent, "strategy"))}`,
      detail: payloadString(variantEvent, "variant_id") ? `最近变体 ${payloadString(variantEvent, "variant_id")}` : "等待变异编排结果",
    },
    {
      ...STEP_COPY[2],
      state: states[2],
      summary: `${evaluated}/${expectedVariants} 个结果 · ${payloadString(evaluationEvent, "conclusion") ?? payloadString(evaluationEvent, "verdict") ?? "等待判定"}`,
      detail: evaluationEvent?.payload?.defense_labels ? `防御标签 ${JSON.stringify(evaluationEvent.payload.defense_labels)}` : "适配器结果将回填防御标签与风险模式",
    },
    {
      ...STEP_COPY[3],
      state: states[3],
      summary: `${weights}/${run.config.rounds} 轮权重 · ${topWeight ? `${strategyLabel(topWeight[0])} ${Number(topWeight[1]).toFixed(2)}` : "等待权重反馈"}`,
      detail: topWeight ? "依据本轮反馈重排下一轮策略优先级" : "等待测评反馈汇总",
    },
  ];
  if (failed && firstIncomplete >= 0 && run.error_message) {
    steps[firstIncomplete].detail = run.error_message;
  }
  return steps;
}

export function redTeamEventKind(event: RedTeamEvent): RedTeamEventKind {
  const strategy = payloadString(event, "strategy");
  if (strategy === "prompt_injection") return "agent";
  if (strategy === "memory_poisoning") return "memory";
  if (event.type === "VARIANT_CREATED" || event.type === "VARIANT_EVALUATED" || strategy === "tool_misuse") return "tool";
  if (event.type === "RUN_COMPLETED") return "judge";
  return "runner";
}

export function formatRedTeamEvent(event: RedTeamEvent) {
  const labels: Record<string, string> = {
    TARGET_VERIFIED: "目标连接已验证",
    SEEDS_SELECTED: "种子集已冻结",
    ROUND_STARTED: "轮次已开始",
    STRATEGIES_SELECTED: "策略已选定",
    VARIANT_CREATED: "攻击变体已生成",
    VARIANT_EVALUATED: "变体测评完成",
    WEIGHTS_UPDATED: "策略权重已更新",
    RUN_COMPLETED: "演练已完成",
  };
  const eventType = typeof event.type === "string" ? event.type.trim() || "BACKEND_EVENT" : "BACKEND_EVENT";
  const strategy = strategyLabel(payloadString(event, "strategy"));
  const message = payloadString(event, "message") ?? payloadString(event, "conclusion") ?? payloadString(event, "verdict");
  const round = payloadString(event, "round");
  const detail = [
    eventType === "ROUND_STARTED" && round ? `第 ${round} 轮开始` : labels[eventType] ?? "后端事件",
    event.type === "STRATEGIES_SELECTED" && round ? `第 ${round} 轮` : null,
    event.type === "VARIANT_CREATED" || event.type === "VARIANT_EVALUATED" ? strategy : null,
    message,
  ].filter(Boolean).join(" · ") || "后端已记录该事件";
  return { label: eventType, detail, kind: redTeamEventKind(event) };
}
