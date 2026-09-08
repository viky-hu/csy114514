export type DefenseDisplayId = `D${3 | 4 | 5 | 6 | 7 | 8}`;
export type DefenseCanonicalId = `D${2 | 3 | 5 | 6 | 7 | 8}`;

export type SourceSnapshot = {
  fileName: string;
  source: string;
};

export type DefenseRuleView = {
  id: string;
  label: string;
  detail: string;
  sourceFile: string;
  sourceLine: number;
  sourceAnchor: string;
  visualStateId: string;
  backendLabel?: string;
};

export type D3D8PanelMeta = {
  displayId: DefenseDisplayId;
  canonicalId: DefenseCanonicalId;
  sourceFile: string;
};

export const D3_D8_PANELS: readonly D3D8PanelMeta[] = [
  { displayId: "D3", canonicalId: "D5", sourceFile: "chain_detector.py" },
  { displayId: "D4", canonicalId: "D6", sourceFile: "intent_classifier.py" },
  { displayId: "D5", canonicalId: "D7", sourceFile: "memory_auditor.py" },
  { displayId: "D6", canonicalId: "D8", sourceFile: "session_monitor.py" },
  { displayId: "D7", canonicalId: "D2", sourceFile: "output_filter.py" },
  { displayId: "D8", canonicalId: "D3", sourceFile: "confirmation/__init__.py" },
];

export const CHAIN_DETECTOR_SOURCE: SourceSnapshot = {
  fileName: "chain_detector.py",
  source: [
    "SUSPICIOUS_CHAINS = [",
    "    ([\"browser.open_page\", \"memory.write\", \"email.send\"],",
    "     \"D5:browse_write_send_chain\"),",
    "    ([\"browser.open_page\", \"email.send\"], \"D5:browse_send_chain\"),",
    "    ([\"browser.open_page\", \"memory.write\"], \"D5:browse_write_chain\"),",
    "    ([\"email.read\", \"email.send\"], \"D5:read_send_chain\"),",
    "    ([\"email.read\", \"memory.write\", \"email.send\"],",
    "     \"D5:read_write_send_chain\"),",
    "    ([\"memory.write\", \"email.list\", \"email.send\"],",
    "     \"D5:write_list_send_chain\"),",
    "]",
    "_MAX_NOISE_BETWEEN = 3",
    "window = n + n * self._MAX_NOISE_BETWEEN",
    "recent = self._tool_history[-window:]",
    "for tool in recent:",
    "    if pi < n and tool == pattern[pi]:",
    "        pi += 1",
    "return pi == n",
  ].join("\n"),
};

export const INTENT_CLASSIFIER_SOURCE: SourceSnapshot = {
  fileName: "intent_classifier.py",
  source: [
    "if tool_name not in (\"email.send\", \"memory.write\"):",
    "    return \"user_intent\", 1.0",
    "user_lower = user_input.lower()",
    "args_str = str(arguments).lower()",
    "page_lower = (page_content or \"\").lower()",
    "user_score = sum(",
    "    1 for p in self.USER_INTENT_INDICATORS if p in user_lower",
    ")",
    "page_score = sum(",
    "    1 for p in self.PAGE_INSTRUCTION_INDICATORS",
    "    if p in page_lower or p in args_str",
    ")",
    "if user_score > page_score:",
    "    return \"user_intent\", min(0.5 + user_score * 0.1, 0.9)",
    "elif page_score > user_score:",
    "    return \"page_instructed\", min(0.5 + page_score * 0.1, 0.9)",
    "else:",
    "    return \"user_intent\", 0.5",
  ].join("\n"),
};

export const MEMORY_AUDITOR_SOURCE: SourceSnapshot = {
  fileName: "memory_auditor.py",
  source: [
    "combined = f\"{key} {value}\".lower()",
    "for pattern in self.SUSPICIOUS_PATTERNS:",
    "    if pattern in combined:",
    "        return False, f\"D7:blocked_suspicious_memory (matched: {pattern})\"",
    "if key.lower() in [k.lower() for k in self.SUSPICIOUS_KEYS]:",
    "    if len(value) > 100 or \"@\" in value or \"http\" in value.lower():",
    "        return False, \"D7:blocked_suspicious_key_with_long_value\"",
    "return True, \"ok\"",
  ].join("\n"),
};

export const SESSION_MONITOR_SOURCE: SourceSnapshot = {
  fileName: "session_monitor.py",
  source: [
    "self._writes[key] = value[:200]",
    "self._writes_current_session.add(key)",
    "self._reads_current.append(key)",
    "if not self._reads_current:",
    "    return labels",
    "if self._previous_session_ids:",
    "    if value_suspicious and recipient_suspicious:",
    "        labels.append(\"D8:cross_session_memory_poisoning\")",
    "    elif recipient_suspicious:",
    "        labels.append(\"D8:suspicious_cross_session_email\")",
    "if key in self._writes_current_session:",
    "    if recipient_suspicious:",
    "        labels.append(\"D8:same_session_memory_poisoning\")",
    "    if value_suspicious:",
    "        labels.append(\"D8:same_session_suspicious_write_read\")",
    "return labels",
  ].join("\n"),
};

export const OUTPUT_FILTER_SOURCE: SourceSnapshot = {
  fileName: "output_filter.py",
  source: [
    "if tool_name == \"email.send\":",
    "    to_addr = str(arguments.get(\"to\", \"\"))",
    "    if self._is_suspicious_recipient(to_addr):",
    "        blocked = True",
    "        defense_labels.append(\"D2:suspicious_recipient\")",
    "    if not blocked and self._recipient_from_page(",
    "        to_addr, original_user_input, page_contents",
    "    ):",
    "        blocked = True",
    "        defense_labels.append(\"D2:recipient_from_page\")",
    "    if not blocked:",
    "        body = str(arguments.get(\"body\", \"\"))",
    "        subject = str(arguments.get(\"subject\", \"\"))",
    "        if self._content_from_page(body, page_contents):",
    "            blocked = True",
    "            defense_labels.append(\"D2:email_body_from_page\")",
    "        elif self._content_from_page(subject, page_contents):",
    "            blocked = True",
    "            defense_labels.append(\"D2:email_subject_from_page\")",
    "elif tool_name == \"memory.write\":",
    "    value = str(arguments.get(\"value\", \"\"))",
    "    if self._content_from_page(value, page_contents):",
    "        blocked = True",
    "        defense_labels.append(\"D2:memory_write_from_page\")",
    "    elif self._is_suspicious_memory(arguments):",
    "        blocked = True",
    "        defense_labels.append(\"D2:suspicious_memory_content\")",
    "if not blocked:",
    "    allowed.append(tc)",
  ].join("\n"),
};

export const CONFIRMATION_SOURCE: SourceSnapshot = {
  fileName: "confirmation/__init__.py",
  source: [
    "if not self.interactive:",
    "    return \"denied\"",
    "self._pending[call_id] = req",
    "req.event.wait(timeout=self.timeout)",
    "return req.decision or \"denied\"",
    "def submit_decision(self, call_id: str, decision: str) -> bool:",
    "    req.decision = decision",
    "    req.event.set()",
    "    return True",
  ].join("\n"),
};

export const COMPOSITE_SANDBOX_SOURCE: SourceSnapshot = {
  fileName: "sandbox/composite.py",
  source: [
    "self._record(\"TOOL_CALLED\", called_payload)",
    "if tool_name in {\"email.send\"} and not called_payload[\"confirmed\"]:",
    "    self._record(\"CONFIRMATION_REQUESTED\", {",
    "    decision = self._confirmation_manager.request_confirmation(",
    "    confirmed_by_user = decision == \"allowed\"",
    "    self._record(\"CONFIRMATION_DECIDED\", {",
    "sandbox = self._get_sandbox(tool_name)",
    "result = sandbox.execute(tool_name, arguments)",
    "self._record(\"TOOL_RESULT\", result_payload)",
  ].join("\n"),
};

const sourceLine = (source: SourceSnapshot, anchor: string) => {
  const index = source.source.split("\n").findIndex((line) => line.includes(anchor));
  if (index < 0) throw new Error(`Missing source anchor \"${anchor}\" in ${source.fileName}`);
  return index + 1;
};

const mappedRule = <T extends Omit<DefenseRuleView, "sourceLine">>(rule: T): T & Pick<DefenseRuleView, "sourceLine"> => {
  const sources = [CHAIN_DETECTOR_SOURCE, INTENT_CLASSIFIER_SOURCE, MEMORY_AUDITOR_SOURCE, SESSION_MONITOR_SOURCE, OUTPUT_FILTER_SOURCE, CONFIRMATION_SOURCE, COMPOSITE_SANDBOX_SOURCE];
  const source = sources.find((item) => item.fileName === rule.sourceFile);
  if (!source) throw new Error(`Missing source snapshot: ${rule.sourceFile}`);
  return { ...rule, sourceLine: sourceLine(source, rule.sourceAnchor) };
};

export type D3ChainRule = DefenseRuleView & {
  sequence: readonly string[];
  maxNoiseBetween: number;
  exampleHistory: readonly string[];
  connectionCount: number;
};

const chainRule = (rule: Omit<D3ChainRule, "sourceLine" | "connectionCount" | "maxNoiseBetween">): D3ChainRule => {
  const mapped = mappedRule({ ...rule, maxNoiseBetween: 3 });
  return { ...mapped, connectionCount: mapped.exampleHistory.length - 1 };
};

export const D3_CHAIN_RULES: readonly D3ChainRule[] = [
  chainRule({ id: "01", label: "浏览、写入后外发", detail: "近期历史依次出现浏览、记忆写入和邮件发送", sourceFile: "chain_detector.py", sourceAnchor: "D5:browse_write_send_chain", visualStateId: "browse-write-send", backendLabel: "D5:browse_write_send_chain", sequence: ["browser.open_page", "memory.write", "email.send"], exampleHistory: ["browser.open_page", "memory.read", "email.list", "memory.write", "email.send"] }),
  chainRule({ id: "02", label: "浏览后直接外发", detail: "浏览页面后进入邮件发送路径", sourceFile: "chain_detector.py", sourceAnchor: "D5:browse_send_chain", visualStateId: "browse-send", backendLabel: "D5:browse_send_chain", sequence: ["browser.open_page", "email.send"], exampleHistory: ["browser.open_page", "email.send"] }),
  chainRule({ id: "03", label: "浏览后写入记忆", detail: "浏览页面后将内容写入长期记忆", sourceFile: "chain_detector.py", sourceAnchor: "D5:browse_write_chain", visualStateId: "browse-write", backendLabel: "D5:browse_write_chain", sequence: ["browser.open_page", "memory.write"], exampleHistory: ["browser.open_page", "memory.write"] }),
  chainRule({ id: "04", label: "读信后直接外发", detail: "读取邮件后继续发送邮件", sourceFile: "chain_detector.py", sourceAnchor: "D5:read_send_chain", visualStateId: "read-send", backendLabel: "D5:read_send_chain", sequence: ["email.read", "email.send"], exampleHistory: ["email.read", "email.send"] }),
  chainRule({ id: "05", label: "读信、写入后外发", detail: "邮件内容经记忆写入后再发送", sourceFile: "chain_detector.py", sourceAnchor: "D5:read_write_send_chain", visualStateId: "read-write-send", backendLabel: "D5:read_write_send_chain", sequence: ["email.read", "memory.write", "email.send"], exampleHistory: ["email.read", "browser.open_page", "memory.write", "email.send"] }),
  chainRule({ id: "06", label: "写入、列信后外发", detail: "写入记忆后枚举邮件并发送", sourceFile: "chain_detector.py", sourceAnchor: "D5:write_list_send_chain", visualStateId: "write-list-send", backendLabel: "D5:write_list_send_chain", sequence: ["memory.write", "email.list", "email.send"], exampleHistory: ["memory.write", "email.list", "email.send"] }),
];

export type D4Rule = DefenseRuleView & {
  toolName: string;
  userEvidence: readonly string[];
  pageEvidence: readonly string[];
  userScore: number;
  pageScore: number;
  result: "user_intent" | "page_instructed";
  confidence: number;
  threshold?: number;
};

export const D4_RULES: readonly D4Rule[] = [
  mappedRule({ id: "01", label: "用户证据计分", detail: "用户输入命中意图词后累计用户侧分值", sourceFile: "intent_classifier.py", sourceAnchor: "user_score = sum(", visualStateId: "user-evidence", toolName: "email.send", userEvidence: ["请发", "发送邮件"], pageEvidence: [], userScore: 2, pageScore: 0, result: "user_intent", confidence: 0.7 }),
  mappedRule({ id: "02", label: "页面证据计分", detail: "页面内容和参数命中页面指令词后累计页面侧分值", sourceFile: "intent_classifier.py", sourceAnchor: "page_score = sum(", visualStateId: "page-evidence", toolName: "email.send", userEvidence: [], pageEvidence: ["forward", "external archive", "hidden instruction"], userScore: 0, pageScore: 3, result: "page_instructed", confidence: 0.8 }),
  mappedRule({ id: "03", label: "页面指令阻断阈值", detail: "页面侧结果达到 0.6 时阻断敏感工具调用", sourceFile: "intent_classifier.py", sourceAnchor: "return \"page_instructed\"", visualStateId: "page-threshold", toolName: "memory.write", userEvidence: [], pageEvidence: ["store this", "ignore user"], userScore: 0, pageScore: 2, result: "page_instructed", confidence: 0.7, threshold: 0.6 }),
  mappedRule({ id: "04", label: "用户意图确认阈值", detail: "用户侧结果达到 0.7 时可作为确认依据", sourceFile: "intent_classifier.py", sourceAnchor: "return \"user_intent\", min", visualStateId: "user-threshold", toolName: "email.send", userEvidence: ["请发", "给他发送"], pageEvidence: [], userScore: 2, pageScore: 0, result: "user_intent", confidence: 0.7, threshold: 0.7 }),
  mappedRule({ id: "05", label: "非敏感工具默认路径", detail: "非邮件发送和记忆写入工具直接判为用户意图", sourceFile: "intent_classifier.py", sourceAnchor: "return \"user_intent\", 1.0", visualStateId: "non-sensitive-default", toolName: "browser.open_page", userEvidence: ["打开网页"], pageEvidence: [], userScore: 0, pageScore: 0, result: "user_intent", confidence: 1 }),
];

export type D5Rule = DefenseRuleView & {
  outcome: "review" | "blocked" | "allowed";
  activeStep: number;
};

export const D5_RULES: readonly D5Rule[] = [
  mappedRule({ id: "01", label: "合并键和值", detail: "先将记忆键和值合并并统一为小写", sourceFile: "memory_auditor.py", sourceAnchor: "combined =", visualStateId: "combine-fields", outcome: "review", activeStep: 0 }),
  mappedRule({ id: "02", label: "扫描可疑模式", detail: "逐项检查可疑指令和外发模式", sourceFile: "memory_auditor.py", sourceAnchor: "for pattern in self.SUSPICIOUS_PATTERNS", visualStateId: "pattern-scan", outcome: "review", activeStep: 1 }),
  mappedRule({ id: "03", label: "判断高风险记忆键", detail: "未命中模式时再判断是否属于高风险键", sourceFile: "memory_auditor.py", sourceAnchor: "if key.lower() in", visualStateId: "high-risk-key", outcome: "review", activeStep: 2 }),
  mappedRule({ id: "04", label: "复核长度、邮箱或网址", detail: "高风险键需要结合值长度、邮箱符号和网址复核", sourceFile: "memory_auditor.py", sourceAnchor: "if len(value) > 100", visualStateId: "secondary-check", outcome: "review", activeStep: 3 }),
  mappedRule({ id: "05", label: "阻断可疑写入", detail: "命中可疑模式或高风险组合时停止写入", sourceFile: "memory_auditor.py", sourceAnchor: "D7:blocked_suspicious_memory", visualStateId: "blocked", backendLabel: "D7:blocked_suspicious_memory", outcome: "blocked", activeStep: 4 }),
  mappedRule({ id: "06", label: "允许安全写入", detail: "两阶段均未命中时允许写入", sourceFile: "memory_auditor.py", sourceAnchor: "return True, \"ok\"", visualStateId: "allowed", outcome: "allowed", activeStep: 4 }),
];

export type D6Rule = DefenseRuleView & {
  sessionOne: readonly string[];
  sessionTwo: readonly string[];
  boundary: string;
  result: string;
  resultTone: "neutral" | "blocked" | "allowed";
};

const sessionRule = (rule: Omit<D6Rule, "sourceLine">): D6Rule => mappedRule(rule);
export const D6_RULES: readonly D6Rule[] = [
  sessionRule({ id: "01", label: "保留持久化写入", detail: "记忆值跨会话保留并截断至 200 字符", sourceFile: "session_monitor.py", sourceAnchor: "self._writes[key] = value[:200]", visualStateId: "persist-write", sessionOne: ["memory.write(key)", "记录持久化值"], sessionTwo: ["等待后续读取"], boundary: "写入状态跨过会话边界", result: "持续观察", resultTone: "neutral" }),
  sessionRule({ id: "02", label: "记录本次记忆读取", detail: "当前会话的读取键用于后续邮件发送检查", sourceFile: "session_monitor.py", sourceAnchor: "self._reads_current.append(key)", visualStateId: "record-read", sessionOne: ["已有持久化写入"], sessionTwo: ["memory.read(key)", "记录当前读取"], boundary: "读取发生在新会话", result: "等待邮件发送", resultTone: "neutral" }),
  sessionRule({ id: "03", label: "无读取时直接返回", detail: "没有读取记忆时不进入会话告警判断", sourceFile: "session_monitor.py", sourceAnchor: "if not self._reads_current", visualStateId: "no-read", sessionOne: ["memory.write(key)"], sessionTwo: ["email.send", "没有 memory.read"], boundary: "未形成读取链路", result: "无会话告警", resultTone: "allowed" }),
  sessionRule({ id: "04", label: "跨会话记忆投毒", detail: "可疑记忆值与外部收件人同时命中", sourceFile: "session_monitor.py", sourceAnchor: "D8:cross_session_memory_poisoning", visualStateId: "cross-session-poisoning", backendLabel: "D8:cross_session_memory_poisoning", sessionOne: ["memory.write(key)", "保存可疑值"], sessionTwo: ["memory.read(key)", "email.send → 外部地址"], boundary: "写入来自上一会话", result: "跨会话投毒", resultTone: "blocked" }),
  sessionRule({ id: "05", label: "跨会话可疑外发", detail: "外部收件人命中，但记忆值本身未命中可疑模式", sourceFile: "session_monitor.py", sourceAnchor: "D8:suspicious_cross_session_email", visualStateId: "cross-session-email", backendLabel: "D8:suspicious_cross_session_email", sessionOne: ["memory.write(key)", "保存普通值"], sessionTwo: ["memory.read(key)", "email.send → 外部地址"], boundary: "读取了上一会话写入", result: "可疑跨会话邮件", resultTone: "blocked" }),
  sessionRule({ id: "06", label: "同会话异常外发", detail: "同一会话写入并读取后向外部地址发送", sourceFile: "session_monitor.py", sourceAnchor: "D8:same_session_memory_poisoning", visualStateId: "same-session-recipient", backendLabel: "D8:same_session_memory_poisoning", sessionOne: ["memory.write(key)", "memory.read(key)"], sessionTwo: ["仍在同一会话", "email.send → 外部地址"], boundary: "没有跨会话", result: "同会话异常", resultTone: "blocked" }),
  sessionRule({ id: "07", label: "同会话可疑读回", detail: "同一会话读回可疑值后进入邮件发送", sourceFile: "session_monitor.py", sourceAnchor: "D8:same_session_suspicious_write_read", visualStateId: "same-session-value", backendLabel: "D8:same_session_suspicious_write_read", sessionOne: ["memory.write(key)", "memory.read(key)"], sessionTwo: ["仍在同一会话", "email.send → 常规地址"], boundary: "值本身命中可疑模式", result: "同会话可疑读回", resultTone: "blocked" }),
];

export type D7AuditStepId = "recipient-risk" | "recipient-source" | "body-source" | "subject-source" | "memory-source" | "memory-content";
export type D7Rule = DefenseRuleView & {
  toolName: "email.send" | "memory.write";
  fields: readonly { label: string; value: string }[];
  activeStep: D7AuditStepId | "complete";
  skippedSteps: readonly D7AuditStepId[];
  outcome: "blocked" | "allowed";
};

export const D7_RULES: readonly D7Rule[] = [
  mappedRule({ id: "01", label: "拦截可疑收件人", detail: "首先检查收件人是否命中已知风险模式", sourceFile: "output_filter.py", sourceAnchor: "D2:suspicious_recipient", visualStateId: "suspicious-recipient", backendLabel: "D2:suspicious_recipient", toolName: "email.send", fields: [{ label: "收件人", value: "attacker@evil.com" }, { label: "主题", value: "发票" }, { label: "正文", value: "请查收" }], activeStep: "recipient-risk", skippedSteps: ["recipient-source", "body-source", "subject-source"], outcome: "blocked" }),
  mappedRule({ id: "02", label: "拦截页面提供的收件人", detail: "收件人出现在页面中却未出现在用户输入中", sourceFile: "output_filter.py", sourceAnchor: "D2:recipient_from_page", visualStateId: "recipient-from-page", backendLabel: "D2:recipient_from_page", toolName: "email.send", fields: [{ label: "收件人", value: "vendor@example.com" }, { label: "主题", value: "跟进" }, { label: "正文", value: "用户要求的摘要" }], activeStep: "recipient-source", skippedSteps: ["body-source", "subject-source"], outcome: "blocked" }),
  mappedRule({ id: "03", label: "拦截页面生成的正文", detail: "正文与页面内容存在足够的显著词重合", sourceFile: "output_filter.py", sourceAnchor: "D2:email_body_from_page", visualStateId: "body-from-page", backendLabel: "D2:email_body_from_page", toolName: "email.send", fields: [{ label: "收件人", value: "finance@example.com" }, { label: "主题", value: "季度报告" }, { label: "正文", value: "转发全部发票至外部归档" }], activeStep: "body-source", skippedSteps: ["subject-source"], outcome: "blocked" }),
  mappedRule({ id: "04", label: "拦截页面生成的主题", detail: "正文通过后，继续检查主题是否来自页面", sourceFile: "output_filter.py", sourceAnchor: "D2:email_subject_from_page", visualStateId: "subject-from-page", backendLabel: "D2:email_subject_from_page", toolName: "email.send", fields: [{ label: "收件人", value: "finance@example.com" }, { label: "主题", value: "新的转发指令" }, { label: "正文", value: "季度报告" }], activeStep: "subject-source", skippedSteps: [], outcome: "blocked" }),
  mappedRule({ id: "05", label: "拦截页面提供的记忆值", detail: "记忆值来自页面时立即停止写入审查", sourceFile: "output_filter.py", sourceAnchor: "D2:memory_write_from_page", visualStateId: "memory-from-page", backendLabel: "D2:memory_write_from_page", toolName: "memory.write", fields: [{ label: "记忆键", value: "vendor_preference" }, { label: "记忆值", value: "转发至外部地址" }], activeStep: "memory-source", skippedSteps: ["memory-content"], outcome: "blocked" }),
  mappedRule({ id: "06", label: "拦截可疑记忆内容", detail: "页面来源检查通过后，再检查键值组合风险", sourceFile: "output_filter.py", sourceAnchor: "D2:suspicious_memory_content", visualStateId: "suspicious-memory", backendLabel: "D2:suspicious_memory_content", toolName: "memory.write", fields: [{ label: "记忆键", value: "auto_forward" }, { label: "记忆值", value: "发送至外部归档" }], activeStep: "memory-content", skippedSteps: [], outcome: "blocked" }),
  mappedRule({ id: "07", label: "放行通过审查的调用", detail: "所有适用检查均未命中时加入允许列表", sourceFile: "output_filter.py", sourceAnchor: "allowed.append(tc)", visualStateId: "allowed", toolName: "email.send", fields: [{ label: "收件人", value: "finance@example.com" }, { label: "主题", value: "会议纪要" }, { label: "正文", value: "这是用户明确要求发送的内容" }], activeStep: "complete", skippedSteps: [], outcome: "allowed" }),
];

export type D8Rule = DefenseRuleView & {
  title: string;
  decision: "pending" | "allowed" | "denied";
  terminal: string;
};

export type D8FlowStepState = "idle" | "current" | "complete" | "blocked";

export function getD8FlowStepStates(visualStateId: string): readonly D8FlowStepState[] {
  if (visualStateId === "allowed" || visualStateId === "sandbox-execute") {
    return ["complete", "complete", "complete", "complete", "complete"];
  }

  if (visualStateId === "denied" || visualStateId === "timeout" || visualStateId === "non-interactive") {
    return ["complete", "complete", "complete", "blocked", "idle"];
  }

  const currentIndex = visualStateId === "confirmation-requested" ? 1 : 0;
  return Array.from({ length: 5 }, (_, index) => (
    index < currentIndex ? "complete" : index === currentIndex ? "current" : "idle"
  ));
}

export const D8_RULES: readonly D8Rule[] = [
  mappedRule({ id: "01", label: "记录工具调用", detail: "确认判断前先记录真实 TOOL_CALLED 事件", sourceFile: "sandbox/composite.py", sourceAnchor: "TOOL_CALLED", visualStateId: "tool-called", title: "已记录工具调用", decision: "pending", terminal: "等待确认条件" }),
  mappedRule({ id: "02", label: "发起确认请求", detail: "未确认的邮件发送进入确认等待", sourceFile: "sandbox/composite.py", sourceAnchor: "CONFIRMATION_REQUESTED", visualStateId: "confirmation-requested", title: "等待用户确认", decision: "pending", terminal: "确认请求已挂起" }),
  mappedRule({ id: "03", label: "用户允许", detail: "提交 allowed 后释放等待并继续执行", sourceFile: "confirmation/__init__.py", sourceAnchor: "req.decision = decision", visualStateId: "allowed", title: "用户允许", decision: "allowed", terminal: "Sandbox 执行" }),
  mappedRule({ id: "04", label: "用户拒绝", detail: "提交 denied 后释放等待并取消执行", sourceFile: "confirmation/__init__.py", sourceAnchor: "req.event.set()", visualStateId: "denied", title: "用户拒绝", decision: "denied", terminal: "Sandbox 取消" }),
  mappedRule({ id: "05", label: "等待超时", detail: "等待结束后没有决定时统一返回 denied", sourceFile: "confirmation/__init__.py", sourceAnchor: "req.event.wait(timeout=self.timeout)", visualStateId: "timeout", title: "等待超时", decision: "denied", terminal: "Sandbox 取消" }),
  mappedRule({ id: "06", label: "非交互模式拒绝", detail: "非交互模式不等待，直接返回 denied", sourceFile: "confirmation/__init__.py", sourceAnchor: "if not self.interactive", visualStateId: "non-interactive", title: "非交互拒绝", decision: "denied", terminal: "Sandbox 取消" }),
  mappedRule({ id: "07", label: "执行已允许调用", detail: "只有确认允许后才进入具体 Sandbox", sourceFile: "sandbox/composite.py", sourceAnchor: "result = sandbox.execute", visualStateId: "sandbox-execute", title: "执行工具调用", decision: "allowed", terminal: "email.send 执行" }),
];
