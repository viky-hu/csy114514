"use client";

import { CircleAlert, FileText, LoaderCircle, RefreshCw, RotateCcw } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useEvaluationWorkspace } from "./EvaluationWorkspaceProvider";
import { compareComparisonRows, transitionLabel } from "./comparison-progress";
import type { ComparisonSide } from "./comparison-types";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function EvaluationComparisonWorkspace({ onViewReport }: { onViewReport?: () => void }) {
  const {
    comparison,
    comparisonReport,
    comparisonError,
    isLoadingComparisonReport,
    isBootstrapping,
    retryComparison,
    loadComparisonReport,
    resetEvaluationSelection,
    testCases,
  } = useEvaluationWorkspace();
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = useMemo(() => compareComparisonRows(comparisonReport?.results ?? []), [comparisonReport?.results]);
  const names = useMemo(() => new Map(testCases.map((item) => [item.id, item.name])), [testCases]);
  if (!comparison) return null;
  const bareStatus = comparison.bare_run.status;
  const defendedStatus = comparison.defended_run?.status ?? "queued";
  const isActive = !["completed", "partial", "failed"].includes(comparison.status);
  const retryable = (status: string) => ["failed", "interrupted", "preflight_failed"].includes(status);
  const runRetry = (side: ComparisonSide) => void retryComparison(side);
  return (
    <section className="evaluation-comparison-workspace" aria-label="Bare 与 Defended 对比工作台">
      <header className="evaluation-comparison-header">
        <div><span className="evaluation-eyebrow">BARE VS DEFENDED</span><h2>防御效果对比</h2><p>同一组 TestCase 使用不可变输入快照，分别在独立 Sandbox 中执行。</p></div>
        <div className="evaluation-comparison-actions">
          {comparisonReport && !isActive && onViewReport && <button type="button" className="evaluation-secondary-button" onClick={onViewReport}><FileText size={15} />查看对比报告</button>}
          <button type="button" className="evaluation-secondary-button" onClick={() => void loadComparisonReport()} disabled={isLoadingComparisonReport || isActive}><RefreshCw size={15} />{isLoadingComparisonReport ? "正在读取" : "刷新报告"}</button>
          <button type="button" className="evaluation-icon-command" title="重新选择 TestCase" aria-label="重新选择 TestCase" onClick={resetEvaluationSelection}><RotateCcw size={16} /></button>
        </div>
      </header>
      <div className="evaluation-comparison-progress" aria-label="两侧运行进度">
        <div className="evaluation-comparison-side"><div><strong>Bare</strong><span>llm-agent-v0</span></div><b className={`is-${bareStatus}`}>{bareStatus}</b>{retryable(bareStatus) && <button type="button" className="evaluation-text-button" onClick={() => runRetry("bare")}><RotateCcw size={14} />重试 Bare</button>}</div>
        <div className="evaluation-comparison-side"><div><strong>Defended</strong><span>defended-llm-v0</span></div><b className={`is-${defendedStatus}`}>{defendedStatus === "queued" && comparison.status === "running_bare" ? "排队中" : defendedStatus}</b>{retryable(defendedStatus) && <button type="button" className="evaluation-text-button" onClick={() => runRetry("defended")}><RotateCcw size={14} />重试 Defended</button>}</div>
      </div>
      {comparisonReport && <div className="evaluation-comparison-metrics"><div><span>Bare PASS 率</span><strong>{percent(comparisonReport.summary.bare_pass_rate)}</strong></div><div><span>Defended PASS 率</span><strong>{percent(comparisonReport.summary.defended_pass_rate)}</strong></div><div><span>通过率差</span><strong className={comparisonReport.summary.pass_rate_delta >= 0 ? "is-positive" : "is-negative"}>{comparisonReport.summary.pass_rate_delta >= 0 ? "+" : ""}{percent(comparisonReport.summary.pass_rate_delta)}</strong></div><div><span>防御阻断</span><strong>{comparisonReport.summary.defense_blocked}</strong></div></div>}
      {comparisonError && <div className="evaluation-comparison-error"><CircleAlert size={16} />{comparisonError}</div>}
      {!comparisonReport ? <div className="evaluation-comparison-empty"><LoaderCircle className="evaluation-spin" size={18} />{isBootstrapping || isActive ? "两侧正在执行，等待对齐结果…" : "报告尚未生成"}</div> : <div className="evaluation-comparison-table-wrap"><table className="evaluation-comparison-table"><thead><tr><th>TestCase</th><th>Bare</th><th>Defended</th><th>状态转移</th></tr></thead><tbody>{rows.map((row) => <Fragment key={row.test_case_id}><tr className={expanded === row.test_case_id ? "is-expanded" : ""} onClick={() => setExpanded(expanded === row.test_case_id ? null : row.test_case_id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setExpanded(expanded === row.test_case_id ? null : row.test_case_id); }}><td><strong>{names.get(row.test_case_id) ?? row.test_case_id}</strong><small>{row.test_case_id}</small></td><td><span className={`comparison-verdict is-${(row.bare_verdict ?? "pending").toLowerCase()}`}>{row.bare_verdict ?? "等待"}</span></td><td><span className={`comparison-verdict is-${(row.defended_verdict ?? "pending").toLowerCase()}`}>{row.defended_verdict ?? "等待"}</span></td><td><span className={`comparison-transition is-${row.transition}`}>{transitionLabel(row.transition)}</span></td></tr>{expanded === row.test_case_id && <tr className="evaluation-comparison-detail"><td colSpan={4}><div><span>Bare run: {comparison.bare_run_id}</span><span>Defended run: {comparison.defended_run_id ?? "尚未创建"}</span><span>Bare Finding: {row.bare_findings?.length ?? 0} 条，证据 {row.bare_findings?.reduce((total, finding) => total + (finding.evidence_count ?? 0), 0) ?? 0} 条</span><span>Defended Finding: {row.defended_findings?.length ?? 0} 条，证据 {row.defended_findings?.reduce((total, finding) => total + (finding.evidence_count ?? 0), 0) ?? 0} 条</span>{[...(row.bare_findings ?? []).map((finding, index) => ({ side: "bare", index, finding })), ...(row.defended_findings ?? []).map((finding, index) => ({ side: "defended", index, finding }))].map(({ side, index, finding }) => <span key={`${side}-${index}-${finding.finding_id ?? "finding"}`}>{`${side === "bare" ? "Bare" : "Defended"} · ${finding.severity ?? "风险"} · ${finding.description ?? finding.finding_id ?? "Finding"}`}</span>)}</div></td></tr>}</Fragment>)}</tbody></table></div>}
    </section>
  );
}
