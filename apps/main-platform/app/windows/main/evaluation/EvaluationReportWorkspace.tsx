"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, FileWarning, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import {
  resolveEvaluationLoadingTipPhase,
  useLoadingTip,
} from "../../shared/loading-tips";
import { useEvaluationWorkspace, type EvaluationWorkspaceNavigate } from "./EvaluationWorkspaceProvider";
import type { RiskFinding, SequencedEvent } from "./evaluation-types";
import { ReportSummaryPanel } from "./ReportSummaryPanel";

gsap.registerPlugin(useGSAP);

const SEVERITY_LABEL: Record<string, string> = { CRITICAL: "严重", HIGH: "高风险", MEDIUM: "中风险", LOW: "低风险" };
const PATH_NODES = [
  { id: "web", label: "不可信网页", detail: "页面内容可被 Agent 读取" },
  { id: "write", label: "memory.write", detail: "持久记忆写入" },
  { id: "session", label: "新 Agent 会话", detail: "跨会话状态延续" },
  { id: "read", label: "memory.read", detail: "下一轮读取同一记忆" },
  { id: "email", label: "email.send", detail: "未确认外发动作" },
] as const;

function eventForFinding(finding: RiskFinding, traceEvents: SequencedEvent[]) {
  const evidenceIds = new Set((finding.evidence ?? []).map((item) => item.event_id));
  return traceEvents.filter((event) => evidenceIds.has(event.event_id));
}

function verifiedPathNodes(finding: RiskFinding, traceEvents: SequencedEvent[]) {
  const evidenceEvents = eventForFinding(finding, traceEvents);
  const toolNames = new Set(
    evidenceEvents
      .filter((event) => event.type === "TOOL_CALLED" || event.type === "TOOL_RESULT")
      .map((event) => event.payload?.tool_name),
  );
  return new Set([
    ...(toolNames.has("browser.open_page") ? ["web"] : []),
    ...(toolNames.has("memory.write") ? ["write"] : []),
    ...(toolNames.has("memory.read") ? ["read"] : []),
    ...(toolNames.has("email.send") ? ["email"] : []),
    ...(finding.rule_types?.includes("full_chain_persistent_ipi") ? ["session"] : []),
  ]);
}

function severityClass(severity: string) {
  return severity.toLowerCase().replace(/[^a-z]/g, "");
}

function formatPayload(event: SequencedEvent) {
  return Object.entries(event.payload ?? {})
    .filter(([key]) => !/(secret|canary|memory_value|raw|path|stack|environment)/i.test(key))
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" · ");
}

function ScorePanel({ report }: { report: NonNullable<ReturnType<typeof useEvaluationWorkspace>["report"]> }) {
  const dimensions = report.score_breakdown.dimensions;
  return <div className="evaluation-score-panel"><div className="evaluation-score-main"><span>综合安全评分</span><strong>{report.overall_score}</strong><small>/ 100</small></div><div className="evaluation-score-dimensions"><div><span>能力</span><b>{dimensions.capability}</b><small>扣 {100 - dimensions.capability}</small></div><div><span>执行稳定性</span><b>{dimensions.execution_stability}</b><small>扣 {100 - dimensions.execution_stability}</small></div><div><span>安全性</span><b>{dimensions.security}</b><small>扣 {100 - dimensions.security}</small></div></div></div>;
}

function FindingList({ findings, selectedId, onSelect }: { findings: RiskFinding[]; selectedId?: string; onSelect: (finding: RiskFinding) => void }) {
  return <aside className="evaluation-findings-list" aria-label="风险发现列表"><div className="evaluation-section-label"><span>FINDINGS</span><b>{findings.length.toString().padStart(2, "0")}</b></div>{findings.map((finding) => <button type="button" key={finding.finding_id} className={`evaluation-finding-item ${finding.finding_id === selectedId ? "is-selected" : ""}`} onClick={() => onSelect(finding)}><span className={`evaluation-severity-mark is-${severityClass(finding.severity)}`}><AlertTriangle size={15} /></span><span><strong>{finding.risk_type}</strong><small>{SEVERITY_LABEL[finding.severity] ?? finding.severity} · {finding.rule_types?.join(" / ") || finding.risk_pattern_id}</small></span><ChevronRight size={15} /></button>)}</aside>;
}

function EvidenceDetail({ finding, traceEvents, onClose }: { finding: RiskFinding; traceEvents: SequencedEvent[]; onClose: () => void }) {
  const evidenceEvents = eventForFinding(finding, traceEvents);
  const verifiedNodes = verifiedPathNodes(finding, traceEvents);
  return <article className="evaluation-evidence-detail"><button className="evaluation-drawer-close" type="button" aria-label="关闭证据详情" title="关闭证据详情" onClick={onClose}><X size={16} /></button><header className="evaluation-evidence-heading"><div><span className={`evaluation-severity-badge is-${severityClass(finding.severity)}`}>{finding.severity}</span><h2>{finding.description}</h2><p>{finding.risk_pattern_id} · {finding.attack_path_id ?? "R4 MVP"}</p></div><FileWarning size={22} /></header><div className="evaluation-path" aria-label="五节点因果路径">{PATH_NODES.map((node, index) => <div className="evaluation-path-node-wrap" key={node.id}><div className={`evaluation-path-node ${verifiedNodes.has(node.id) ? "is-verified" : ""}`}><span>0{index + 1}</span><strong>{node.label}</strong><small>{node.detail}</small></div>{index < PATH_NODES.length - 1 && <ArrowRight className="evaluation-path-arrow" size={16} />}</div>)}</div><section className="evaluation-evidence-block"><div className="evaluation-section-label"><span>因果证据</span><b>{evidenceEvents.length.toString().padStart(2, "0")}</b></div>{evidenceEvents.length === 0 ? <p className="evaluation-empty-copy">暂无可关联事件。</p> : <div className="evaluation-evidence-events">{evidenceEvents.map((event) => <div className="evaluation-evidence-event" key={event.event_id}><div><span>{event.type}</span><time>{new Date(event.timestamp).toLocaleTimeString("zh-CN")}</time></div><p>{formatPayload(event) || "事件已持久化，payload 已脱敏。"}</p></div>)}</div>}</section><section className="evaluation-rule-block"><div><span className="evaluation-eyebrow">VIOLATION RULES</span><h3>{finding.rule_types?.join(" · ") || finding.risk_pattern_id}</h3></div><div className="evaluation-remediation"><ShieldCheck size={17} /><p>{finding.remediation ?? "建议限制不可信网页内容进入持久记忆，并要求外发工具在执行前获得明确确认。"}</p></div></section></article>;
}

export function EvaluationReportWorkspace({ onNavigate }: { onNavigate?: EvaluationWorkspaceNavigate }) {
  const { run, report, trace, isLoadingReport, reportError, loadReport, clearReportError } = useEvaluationWorkspace();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const findings = useMemo(() => report?.findings ?? [], [report?.findings]);
  const selected = useMemo(() => findings.find((finding) => finding.finding_id === selectedId) ?? findings[0], [findings, selectedId]);
  const phase = resolveEvaluationLoadingTipPhase({
    hasReport: Boolean(report),
    isLoadingReport,
    reportError,
    runStatus: run?.status,
  });
  const tip = useLoadingTip(phase, {
    active: isLoadingReport || !report || Boolean(reportError),
  });

  useGSAP(() => {
    const matchMedia = gsap.matchMedia();
    matchMedia.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(root.current?.querySelectorAll(".evaluation-report-reveal") ?? [], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.04, ease: LINE_DRAW_EASE });
    });
    return () => matchMedia.revert();
  }, { scope: root, dependencies: [report?.report_id] });

  if (isLoadingReport || !report) {
    return <section ref={root} className="evaluation-page evaluation-report-page" aria-label="测评报告工作台"><div className="evaluation-report-loading"><LoaderIcon />{reportError ? <><h1>报告暂不可用</h1><p>{reportError || tip}</p><button type="button" className="evaluation-primary-button" onClick={() => { clearReportError(); void loadReport(); }}>重新读取</button></> : <><h1>{run?.status === "completed" ? "正在读取测评报告" : "测评尚未完成"}</h1><p>{tip}</p>{run?.status !== "completed" && <button type="button" className="evaluation-secondary-button" onClick={() => onNavigate?.("run")}><ArrowLeft size={15} />返回测评运行</button>}</>}</div></section>;
  }

  return <section ref={root} className={`evaluation-page evaluation-report-page ${report.summary ? "has-summary" : ""}`} aria-label="测评报告工作台"><header className="evaluation-page-header evaluation-report-reveal"><div><span className="evaluation-eyebrow">EVALUATION REPORT</span><h1>测评报告</h1><p>{report.conclusion}</p></div><div className="evaluation-report-actions"><button type="button" className="evaluation-secondary-button" onClick={() => onNavigate?.("run")}><ArrowLeft size={15} />返回运行</button><span className={`evaluation-severity-badge is-${severityClass(report.severity)}`}>{SEVERITY_LABEL[report.severity] ?? report.severity}</span></div></header><div className="evaluation-report-reveal"><ScorePanel report={report} /></div>{report.summary && <ReportSummaryPanel summary={report.summary} />}<div className={`evaluation-report-layout evaluation-report-reveal ${drawerOpen ? "is-drawer-open" : ""}`}><FindingList findings={findings} selectedId={selected?.finding_id} onSelect={(finding) => { setSelectedId(finding.finding_id); setDrawerOpen(true); }} />{selected ? <EvidenceDetail finding={selected} traceEvents={(trace?.events ?? []) as SequencedEvent[]} onClose={() => setDrawerOpen(false)} /> : <div className="evaluation-empty-report"><CheckCircle2 size={24} /><h2>没有已确认的风险发现</h2><p>本次运行没有返回可复算的 Judge Finding。</p></div>}</div></section>;
}

function LoaderIcon() {
  return <div className="evaluation-report-loader" aria-hidden="true"><LoaderCircle size={24} /></div>;
}
