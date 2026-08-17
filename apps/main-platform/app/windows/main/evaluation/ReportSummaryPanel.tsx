import type { ReportSummary } from "./evaluation-types";
import { buildRiskPatternRows, buildSummaryRows, type SummaryRow } from "./report-summary";

const SEVERITY_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

function DimensionChart({ title, rows }: { title: string; rows: SummaryRow[] }) {
  return <section className="evaluation-summary-dimension"><header><h3>{title}</h3><span>{rows.reduce((total, row) => total + row.total, 0)} TESTS</span></header><div className="evaluation-summary-rows">{rows.length === 0 ? <p>暂无统计</p> : rows.map((row) => <div className="evaluation-summary-row" key={row.key}><span className="evaluation-summary-key" title={row.key}>{row.key}</span><div className="evaluation-summary-bar" role="img" aria-label={`${row.key}：PASS ${row.passed}，FAIL ${row.failed}，ERROR ${row.error}`}><span className="is-pass" style={{ width: `${row.passedPercent}%` }} /><span className="is-fail" style={{ width: `${row.failedPercent}%` }} /><span className="is-error" style={{ width: `${row.errorPercent}%` }} /></div><b>{row.total}</b></div>)}</div></section>;
}

export function ReportSummaryPanel({ summary }: { summary: ReportSummary }) {
  return <section className="evaluation-summary-panel evaluation-report-reveal" aria-label="批量测评统计摘要"><header className="evaluation-summary-heading"><div><span className="evaluation-eyebrow">BATCH SUMMARY</span><h2>批量统计</h2></div><div className="evaluation-summary-overall"><span><b>{summary.total_tests}</b> 总数</span><span className="is-pass"><b>{summary.passed}</b> PASS</span><span className="is-fail"><b>{summary.failed}</b> FAIL</span><span className="is-error"><b>{summary.error}</b> ERROR</span><strong>{Math.round(summary.pass_rate * 1000) / 10}%</strong></div></header><div className="evaluation-summary-legend"><span className="is-pass">PASS</span><span className="is-fail">FAIL</span><span className="is-error">ERROR</span></div><div className="evaluation-summary-grid"><DimensionChart title="R1–R4 / OTHER" rows={buildRiskPatternRows(summary.by_risk_pattern)} /><DimensionChart title="RISK TYPE" rows={buildSummaryRows(summary.by_risk_type)} /><DimensionChart title="SEVERITY" rows={buildSummaryRows(summary.by_severity, SEVERITY_ORDER)} /></div></section>;
}
