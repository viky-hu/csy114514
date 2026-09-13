export type RedTeamConnection = {
  connection_id: string;
  agent_id: string;
  endpoint: string;
  adapter_metadata: { protocol_version?: string; environment?: string };
  created_at: string;
};

export type RedTeamRun = {
  run_id: string;
  agent_id: string;
  connection_id: string;
  status: "queued" | "running" | "completed" | "failed";
  current_round: number;
  last_event_seq: number;
  report_available: boolean;
  error_message?: string | null;
  selected_seed_ids: string[];
  config: { rounds: number; seed_count: number; variants_per_seed: number };
};

export type RedTeamEvent = {
  event_id: string;
  run_id: string;
  seq: number;
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
};

export type RedTeamReport = {
  run_id: string;
  conclusion: "exposure_confirmed" | "coverage_incomplete" | "no_bypass_observed";
  outcome_summary: Record<string, number>;
  strategy_effectiveness?: Array<{ strategy: string; variants: number; bypasses: number; weight_final: number }>;
  round_evolution?: Array<{ round: number; variants: number; active_strategies: string[] }>;
  weight_snapshots?: Array<{ round: number; weights_before: Record<string, number>; weights_after: Record<string, number>; active_strategies: string[] }>;
  bypasses?: Array<{ variant_id: string; seed_id: string; strategy: string; risk_pattern: string }>;
};

const MOCK_CONFIG = { rounds: 2, seed_count: 4, variants_per_seed: 2 };

export function createMockRedTeamConnection(agentId: string): RedTeamConnection {
  return {
    connection_id: `mock-redteam-connection-${agentId}`,
    agent_id: agentId,
    endpoint: "mock://redteam/sandbox",
    adapter_metadata: { protocol_version: "mock-1.0", environment: "evaluation sandbox" },
    created_at: "2023-11-14T22:13:20.000Z",
  };
}

export function createMockRedTeamRun(connection: RedTeamConnection, timestamp = 1_700_000_000_000): RedTeamRun {
  return {
    run_id: `mock-redteam-run-${connection.agent_id}`,
    agent_id: connection.agent_id,
    connection_id: connection.connection_id,
    status: "completed",
    current_round: MOCK_CONFIG.rounds,
    last_event_seq: 8,
    report_available: true,
    error_message: null,
    selected_seed_ids: ["mock-r1", "mock-r2", "mock-r3", "mock-r4"],
    config: { ...MOCK_CONFIG },
  };
}

export function buildMockRedTeamEvents(run: RedTeamRun, timestamp = 1_700_000_000_000): RedTeamEvent[] {
  const data: Array<[string, Record<string, unknown>]> = [
    ["SEEDS_SELECTED", { message: "固定种子集已冻结", seed_count: 4 }],
    ["VARIANT_CREATED", { strategy: "prompt_injection", message: "生成注入变体" }],
    ["VARIANT_EVALUATED", { strategy: "prompt_injection", conclusion: "防御层已拦截" }],
    ["WEIGHTS_UPDATED", { strategy: "memory_poisoning", message: "记忆污染权重上调" }],
    ["VARIANT_CREATED", { strategy: "memory_poisoning", message: "生成跨会话变体" }],
    ["VARIANT_EVALUATED", { strategy: "memory_poisoning", conclusion: "发现可复算绕过" }],
    ["WEIGHTS_UPDATED", { strategy: "tool_misuse", message: "工具滥用进入下一轮" }],
    ["RUN_COMPLETED", { conclusion: "exposure_confirmed", message: "模拟演练完成" }],
  ];
  return data.map(([type, payload], index) => ({
    event_id: `${run.run_id}-event-${index + 1}`,
    run_id: run.run_id,
    seq: index + 1,
    timestamp: new Date(timestamp + index * 1_000).toISOString(),
    type,
    payload,
  }));
}

export function createMockRedTeamReport(run: RedTeamRun): RedTeamReport {
  return {
    run_id: run.run_id,
    conclusion: "exposure_confirmed",
    outcome_summary: { confirmed_bypass: 1, defense_success: 5, not_exercised: 1, execution_error: 0, inconclusive: 1 },
    strategy_effectiveness: [
      { strategy: "prompt_injection", variants: 4, bypasses: 0, weight_final: 0.28 },
      { strategy: "memory_poisoning", variants: 5, bypasses: 1, weight_final: 0.61 },
      { strategy: "tool_misuse", variants: 3, bypasses: 0, weight_final: 0.34 },
    ],
    round_evolution: [
      { round: 1, variants: 6, active_strategies: ["prompt_injection", "memory_poisoning", "tool_misuse"] },
      { round: 2, variants: 6, active_strategies: ["memory_poisoning", "tool_misuse", "prompt_injection"] },
    ],
    weight_snapshots: [
      { round: 1, weights_before: { prompt_injection: 0.33, memory_poisoning: 0.33, tool_misuse: 0.33 }, weights_after: { prompt_injection: 0.28, memory_poisoning: 0.55, tool_misuse: 0.36 }, active_strategies: ["prompt_injection", "memory_poisoning", "tool_misuse"] },
      { round: 2, weights_before: { prompt_injection: 0.28, memory_poisoning: 0.55, tool_misuse: 0.36 }, weights_after: { prompt_injection: 0.28, memory_poisoning: 0.61, tool_misuse: 0.34 }, active_strategies: ["memory_poisoning", "tool_misuse", "prompt_injection"] },
    ],
    bypasses: [{ variant_id: "mock-variant-07", seed_id: "mock-r2", strategy: "memory_poisoning", risk_pattern: "R2 persistent memory" }],
  };
}
