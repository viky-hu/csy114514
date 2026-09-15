import type { ComparisonReport, ComparisonCaseResult } from "../../windows/main/evaluation/comparison-types.ts";
import { deriveComparisonReportSummary } from "../../windows/main/evaluation/comparison-report-summary.ts";
import type { TestCaseSummary, EvaluationReport, EvaluationRun, ExecutionTrace } from "../../windows/main/evaluation/evaluation-types.ts";

export const REPORT_TEMPLATE_VERSION = "report-template-v1";

export type RedactedEvent = {
  eventId: string;
  timestamp: string;
  type: string;
  tool?: string;
  round?: number;
  strategy?: string;
  variant?: string;
  verdict?: string;
  conclusion?: string;
  policy?: string;
  defenseLabels?: string[];
};

type CommonSnapshot = {
  id: string;
  kind: "evaluation" | "comparison" | "redteam";
  title: string;
  generatedAt: string;
  templateVersion: string;
  scoringVersion: string;
  scope: string[];
  method: string[];
  narrative: string;
  statistics: Record<string, number | string>;
  recommendations: string[];
  limitations: string[];
};

export type EvaluationSnapshot = CommonSnapshot & {
  kind: "evaluation";
  report: EvaluationReport;
  run: EvaluationRun;
  findings: Array<Record<string, unknown>>;
  events: RedactedEvent[];
};

export type ComparisonSnapshot = CommonSnapshot & {
  kind: "comparison";
  report: ComparisonReport;
  testCases: TestCaseSummary[];
  rows: Array<ComparisonCaseResult & { testCase?: TestCaseSummary }>;
  summary: ReturnType<typeof deriveComparisonReportSummary>;
};

export type RedTeamSnapshot = CommonSnapshot & {
  kind: "redteam";
  run: Record<string, unknown>;
  report: Record<string, unknown>;
  events: RedactedEvent[];
};

export type ReportSnapshot = EvaluationSnapshot | ComparisonSnapshot | RedTeamSnapshot;

function stringValue(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function safeText(value: unknown, fallback = "") {
  return stringValue(value, fallback)
    .replace(/\b(bearer|token|api[_-]?key|secret|password)\s*[:=]\s*[^\s,;]+/gi, "$1=[已移除]")
    .replace(/(?:[A-Za-z]:\\|\\\\|\/(?:home|root|srv|opt|tmp|var|etc|workspace|app)\/)[^\s"'<>]+/g, "[路径已移除]")
    .replace(/```[\s\S]*?```/g, "[原始载荷已移除]");
}

function listStrings(value: unknown) {
  return Array.isArray(value) ? value.map((item) => stringValue(item)).filter(Boolean) : [];
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeCount(value: unknown, fallback = 0) {
  const number = finiteNumber(value);
  return number !== undefined && number >= 0 ? Math.floor(number) : fallback;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isoDate(value: unknown) {
  const text = stringValue(value);
  return text || new Date().toISOString();
}

function eventPayload(event: unknown) {
  return objectValue(objectValue(event).payload);
}

/** Only fields needed to reproduce a report are retained; payloads are never exported. */
export function redactEvent(event: unknown): RedactedEvent {
  const source = objectValue(event);
  const payload = eventPayload(event);
  const result: RedactedEvent = {
    eventId: safeText(source.event_id, "unknown-event"),
    timestamp: isoDate(source.timestamp),
    type: safeText(source.type, "UNKNOWN"),
  };
  const mappings: Array<[keyof RedactedEvent, string[]]> = [
    ["tool", ["tool_name", "tool"]], ["strategy", ["strategy"]], ["variant", ["variant_id", "variant"]],
    ["verdict", ["verdict"]], ["conclusion", ["conclusion"]], ["policy", ["policy", "policy_id"]],
  ];
  for (const [target, keys] of mappings) {
    const value = keys.map((key) => safeText(payload[key])).find(Boolean);
    if (value) result[target] = value as never;
  }
  const round = finiteNumber(payload.round);
  if (round !== undefined) result.round = round;
  const labels = listStrings(payload.defense_labels ?? payload.defenseLabels).map((item) => safeText(item)).filter(Boolean).slice(0, 12);
  if (labels.length) result.defenseLabels = labels;
  return result;
}

function severityLabel(value: string) {
  return (({ CRITICAL: "严重", HIGH: "高危", MEDIUM: "中风险", LOW: "低风险" } as Record<string, string>)[value] ?? value) || "未知";
}

function evaluationNarrative(report: EvaluationReport, run: EvaluationRun, findings: number) {
  if (run.status !== "completed") return "结果降级：报告虽已生成，但运行未以 completed 状态结束，结论需结合限制条件复核。";
  if (report.severity === "CRITICAL") return `高危/严重：发现 ${findings} 条风险，最高等级为严重。报告中的 Finding 与事件证据支持复核该结论。`;
  if (report.severity === "HIGH") return `高危/严重：发现 ${findings} 条风险，最高等级为高风险。请优先处理高风险 Finding。`;
  if (findings > 0) return `一般风险：发现 ${findings} 条风险，最高等级为${severityLabel(report.severity)}。`;
  return "全绿（样本内）：未生成可复算 Finding；这不代表目标在未覆盖场景下绝对安全。";
}

function findingRecord(finding: unknown) {
  const source = objectValue(finding);
  return {
    id: stringValue(source.finding_id, "unknown-finding"), riskPattern: stringValue(source.risk_pattern_id, "未知"),
    severity: severityLabel(stringValue(source.severity)), riskType: stringValue(source.risk_type, "未知"),
    description: safeText(source.description, "未提供描述"), remediation: safeText(source.remediation, "按组织变更流程复核并增加对应防护。"),
    evidenceIds: objectValue(source).evidence && Array.isArray(source.evidence)
      ? source.evidence.map((item) => stringValue(objectValue(item).event_id)).filter(Boolean) : [],
  };
}

export function buildEvaluationSnapshot(report: EvaluationReport, run: EvaluationRun, trace: ExecutionTrace | null): EvaluationSnapshot {
  const findings = (Array.isArray(report.findings) ? report.findings : []).map(findingRecord);
  const events = (trace && Array.isArray(trace.events) ? trace.events : []).map(redactEvent);
  const summary = report.summary;
  const testCaseIds = Array.isArray(run.test_case_ids) ? run.test_case_ids : [];
  const scoreBreakdown = objectValue(report.score_breakdown);
  return {
    kind: "evaluation", id: report.evaluation_id, title: "单次测评报告", generatedAt: isoDate(report.created_at),
    templateVersion: REPORT_TEMPLATE_VERSION, scoringVersion: safeText(scoreBreakdown.algorithm_version, "unknown-scoring-version"),
    scope: [`Agent：${safeText(report.agent_id, "未知")}`, `Evaluation：${safeText(report.evaluation_id, "未知")}`, `执行状态：${safeText(run.status, "未知")}`, `TestCase：${testCaseIds.length} 条`],
    method: ["服务端读取 EvaluationReport、EvaluationRun 与 ExecutionTrace", "按冻结评分算法和 Finding 证据关联生成确定性结论", "事件证据仅输出可复核的白名单摘要"],
    narrative: evaluationNarrative(report, run, findings.length),
    statistics: { 综合评分: safeCount(report.overall_score), Finding数: findings.length, 事件数: events.length, 测试数: safeCount(summary?.total_tests, testCaseIds.length), 通过数: safeCount(summary?.passed), 失败数: safeCount(summary?.failed, findings.length) },
    recommendations: findings.length ? findings.map((item) => `${item.id}：${item.remediation}`) : ["继续扩大测试覆盖，并对未覆盖的工具、记忆和外发路径进行专项验证。"],
    limitations: ["结论仅适用于本次运行选择的 TestCase 和实际执行路径。", "无 Finding 不等于目标绝对安全；事件摘要已主动去除原始载荷、凭据和服务器细节。"],
    report, run, findings, events,
  };
}

function comparisonNarrative(summary: ReturnType<typeof deriveComparisonReportSummary>) {
  if (summary.coverage.comparable === 0) return "覆盖不足：没有足够的双侧明确 PASS/FAIL 样本判断防御成效。";
  if (summary.transitions.possible_regression > 0) return `可能误伤：发现 ${summary.transitions.possible_regression} 条 Bare 通过而 Defended 未通过的结果，需要优先复核。`;
  if (summary.transitions.defense_failed > 0) return `防御未解决：仍有 ${summary.transitions.defense_failed} 条风险在 Defended 侧未解决。`;
  if (summary.transitions.defense_blocked > 0) return `防御有效：阻断 ${summary.transitions.defense_blocked} 条风险路径；该结论仅针对可比样本。`;
  return "防御有效性有限：样本内未观察到通过率提升，需结合覆盖不足项继续验证。";
}

export function buildComparisonSnapshot(report: ComparisonReport, testCases: TestCaseSummary[]): ComparisonSnapshot {
  const safeTestCases = Array.isArray(testCases) ? testCases : [];
  const rawRows = Array.isArray(report.results) ? report.results : [];
  const normalizedRows = rawRows.map((row) => {
    const source = objectValue(row);
    const transition = stringValue(source.transition);
    return {
      ...source,
      test_case_id: safeText(source.test_case_id, "unknown-test-case"),
      bare_verdict: stringValue(source.bare_verdict) || null,
      defended_verdict: stringValue(source.defended_verdict) || null,
      transition: ["defense_blocked", "both_pass", "defense_failed", "possible_regression", "incomplete"].includes(transition) ? transition : "incomplete",
    };
  });
  const summary = deriveComparisonReportSummary(normalizedRows as ComparisonCaseResult[], safeTestCases);
  const byId = new Map(safeTestCases.map((item) => [item.id, item]));
  const rows = normalizedRows.map((row) => ({ ...row, testCase: byId.get(row.test_case_id) })) as ComparisonSnapshot["rows"];
  return {
    kind: "comparison", id: report.comparison_id, title: "对比测评总结报告", generatedAt: new Date().toISOString(),
    templateVersion: REPORT_TEMPLATE_VERSION, scoringVersion: "comparison-summary-v1",
    scope: [`Comparison：${safeText(report.comparison_id, "unknown-comparison")}`, `Bare Run：${safeText(report.bare_run_id, "未知")}`, `Defended Run：${safeText(report.defended_run_id, "未完成")}`, `TestCase：${Array.isArray(report.test_case_ids) ? report.test_case_ids.length : 0} 条`],
    method: ["服务端读取 ComparisonReport 与 TestCase 目录", "逐 Case 复算状态转移和可比样本分母", "对比报告为独立总结，不复用单次 Finding 章节"],
    narrative: comparisonNarrative(summary),
    statistics: { 总样本: summary.coverage.total, 可比样本: summary.coverage.comparable, 异常或不可比: summary.coverage.incomplete, Bare通过率: `${Math.round(summary.rates.barePassRate * 100)}%`, Defended通过率: `${Math.round(summary.rates.defendedPassRate * 100)}%`, 通过率变化百分点: summary.passRateDeltaPoints },
    recommendations: summary.transitions.defense_failed || summary.transitions.possible_regression ? ["优先复核未解决和可能误伤的 Case，确认防御规则边界与用户意图判定。", "对异常或不可比 Case 补充可重复运行。"] : ["扩大对比样本，持续观察防御收益与覆盖度。"],
    limitations: ["通过率分母仅包含双侧均为明确 PASS/FAIL 的可比 Case。", "对比结果不推断性能、成本、时延或防御命中原因。"],
    report, testCases: safeTestCases, rows, summary,
  };
}

function redteamNarrative(report: Record<string, unknown>, run: Record<string, unknown>) {
  const conclusion = stringValue(report.conclusion);
  if (conclusion === "exposure_confirmed") return "已证实绕过：至少一个 FAIL 样本未带防守标签，形成可复核的样本内暴露证据。";
  if (conclusion === "coverage_incomplete" || run.status !== "completed") return "覆盖不足/不确定：存在错误、未充分触发或运行未完整结束；不能用零绕过推导绝对安全。";
  return "样本内未观察到绕过：本次覆盖样本未确认绕过，不代表目标在其他输入或路径下绝对安全。";
}

export function buildRedTeamSnapshot(runInput: unknown, reportInput: unknown, eventsInput: unknown[]): RedTeamSnapshot {
  const run = objectValue(runInput); const report = objectValue(reportInput); const events = (Array.isArray(eventsInput) ? eventsInput : []).map(redactEvent);
  const outcome = objectValue(report.outcome_summary);
  const bypasses = Array.isArray(report.bypasses) ? report.bypasses : [];
  const config = objectValue(run.config);
  return {
    kind: "redteam", id: stringValue(run.run_id, stringValue(report.run_id, "redteam-run")), title: "红队演练报告", generatedAt: isoDate(run.finished_at ?? run.created_at),
    templateVersion: REPORT_TEMPLATE_VERSION, scoringVersion: "redteam-adaptive-v1",
    scope: [`Agent：${stringValue(run.agent_id, "未知")}`, `Run：${stringValue(run.run_id, "未知")}`, `状态：${stringValue(run.status, "未知")}`, `轮次：${finiteNumber(config.rounds) ?? finiteNumber(run.current_round) ?? 0}`],
    method: ["固定种子集按轮次选择高权重策略并生成变体", "以 FAIL 且无防守标签作为唯一已证实绕过判据", "服务端读取历史事件并只输出白名单摘要"],
    narrative: redteamNarrative(report, run),
    statistics: { 已证实绕过: safeCount(outcome.confirmed_bypass, bypasses.length), 防守成功: safeCount(outcome.defense_success), 未充分触发: safeCount(outcome.not_exercised), 执行错误: safeCount(outcome.execution_error), 结果不确定: safeCount(outcome.inconclusive), 事件数: events.length },
    recommendations: bypasses.length ? bypasses.map((item) => { const row = objectValue(item); return `${stringValue(row.risk_pattern, "未知风险")}（${stringValue(row.strategy, "未知策略")}）：复核变体 ${stringValue(row.variant_id, "未知")} 并增加相应防守校验。`; }) : ["继续扩大种子、策略和轮次覆盖，重点复核未充分触发与结果不确定样本。"],
    limitations: ["红队结论只代表固定种子和本次轮次的样本观察。", "事件摘要不包含原始攻击载荷、令牌、密钥、路径、堆栈或环境详情。"],
    run, report, events,
  };
}

function valueText(value: unknown) { return stringValue(value, String(value ?? "")); }
function markdownEscape(value: unknown) { return valueText(value).replace(/[|\n\r]/g, (match) => match === "|" ? "\\|" : " "); }
function commonMarkdown(snapshot: ReportSnapshot) {
  const lines = [`# ${snapshot.title}`, "", `- 报告 ID：${snapshot.id}`, `- 生成时间：${snapshot.generatedAt}`, `- 模板版本：${snapshot.templateVersion}`, `- 评分/规则版本：${snapshot.scoringVersion}`, "", "## 1. 报告元信息与测试范围", ...snapshot.scope.map((item) => `- ${item}`), "", "## 2. 执行方法和覆盖说明", ...snapshot.method.map((item) => `- ${item}`), "", "## 3. 执行结论", snapshot.narrative, "", "## 4. 统计结果", "| 指标 | 值 |", "| --- | --- |", ...Object.entries(snapshot.statistics).map(([key, value]) => `| ${markdownEscape(key)} | ${markdownEscape(value)} |`)];
  return lines;
}

export function renderMarkdown(snapshot: ReportSnapshot) {
  const lines = commonMarkdown(snapshot);
  lines.push("", "## 5. 风险/状态明细");
  if (snapshot.kind === "evaluation") {
    lines.push("| Finding | 风险模式 | 等级 | 描述 | 证据事件 |", "| --- | --- | --- | --- | --- |", ...snapshot.findings.map((item) => `| ${markdownEscape(item.id)} | ${markdownEscape(item.riskPattern)} | ${markdownEscape(item.severity)} | ${markdownEscape(item.description)} | ${markdownEscape((item.evidenceIds as string[]).join(", "))} |`));
  } else if (snapshot.kind === "comparison") {
    lines.push("| TestCase | Bare | Defended | 状态 |", "| --- | --- | --- | --- |", ...snapshot.rows.map((row) => `| ${markdownEscape(row.test_case_id)} | ${markdownEscape(row.bare_verdict ?? "未知")} | ${markdownEscape(row.defended_verdict ?? "未知")} | ${markdownEscape(row.transition)} |`));
  } else {
    lines.push("| 事件 ID | 时间 | 类型 | 策略 | 变体 | 判定 | 防守标签 |", "| --- | --- | --- | --- | --- | --- | --- |", ...snapshot.events.map((event) => `| ${markdownEscape(event.eventId)} | ${markdownEscape(event.timestamp)} | ${markdownEscape(event.type)} | ${markdownEscape(event.strategy)} | ${markdownEscape(event.variant)} | ${markdownEscape(event.verdict)} | ${markdownEscape(event.defenseLabels?.join(", "))} |`));
  }
  lines.push("", "## 6. 可复现证据");
  const evidence = snapshot.kind === "evaluation" ? snapshot.events : snapshot.kind === "redteam" ? snapshot.events : snapshot.rows.map((row) => ({ eventId: row.test_case_id, timestamp: "", type: row.transition }));
  lines.push(...evidence.slice(0, 100).map((event) => `- ${markdownEscape(event.eventId)} ${markdownEscape(event.timestamp)} ${markdownEscape(event.type)}`));
  lines.push("", "## 7. 修复建议", ...snapshot.recommendations.map((item) => `- ${item}`), "", "## 8. 限制条件与免责声明", ...snapshot.limitations.map((item) => `- ${item}`), "");
  return lines.join("\n");
}

export function renderTxt(snapshot: ReportSnapshot) {
  const lines = [`${snapshot.title}\n${"=".repeat(64)}`, `报告 ID：${snapshot.id}`, `生成时间：${snapshot.generatedAt}`, `模板版本：${snapshot.templateVersion}`, `评分/规则版本：${snapshot.scoringVersion}`, "", "1. 报告元信息与测试范围", ...snapshot.scope.map((item) => `  - ${item}`), "", "2. 执行方法和覆盖说明", ...snapshot.method.map((item) => `  - ${item}`), "", "3. 执行结论", `  ${snapshot.narrative}`, "", "4. 统计结果", ...Object.entries(snapshot.statistics).map(([key, value]) => `  ${key}：${value}`), "", "5. 风险/状态明细"];
  if (snapshot.kind === "evaluation") lines.push(...snapshot.findings.map((item, index) => `  ${index + 1}. ${item.id} · ${item.riskPattern} · ${item.severity}\n     ${item.description}\n     证据：${(item.evidenceIds as string[]).join(", ") || "无"}`));
  if (snapshot.kind === "comparison") lines.push(...snapshot.rows.map((row, index) => `  ${index + 1}. ${row.test_case_id} · Bare=${row.bare_verdict ?? "未知"} · Defended=${row.defended_verdict ?? "未知"} · ${row.transition}`));
  if (snapshot.kind === "redteam") lines.push(...snapshot.events.map((event, index) => `  ${index + 1}. ${event.eventId} ${event.timestamp} ${event.type} · ${event.strategy ?? ""} · ${event.variant ?? ""} · ${event.verdict ?? ""}`));
  lines.push("", "6. 可复现证据", ...(snapshot.kind === "comparison" ? snapshot.rows.map((row) => `  - ${row.test_case_id}：${row.transition}`) : snapshot.events.slice(0, 100).map((event) => `  - ${event.eventId}：${event.timestamp} · ${event.type}`)), "", "7. 修复建议", ...snapshot.recommendations.map((item) => `  - ${item}`), "", "8. 限制条件与免责声明", ...snapshot.limitations.map((item) => `  - ${item}`), `\n${"=".repeat(64)}`);
  return lines.join("\n");
}

function htmlEscape(value: unknown) { return valueText(value).replace(/[&<>\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char] ?? char)); }
export function renderPrintHtml(snapshot: ReportSnapshot) {
  const rows = Object.entries(snapshot.statistics).map(([key, value]) => `<tr><th>${htmlEscape(key)}</th><td>${htmlEscape(value)}</td></tr>`).join("");
  const details = snapshot.kind === "evaluation" ? snapshot.findings.map((item) => `<li><strong>${htmlEscape(item.id)}</strong> · ${htmlEscape(item.severity)} · ${htmlEscape(item.description)}</li>`).join("") : snapshot.kind === "comparison" ? snapshot.rows.map((row) => `<li><strong>${htmlEscape(row.test_case_id)}</strong> · ${htmlEscape(row.transition)} · Bare ${htmlEscape(row.bare_verdict)} / Defended ${htmlEscape(row.defended_verdict)}</li>`).join("") : snapshot.events.map((event) => `<li><strong>${htmlEscape(event.eventId)}</strong> · ${htmlEscape(event.type)} · ${htmlEscape(event.verdict)}</li>`).join("");
  const evidence = snapshot.kind === "comparison" ? snapshot.rows.map((row) => `<li>${htmlEscape(row.test_case_id)} · ${htmlEscape(row.transition)}</li>`).join("") : snapshot.events.slice(0, 100).map((event) => `<li>${htmlEscape(event.eventId)} · ${htmlEscape(event.timestamp)} · ${htmlEscape(event.type)}</li>`).join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>@page{size:A4;margin:18mm 16mm 18mm 16mm}body{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif;color:#17202b;font-size:10pt;line-height:1.55}header{border-bottom:2px solid #3152f4;margin-bottom:18px}h1{font-size:24pt;margin:0 0 4px}h2{font-size:14pt;border-bottom:1px solid #d5dae2;padding-bottom:4px;margin-top:20px;break-after:avoid}table{width:100%;border-collapse:collapse;page-break-inside:avoid}thead{display:table-header-group}th,td{text-align:left;border-bottom:1px solid #d5dae2;padding:5px 7px}th{width:38%;font-weight:600;background:#f5f7fa}li{margin:4px 0;page-break-inside:avoid}.meta{color:#586474;font-size:9pt}@media print{footer{position:fixed;bottom:0;right:0;font-size:8pt;color:#697586}}</style></head><body><header><h1>${htmlEscape(snapshot.title)}</h1><div class="meta">${htmlEscape(snapshot.id)} · ${htmlEscape(snapshot.generatedAt)} · ${htmlEscape(snapshot.templateVersion)}</div></header><h2>1. 报告元信息与测试范围</h2><ul>${snapshot.scope.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul><h2>2. 执行方法和覆盖说明</h2><ul>${snapshot.method.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul><h2>3. 执行结论</h2><p>${htmlEscape(snapshot.narrative)}</p><h2>4. 统计结果</h2><table><thead><tr><th>指标</th><th>值</th></tr></thead><tbody>${rows}</tbody></table><h2>5. 风险/状态明细</h2><ul>${details || "<li>无可列示明细</li>"}</ul><h2>6. 可复现证据</h2><ul>${evidence || "<li>无可列示证据</li>"}</ul><h2>7. 修复建议</h2><ul>${snapshot.recommendations.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul><h2>8. 限制条件与免责声明</h2><ul>${snapshot.limitations.map((item) => `<li>${htmlEscape(item)}</li>`).join("")}</ul><footer>报告模板 ${htmlEscape(snapshot.templateVersion)}</footer></body></html>`;
}
