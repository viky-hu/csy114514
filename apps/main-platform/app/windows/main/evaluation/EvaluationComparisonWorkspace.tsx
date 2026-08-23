"use client";

import { ArrowLeft, CircleAlert, LoaderCircle } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useEvaluationWorkspace, type EvaluationWorkspaceNavigate } from "./EvaluationWorkspaceProvider";
import { compareComparisonRows, transitionLabel } from "./comparison-progress";

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function EvaluationComparisonWorkspace({ onNavigate }: { onNavigate?: EvaluationWorkspaceNavigate }) {
  const { comparison, comparisonReport, comparisonError, isLoadingComparisonReport, testCases } = useEvaluationWorkspace();
  const [expanded, setExpanded] = useState<string | null>(null);
  const rows = useMemo(() => compareComparisonRows(comparisonReport?.results ?? []), [comparisonReport?.results]);
  const names = useMemo(() => new Map(testCases.map((item) => [item.id, item.name])), [testCases]);

  if (!comparison) return null;
  return (
    <section className="evaluation-comparison-report-workspace" aria-label="Bare 与 Defended 对比报告">
      <header className="evaluation-comparison-report-header">
        <div>
          <span className="evaluation-eyebrow">BARE VS DEFENDED · REPORT</span>
          <h2>防御效果对比</h2>
          <p>同一组 TestCase 的 Bare 与 Defended 结果、Finding 和状态转移。</p>
        </div>
        <button type="button" className="evaluation-secondary-button" onClick={() => onNavigate?.("run")}>
          <ArrowLeft size={15} />返回测评运行
        </button>
      </header>
      {comparisonError && <div className="evaluation-comparison-error"><CircleAlert size={16} />{comparisonError}</div>}
      {!comparisonReport || isLoadingComparisonReport ? (
        <div className="evaluation-comparison-empty">
          <LoaderCircle className="evaluation-spin" size={18} />
          {comparison.status === "completed" ? "正在读取对比报告…" : "两侧尚未全部完成，报告暂不可用。"}
        </div>
      ) : (
        <>
          <div className="evaluation-comparison-metrics">
            <div><span>Bare PASS 率</span><strong>{percent(comparisonReport.summary.bare_pass_rate)}</strong></div>
            <div><span>Defended PASS 率</span><strong>{percent(comparisonReport.summary.defended_pass_rate)}</strong></div>
            <div><span>通过率差</span><strong className={comparisonReport.summary.pass_rate_delta >= 0 ? "is-positive" : "is-negative"}>{comparisonReport.summary.pass_rate_delta >= 0 ? "+" : ""}{percent(comparisonReport.summary.pass_rate_delta)}</strong></div>
            <div><span>防御阻断</span><strong>{comparisonReport.summary.defense_blocked}</strong></div>
          </div>
          <div className="evaluation-comparison-table-wrap">
            <table className="evaluation-comparison-table">
              <thead><tr><th>TestCase</th><th>Bare</th><th>Defended</th><th>状态转移</th></tr></thead>
              <tbody>
                {rows.map((row) => (
                  <Fragment key={row.test_case_id}>
                    <tr
                      className={expanded === row.test_case_id ? "is-expanded" : ""}
                      onClick={() => setExpanded(expanded === row.test_case_id ? null : row.test_case_id)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          setExpanded(expanded === row.test_case_id ? null : row.test_case_id);
                        }
                      }}
                    >
                      <td><strong>{names.get(row.test_case_id) ?? row.test_case_id}</strong><small>{row.test_case_id}</small></td>
                      <td><span className={`comparison-verdict is-${(row.bare_verdict ?? "pending").toLowerCase()}`}>{row.bare_verdict ?? "等待"}</span></td>
                      <td><span className={`comparison-verdict is-${(row.defended_verdict ?? "pending").toLowerCase()}`}>{row.defended_verdict ?? "等待"}</span></td>
                      <td><span className={`comparison-transition is-${row.transition}`}>{transitionLabel(row.transition)}</span></td>
                    </tr>
                    {expanded === row.test_case_id && (
                      <tr className="evaluation-comparison-detail">
                        <td colSpan={4}>
                          <div>
                            <span>Bare run: {comparison.bare_run_id}</span>
                            <span>Defended run: {comparison.defended_run_id ?? "尚未创建"}</span>
                            <span>Bare Finding: {row.bare_findings?.length ?? 0} 条</span>
                            <span>Defended Finding: {row.defended_findings?.length ?? 0} 条</span>
                            {[...(row.bare_findings ?? []).map((finding, index) => ({ side: "Bare", index, finding })), ...(row.defended_findings ?? []).map((finding, index) => ({ side: "Defended", index, finding }))].map(({ side, index, finding }) => (
                              <span key={`${side}-${index}-${finding.finding_id ?? "finding"}`}>{`${side} · ${finding.severity ?? "风险"} · ${finding.description ?? finding.finding_id ?? "Finding"}`}</span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
