"use client";

import { ArrowLeft, Check, CircleAlert, CircleDashed, Play, RotateCcw, XCircle } from "lucide-react";
import { useMemo } from "react";
import {
  resolveEvaluationLoadingTipPhase,
  useLoadingTip,
} from "../../shared/loading-tips";
import { deriveBatchProgress, summarizeBatchProgress, type BatchTestState } from "./batch-progress";
import { useEvaluationWorkspace, type EvaluationWorkspaceNavigate } from "./EvaluationWorkspaceProvider";

const STATE_LABEL: Record<BatchTestState, string> = { pending: "等待", running: "运行中", passed: "PASS", failed: "FAIL", error: "ERROR" };

function StateIcon({ state }: { state: BatchTestState }) {
  if (state === "passed") return <Check size={15} />;
  if (state === "failed" || state === "error") return <XCircle size={15} />;
  return <CircleDashed className={state === "running" ? "evaluation-spin" : ""} size={15} />;
}

export function BatchProgressPanel({
  onViewReport,
  onNavigate,
  runOverride,
  eventsOverride,
}: {
  onViewReport?: () => void;
  onNavigate?: EvaluationWorkspaceNavigate;
  runOverride?: ReturnType<typeof useEvaluationWorkspace>["run"];
  eventsOverride?: ReturnType<typeof useEvaluationWorkspace>["events"];
}) {
  const { run: workspaceRun, events: workspaceEvents, testCases, isStarting, error, startEvaluation, retryEvaluation, resetEvaluationSelection } = useEvaluationWorkspace();
  const run = runOverride ?? workspaceRun;
  const events = eventsOverride ?? workspaceEvents;
  const progress = useMemo(() => deriveBatchProgress(run?.test_case_ids ?? [], events), [events, run?.test_case_ids]);
  const summary = useMemo(() => summarizeBatchProgress(progress), [progress]);
  const names = useMemo(() => new Map(testCases.map((item) => [item.id, item.name])), [testCases]);
  const percentage = summary.total ? Math.round((summary.completed / summary.total) * 100) : 0;
  const isActive = run?.status === "queued" || run?.status === "running";
  const isFailed = run?.status === "failed" || run?.status === "interrupted" || run?.status === "preflight_failed";
  const phase = resolveEvaluationLoadingTipPhase({
    latestEventType: events.at(-1)?.type,
    runStatus: run?.status,
    workspaceError: error,
  });
  const tip = useLoadingTip(phase, {
    active: isStarting || isActive || isFailed || Boolean(error),
  });

  return (
    <section className="evaluation-batch-panel" aria-label="批量 TestCase 进度">
      <header className="evaluation-batch-heading">
        <div><span className="evaluation-eyebrow">BATCH EXECUTION</span><h2>{summary.completed} / {summary.total} 已完成</h2></div>
        <div className="evaluation-batch-actions">
          {!isActive && <button type="button" className="evaluation-icon-command" title="返回选择 TestCase" aria-label="返回选择 TestCase" onClick={resetEvaluationSelection}><ArrowLeft size={16} /></button>}
          {run?.status === "completed" ? <button type="button" className="evaluation-primary-button" onClick={onViewReport ?? (() => onNavigate?.("report"))}><Check size={15} />查看报告</button> : isFailed ? <button type="button" className="evaluation-primary-button" onClick={() => void retryEvaluation()}><RotateCcw size={15} />重新创建</button> : <button type="button" className="evaluation-primary-button" disabled={run?.status !== "ready" || isStarting} onClick={() => void startEvaluation()}>{isActive || isStarting ? <CircleDashed className="evaluation-spin" size={15} /> : <Play size={15} />}{isStarting ? "正在启动" : isActive ? "批量运行中" : "开始测评"}</button>}
        </div>
      </header>
      <div className="evaluation-batch-track" role="progressbar" aria-label="批量测评完成进度" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.completed}><span style={{ width: `${percentage}%` }} /></div>
      <div className="evaluation-batch-totals"><span className="is-pass">PASS <b>{summary.passed}</b></span><span className="is-fail">FAIL <b>{summary.failed}</b></span><span className="is-error">ERROR <b>{summary.error}</b></span><span>运行中 <b>{summary.running}</b></span><span>等待 <b>{summary.pending}</b></span>{error ? <span className="evaluation-batch-error"><CircleAlert size={13} />{error}</span> : (isStarting || isActive || isFailed) ? <span className="evaluation-batch-tip">{tip}</span> : null}</div>
      <div className="evaluation-batch-list">
        {progress.map((item, index) => <div className={`evaluation-batch-row is-${item.state}`} key={item.testCaseId}><span className="evaluation-batch-index">{String(index + 1).padStart(2, "0")}</span><span className="evaluation-batch-name"><strong>{names.get(item.testCaseId) ?? item.testCaseId}</strong><small>{item.testCaseId}</small></span><span className="evaluation-batch-evidence">{item.evidenceCount ? `${item.evidenceCount} 证据` : ""}</span><span className="evaluation-batch-state"><StateIcon state={item.state} />{STATE_LABEL[item.state]}</span></div>)}
      </div>
    </section>
  );
}
