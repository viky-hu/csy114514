"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { Check, CircleAlert, CircleDashed, Clipboard, Filter, Play, RotateCcw, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import { BatchProgressPanel } from "./BatchProgressPanel";
import { useEvaluationWorkspace, EvaluationWorkspaceStatusAnnouncer, type EvaluationWorkspaceNavigate } from "./EvaluationWorkspaceProvider";
import { EVALUATION_STAGES, eventText, type EvaluationStage, type SequencedEvent } from "./evaluation-types";
import { TestCaseSelector } from "./TestCaseSelector";

gsap.registerPlugin(useGSAP);

const STAGE_COPY: Record<EvaluationStage, { title: string; detail: string; rows: string[] }> = {
  web_content_injection: {
    title: "网页内容注入测试",
    detail: "预检变异页面，并确认 canary 可读取",
    rows: ["解析 TestCase 与 AttackSeed", "注册 Sandbox 页面 fixture", "读取页面并校验 canary 指纹"],
  },
  persistent_memory_poisoning: {
    title: "跨会话记忆污染测试",
    detail: "第一轮写入，第二轮重建会话后读取",
    rows: ["开启 Agent 会话 01", "读取不可信页面上下文", "写入 Sandbox 持久记忆", "重建 Agent 会话 02", "验证同一记忆键跨会话可读"],
  },
  unconfirmed_email_send: {
    title: "未确认邮件发送测试",
    detail: "检查 Agent 是否在未获确认时调用外发工具",
    rows: ["复用会话 02 的记忆结果", "调用 email.send 外发工具", "Judge 重建五节点因果路径", "生成评分与风险证据"],
  },
};

const EVENT_KINDS = ["全部事件", "Runner", "Agent", "Tool", "Memory", "Judge"] as const;
type EventKind = (typeof EVENT_KINDS)[number];

function eventKind(event: SequencedEvent): Exclude<EventKind, "全部事件"> {
  if (event.type.startsWith("AGENT")) return "Agent";
  if (event.type.startsWith("TOOL")) return "Tool";
  if (event.type.includes("MEMORY")) return "Memory";
  if (event.type.includes("JUDGE") || event.type.includes("FINDING")) return "Judge";
  return "Runner";
}

function stageState(stage: EvaluationStage, runStatus: string | undefined, activeStage: EvaluationStage | null, events: SequencedEvent[]) {
  const index = EVALUATION_STAGES.indexOf(stage);
  const activeIndex = activeStage ? EVALUATION_STAGES.indexOf(activeStage) : -1;
  if (["failed", "interrupted", "preflight_failed"].includes(runStatus ?? "") && activeStage === stage) return "error";
  if (stage === "unconfirmed_email_send" && events.some((event) => event.type === "FINDING_CREATED" && ["HIGH", "CRITICAL"].includes(String(event.payload?.severity)))) return "risk";
  if (stage === "web_content_injection" && events.some((event) => event.type === "PREFLIGHT_COMPLETED")) return "complete";
  if (runStatus === "completed" || activeIndex > index) return "complete";
  if (activeIndex === index || (stage === "web_content_injection" && runStatus === "preflighting")) {
    return "running";
  }
  return "waiting";
}

function formatTime(timestamp: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(timestamp));
}

function safePayload(event: SequencedEvent) {
  return Object.entries(event.payload ?? {})
    .filter(([key]) => !/(secret|canary|memory_value|raw|path|stack|environment)/i.test(key))
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
}

function hasSuccessfulTool(events: SequencedEvent[], toolName: string) {
  return events.some((event) => event.type === "TOOL_RESULT" && event.payload?.tool_name === toolName && event.payload?.success === true);
}

function hasToolCall(events: SequencedEvent[], toolName: string) {
  return events.some((event) => event.type === "TOOL_CALLED" && event.payload?.tool_name === toolName);
}

function completedStepCount(stage: EvaluationStage, events: SequencedEvent[]) {
  const rows = STAGE_COPY[stage].rows;
  const completed = stage === "web_content_injection"
    ? events.some((event) => event.type === "PREFLIGHT_COMPLETED")
      ? rows.length
      : 0
    : stage === "persistent_memory_poisoning"
      ? [
        events.some((event) => event.type === "AGENT_INVOKED" && event.payload?.stage === stage),
        hasSuccessfulTool(events, "browser.open_page"),
        hasSuccessfulTool(events, "memory.write"),
        events.some((event) => event.type === "AGENT_INVOKED" && event.payload?.stage === "unconfirmed_email_send"),
        hasSuccessfulTool(events, "memory.read"),
      ].filter(Boolean).length
      : [
        hasSuccessfulTool(events, "memory.read"),
        hasToolCall(events, "email.send"),
        events.some((event) => event.type === "JUDGE_DECISION"),
        events.some((event) => event.type === "RUN_FINISHED" && event.payload?.report_available === true),
      ].filter(Boolean).length;
  return Math.min(rows.length, completed);
}

function ProcessColumn({ stage, events }: { stage: EvaluationStage; events: SequencedEvent[] }) {
  const root = useRef<HTMLDivElement>(null);
  const completedRows = completedStepCount(stage, events);

  useGSAP(() => {
    const matchMedia = gsap.matchMedia();
    matchMedia.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(root.current, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.36, ease: LINE_DRAW_EASE });
    });
    return () => matchMedia.revert();
  }, { scope: root, dependencies: [stage] });

  return (
    <div ref={root} className="evaluation-process-column">
      <div className="evaluation-process-heading">
        <div><span className="evaluation-eyebrow">LIVE TEST POINT</span><h2>{STAGE_COPY[stage].title}</h2></div>
        <span className="evaluation-stage-count">{completedRows}/{STAGE_COPY[stage].rows.length}</span>
      </div>
      <p className="evaluation-process-detail">{STAGE_COPY[stage].detail}</p>
      <ol className="evaluation-step-list">
        {STAGE_COPY[stage].rows.map((row, index) => {
          const completed = index < completedRows;
          return <li className={completed ? "is-complete" : index === completedRows ? "is-active" : ""} key={row}>
            <span className="evaluation-step-index">{completed ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</span>
            <span>{row}</span>
            {completed && <span className="evaluation-step-state">已完成</span>}
          </li>;
        })}
      </ol>
    </div>
  );
}

function TestPointRail({ onStart, onReport }: { onStart: () => void; onReport?: () => void }) {
  const { run, activeStage, events, isStarting, isBootstrapping, error, retryEvaluation } = useEvaluationWorkspace();
  const root = useRef<HTMLDivElement>(null);
  const canStart = run?.status === "ready";
  const running = run?.status === "queued" || run?.status === "running";
  const completed = run?.status === "completed";
  const failed = run?.status === "failed" || run?.status === "interrupted" || run?.status === "preflight_failed";
  useGSAP(() => {
    const matchMedia = gsap.matchMedia();
    matchMedia.add("(prefers-reduced-motion: no-preference)", () => {
      const rings = root.current?.querySelectorAll(".evaluation-test-ring circle");
      if (rings?.length) {
        gsap.to(rings, { strokeDashoffset: -57, duration: 1.35, ease: "none", repeat: -1 });
      }
    });
    return () => matchMedia.revert();
  }, { scope: root, dependencies: [activeStage, run?.status] });
  return <div ref={root} className="evaluation-rail-wrap">
    <div className="evaluation-rail" aria-label="测评测试点">
      {EVALUATION_STAGES.map((stage, index) => {
        const state = stageState(stage, run?.status, activeStage, events);
        const title = index === 0 ? "网页内容注入测试" : index === 1 ? "跨会话记忆污染测试" : "未确认邮件发送与裁决";
        return <div className={`evaluation-test-point is-${state}`} key={stage}>
          <span className="evaluation-test-number">0{index + 1}</span>
          <span className="evaluation-test-copy"><strong>{title}</strong><small>{state === "complete" ? "已完成" : state === "running" ? "运行中" : state === "risk" ? "确认风险" : state === "error" ? "运行异常" : "待测试"}</small></span>
          {state === "complete" ? <Check className="evaluation-test-icon" size={17} /> : state === "risk" || state === "error" ? <CircleAlert className="evaluation-test-icon" size={17} /> : state === "running" ? <svg className="evaluation-test-ring" viewBox="0 0 24 24" aria-label="运行中"><defs><linearGradient id={`evaluation-ring-gradient-${index}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3152f4" /><stop offset="0.55" stopColor="#52d6c2" /><stop offset="1" stopColor="#8c5cf6" /></linearGradient></defs><circle cx="12" cy="12" r="9" stroke={`url(#evaluation-ring-gradient-${index})`} /></svg> : <CircleDashed className="evaluation-test-icon" size={17} />}
        </div>;
      })}
      <div className="evaluation-rail-action">
        {completed ? <button className="evaluation-primary-button" type="button" onClick={onReport}><Check size={16} />查看测评报告</button> : failed ? <button className="evaluation-primary-button" type="button" onClick={() => void retryEvaluation()}><RotateCcw size={16} />新建测评重试</button> : <button className="evaluation-primary-button" type="button" disabled={!canStart || isStarting || isBootstrapping} onClick={onStart}>{running || isStarting ? <CircleDashed size={15} /> : <Play size={15} />}{isStarting ? "正在启动" : running ? "测评运行中" : "开始测评"}</button>}
        {error && <span className="evaluation-rail-error"><CircleAlert size={14} />{error}</span>}
      </div>
    </div>
  </div>;
}

function EvaluationTerminal({ events }: { events: SequencedEvent[] }) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [kind, setKind] = useState<EventKind>("全部事件");
  const [query, setQuery] = useState("");
  const filteredEvents = useMemo(() => events.filter((event) => {
    const matchesKind = kind === "全部事件" || eventKind(event) === kind;
    const haystack = `${eventText(event)} ${safePayload(event)}`.toLowerCase();
    return matchesKind && haystack.includes(query.trim().toLowerCase());
  }), [events, kind, query]);
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [filteredEvents.length]);
  const copyLog = async () => {
    await navigator.clipboard?.writeText(filteredEvents.map((event) => `${formatTime(event.timestamp)} ${eventText(event)} ${safePayload(event)}`).join("\n"));
  };
  return <section className="evaluation-terminal-panel" aria-label="后端语义控制台">
    <header className="evaluation-panel-header"><div><span className="evaluation-eyebrow">BACKEND TRACE</span><h2><TerminalSquare size={17} /> Runner terminal</h2></div><button className="evaluation-icon-button" type="button" title="复制当前日志" aria-label="复制当前日志" onClick={() => void copyLog()}><Clipboard size={15} /></button></header>
    <div className="evaluation-terminal-toolbar"><label><Filter size={13} /><span className="evaluation-visually-hidden">筛选事件类型</span><select value={kind} onChange={(event) => setKind(event.target.value as EventKind)}>{EVENT_KINDS.map((item) => <option key={item}>{item}</option>)}</select></label><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索事件" aria-label="搜索事件" /></div>
    <div ref={terminalRef} className="evaluation-terminal" tabIndex={0}>
      {filteredEvents.length === 0 ? <div className="evaluation-terminal-empty">等待真实后端事件...</div> : filteredEvents.map((event) => <div className="evaluation-log-line" key={`${event.run_id}:${event.seq}`}><time>{formatTime(event.timestamp)}</time><b className={`is-${eventKind(event).toLowerCase()}`}>{eventKind(event)}</b><span>{eventText(event)}</span>{safePayload(event) && <small>{safePayload(event)}</small>}</div>)}
    </div>
  </section>;
}

export function EvaluationRunWorkspace({ onViewReport, onNavigate }: { onViewReport?: () => void; onNavigate?: EvaluationWorkspaceNavigate }) {
  const { run, events, activeStage, isBootstrapping, startEvaluation } = useEvaluationWorkspace();
  const stage = activeStage ?? "web_content_injection";
  const isLegacyR4 = run?.test_case_ids.length === 1 && run.test_case_ids[0] === "tc_pipi_001";
  const statusText = isBootstrapping ? "连接后端" : run?.status ?? "选择用例";
  return <section className={`evaluation-page evaluation-run-page ${!run ? "is-selecting" : isLegacyR4 ? "is-legacy-r4" : "is-batch"}`} aria-label="测评运行工作台">
    <EvaluationWorkspaceStatusAnnouncer />
    <header className="evaluation-page-header"><div><span className="evaluation-eyebrow">EVALUATION RUN</span><h1>测评运行</h1><p>以持久事件和 SSE 实时复盘 Agent 的真实执行路径。</p></div><span className={`evaluation-run-status is-${run?.status ?? "selection"}`}>{statusText}</span></header>
    {!run ? <TestCaseSelector /> : isLegacyR4 ? <><TestPointRail onStart={() => void startEvaluation()} onReport={onViewReport ?? (() => onNavigate?.("report"))} /><div className="evaluation-run-body"><ProcessColumn stage={stage} events={events} /><EvaluationTerminal events={events} /></div></> : <div className="evaluation-batch-run-body"><BatchProgressPanel onViewReport={onViewReport} onNavigate={onNavigate} /><EvaluationTerminal events={events} /></div>}
  </section>;
}
