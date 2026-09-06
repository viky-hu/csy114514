export type ToolCallStage = {
  id: "D5" | "D6" | "D7" | "D8" | "D2" | "SANDBOX" | "D3";
  label: string;
  scope: string;
  blocked: string;
  displayIndex: number | null;
  sourceLine: number;
};

export const TOOL_CALL_BRIDGE_TITLE = "LLM 推理 → 返回 tool calls";

export const TOOL_CALL_PIPELINE: readonly ToolCallStage[] = [
  { id: "D5", label: "因果链检测", scope: "每一个 tool call", blocked: "blocked + defense label", displayIndex: 3, sourceLine: 3 },
  { id: "D6", label: "意图分类", scope: "page_instructed >= 0.6", blocked: "blocked + defense label", displayIndex: 4, sourceLine: 4 },
  { id: "D7", label: "记忆审计", scope: "memory.write only", blocked: "blocked + reason", displayIndex: 5, sourceLine: 5 },
  { id: "D8", label: "会话监控", scope: "email.send only", blocked: "blocked + defense label", displayIndex: 6, sourceLine: 6 },
  { id: "D2", label: "输出过滤", scope: "最后一道 tool-call 防线", blocked: "blocked + defense label", displayIndex: 7, sourceLine: 7 },
  { id: "SANDBOX", label: "Sandbox 执行", scope: "允许路径", blocked: "", displayIndex: null, sourceLine: 8 },
  { id: "D3", label: "确认门控", scope: "sandbox 内 email.send", blocked: "blocked + confirmation required", displayIndex: 8, sourceLine: 9 },
];

export const TOOL_CALL_BRIDGE_SOURCE = [
  "tool_calls = await llm.chat(messages)",
  "for tool_call in tool_calls:",
  "    D5 chain_detector.check_and_record(tool_call)",
  "    D6 intent_classifier.classify(tool_call, page_seen)",
  "    D7 audit only memory.write",
  "    D8 monitor only email.send",
  "    D2 output_filter.review_tool_calls([tool_call], user_input)",
  "    result = sandbox.execute(tool_call)",
  "    D3 confirmation gates email.send inside sandbox",
].join("\n");
