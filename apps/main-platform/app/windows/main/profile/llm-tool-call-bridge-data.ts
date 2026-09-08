export type BridgeDisplayStage = {
  displayId: "D3" | "D4" | "D5" | "D6" | "D7";
  canonicalId: "D5" | "D6" | "D7" | "D8" | "D2";
  label: string;
  scope: string;
  applicability: string;
  blockedLabel: string;
  displayIndex: number;
};

export type BridgeReasoningStep = {
  id: "understand" | "context" | "tools" | "arguments";
  label: string;
};

export const D2_HANDOFF_SUMMARY = [
  { id: "system", label: "受保护系统约束" },
  { id: "user", label: "用户请求" },
  { id: "external", label: "不可信数据" },
] as const;

export const LLM_REASONING_STEPS: readonly BridgeReasoningStep[] = [
  { id: "understand", label: "理解用户请求" },
  { id: "context", label: "读取会话上下文" },
  { id: "tools", label: "选择可用工具" },
  { id: "arguments", label: "生成结构化参数" },
];

export const TOOL_CALL_SAMPLE = {
  functionName: "email.send",
  callId: "call_email_017",
  status: "待审",
  arguments: {
    to: "colleague@company.example",
    subject: "待发送摘要",
    body: "请确认这封邮件内容后再发送。",
  },
} as const;

export const TOOL_CALL_PIPELINE: readonly BridgeDisplayStage[] = [
  {
    displayId: "D3",
    canonicalId: "D5",
    label: "因果链检测",
    scope: "每一个 tool call",
    applicability: "追踪最近工具调用序列",
    blockedLabel: "D5:browse_send_chain",
    displayIndex: 3,
  },
  {
    displayId: "D4",
    canonicalId: "D6",
    label: "意图分类",
    scope: "page_instructed >= 0.6",
    applicability: "判断来源是用户还是页面",
    blockedLabel: "D6:page_instructed_email.send",
    displayIndex: 4,
  },
  {
    displayId: "D5",
    canonicalId: "D7",
    label: "记忆审计",
    scope: "memory.write only",
    applicability: "当前 email.send 样例跳过",
    blockedLabel: "D7:blocked_suspicious_memory",
    displayIndex: 5,
  },
  {
    displayId: "D6",
    canonicalId: "D8",
    label: "会话监控",
    scope: "email.send 触发",
    applicability: "检查记忆读写后的外发风险",
    blockedLabel: "D8:cross_session_memory_poisoning",
    displayIndex: 6,
  },
  {
    displayId: "D7",
    canonicalId: "D2",
    label: "输出过滤",
    scope: "最后一道入 Sandbox 前防线",
    applicability: "检查收件人和内容来源",
    blockedLabel: "D2:recipient_from_page",
    displayIndex: 7,
  },
];

export const SANDBOX_CONFIRMATION = {
  displayId: "D8",
  canonicalId: "D3",
  label: "确认门控",
  scope: "Sandbox 内 email.send",
  detail: "执行前仍需显式确认",
  displayIndex: 8,
} as const;
