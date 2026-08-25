"use client";

import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ArrowLeft, ChevronDown, ChevronUp, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { LINE_DRAW_EASE } from "../../shared/animation";
import { useEvaluationWorkspace, type EvaluationWorkspaceNavigate } from "./EvaluationWorkspaceProvider";
import {
  comparisonTransitionLabel,
  deriveComparisonReportSummary,
  type ComparisonLedgerRow,
  type ComparisonReportSummary,
} from "./comparison-report-summary";
import type { ComparisonTransition } from "./comparison-types";

gsap.registerPlugin(useGSAP);

const TRANSITION_DETAIL: Record<ComparisonTransition, string> = {
  defense_blocked: "Bare 失败，Defended 通过",
  defense_failed: "两侧均未通过",
  possible_regression: "Bare 通过，Defended 未通过",
  both_pass: "两侧均稳定通过",
  incomplete: "异常或非 PASS/FAIL 结果",
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPoints(value: number) {
  return `${value > 0 ? "+" : ""}${Number.isInteger(value) ? value : value.toFixed(1)} pp`;
}

function verdictLabel(verdict: string | null) {
  return verdict ?? "未完成";
}

function severityClass(severity: string | null) {
  return severity?.toLowerCase().replace(/[^a-z]/g, "") ?? "unknown";
}

function transitionClass(transition: ComparisonTransition) {
  return transition.replace(/_/g, "-");
}

function PassRateRing({
  label,
  rate,
  passed,
  comparable,
  side,
}: {
  label: string;
  rate: number;
  passed: number;
  comparable: number;
  side: "bare" | "defended";
}) {
  const percent = Math.round(rate * 100);
  return (
    <figure className={`evaluation-comparison-rate-ring is-${side}`} aria-label={`${label} 安全通过率 ${percent}%`}>
      <svg viewBox="0 0 160 160" role="img" aria-hidden="true">
        <circle className="evaluation-comparison-ring-track" cx="80" cy="80" r="54" pathLength="100" />
        <circle
          className="evaluation-comparison-ring-value"
          cx="80"
          cy="80"
          r="54"
          pathLength="100"
          strokeDasharray={`${Math.max(0, Math.min(100, percent))} 100`}
        />
        <circle className="evaluation-comparison-ring-core" cx="80" cy="80" r="39" />
        <text className="evaluation-comparison-ring-number" x="80" y="77" textAnchor="middle">{formatPercent(rate)}</text>
        <text className="evaluation-comparison-ring-caption" x="80" y="95" textAnchor="middle">安全通过率</text>
      </svg>
      <figcaption>
        <span>{label}</span>
        <strong>{passed}<small> / {comparable} 可比</small></strong>
      </figcaption>
    </figure>
  );
}

function TransitionCard({
  transition,
  count,
  total,
}: {
  transition: ComparisonTransition;
  count: number;
  total: number;
}) {
  return (
    <article className={`evaluation-comparison-transition-card is-${transitionClass(transition)}`}>
      <span>{comparisonTransitionLabel(transition)}</span>
      <strong>{count}</strong>
      <small>{TRANSITION_DETAIL[transition]} · {total ? Math.round((count / total) * 100) : 0}% 样本</small>
    </article>
  );
}

function PatternBreakdown({ summary }: { summary: ComparisonReportSummary }) {
  return (
    <section className="evaluation-comparison-patterns evaluation-comparison-reveal" aria-labelledby="comparison-pattern-title">
      <header className="evaluation-comparison-section-heading">
        <div>
          <span className="evaluation-eyebrow">RISK PATTERN BREAKDOWN</span>
          <h2 id="comparison-pattern-title">按风险模式的防御成效</h2>
        </div>
        <p>每一行只对该模式内双侧明确 PASS/FAIL 的 Case 计算安全通过率。</p>
      </header>
      <div className="evaluation-comparison-pattern-grid">
        {summary.patterns.map((pattern) => {
          const bareRate = pattern.comparable ? pattern.barePassed / pattern.comparable : 0;
          const defendedRate = pattern.comparable ? pattern.defendedPassed / pattern.comparable : 0;
          return (
            <article className="evaluation-comparison-pattern-card" key={pattern.key}>
              <header>
                <div><strong>{pattern.key}</strong><span>{pattern.total} 条测试</span></div>
                <small>{pattern.comparable ? `${pattern.comparable} 条可比` : "无可比样本"}</small>
              </header>
              <div className="evaluation-comparison-pattern-rate">
                <span>Bare</span><div><i className="is-bare" style={{ width: `${bareRate * 100}%` }} /></div><b>{pattern.comparable ? formatPercent(bareRate) : "--"}</b>
              </div>
              <div className="evaluation-comparison-pattern-rate">
                <span>Defended</span><div><i className="is-defended" style={{ width: `${defendedRate * 100}%` }} /></div><b>{pattern.comparable ? formatPercent(defendedRate) : "--"}</b>
              </div>
              <footer>
                {pattern.transitions.possible_regression > 0 && <span className="is-possible-regression">误伤 {pattern.transitions.possible_regression}</span>}
                {pattern.transitions.defense_failed > 0 && <span className="is-defense-failed">未解决 {pattern.transitions.defense_failed}</span>}
                {pattern.transitions.defense_blocked > 0 && <span className="is-defense-blocked">阻断 {pattern.transitions.defense_blocked}</span>}
                {pattern.transitions.both_pass > 0 && <span className="is-both-pass">稳定 {pattern.transitions.both_pass}</span>}
                {pattern.transitions.incomplete > 0 && <span className="is-incomplete">不可比 {pattern.transitions.incomplete}</span>}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LedgerRow({
  row,
  expanded,
  onToggle,
}: {
  row: ComparisonLedgerRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const detailId = `comparison-detail-${row.test_case_id}`;
  const findingCount = row.findings.bare.length + row.findings.defended.length;
  return (
    <article className={`evaluation-comparison-ledger-row is-${transitionClass(row.transition)} ${expanded ? "is-expanded" : ""}`}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={detailId}>
        <span className="evaluation-comparison-ledger-pattern">{row.riskPattern}</span>
        <span className="evaluation-comparison-ledger-case"><strong>{row.testCase?.name ?? row.test_case_id}</strong><small>{row.test_case_id} · {row.testCase?.risk_type ?? "未匹配目录"}</small></span>
        <span className={`evaluation-comparison-ledger-severity is-${severityClass(row.severity)}`}>{row.severity ?? "未标注"}</span>
        <span className="evaluation-comparison-ledger-verdicts"><b className={`is-${(row.bare_verdict ?? "pending").toLowerCase()}`}>Bare {verdictLabel(row.bare_verdict)}</b><b className={`is-${(row.defended_verdict ?? "pending").toLowerCase()}`}>Defended {verdictLabel(row.defended_verdict)}</b></span>
        <span className="evaluation-comparison-ledger-findings">{findingCount} Finding</span>
        {expanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
      </button>
      {expanded && (
        <div className="evaluation-comparison-ledger-detail" id={detailId}>
          <dl>
            <div><dt>测试描述</dt><dd>{row.testCase?.description ?? "TestCase 目录未返回描述。"}</dd></div>
            <div><dt>状态转移</dt><dd>{comparisonTransitionLabel(row.transition)} · {TRANSITION_DETAIL[row.transition]}</dd></div>
            <div><dt>规则</dt><dd>{row.ruleTypes.length ? row.ruleTypes.join(" · ") : "未返回规则类型。"}</dd></div>
            <div><dt>脱敏摘要</dt><dd>{row.redactedSummary}</dd></div>
          </dl>
          <div className="evaluation-comparison-finding-sides">
            <div><span>Bare Finding</span><b>{row.findings.bare.length}</b></div>
            <div><span>Defended Finding</span><b>{row.findings.defended.length}</b></div>
          </div>
        </div>
      )}
    </article>
  );
}

export function EvaluationComparisonWorkspace({ onNavigate }: { onNavigate?: EvaluationWorkspaceNavigate }) {
  const { comparison, comparisonReport, comparisonError, isLoadingComparisonReport, testCases } = useEvaluationWorkspace();
  const [expanded, setExpanded] = useState<string | null>(null);
  const root = useRef<HTMLElement>(null);
  const summary = useMemo(
    () => comparisonReport ? deriveComparisonReportSummary(comparisonReport.results, testCases) : null,
    [comparisonReport, testCases],
  );

  useGSAP(() => {
    if (!root.current || !summary) return;
    const targets = root.current.querySelectorAll(".evaluation-comparison-reveal");
    if (!targets.length) return;
    const matchMedia = gsap.matchMedia();
    matchMedia.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(targets, { autoAlpha: 0, y: 9 }, { autoAlpha: 1, y: 0, duration: 0.36, stagger: 0.035, ease: LINE_DRAW_EASE });
    });
    return () => matchMedia.revert();
  }, { scope: root, dependencies: [comparisonReport?.comparison_id, summary] });

  if (!comparison) return null;

  return (
    <section ref={root} className="evaluation-page evaluation-comparison-report-workspace" aria-label="Bare 与 Defended 对比报告">
      <header className="evaluation-page-header evaluation-comparison-report-header evaluation-comparison-reveal">
        <div>
          <span className="evaluation-eyebrow">BARE VS DEFENDED · SECURITY BRIEF</span>
          <h1>对比测评报告</h1>
          <p>同一组 TestCase 下的 Bare 基线与 Defended 防御结果。安全通过率仅以两侧均为明确 PASS/FAIL 的可比 Case 为分母。</p>
        </div>
        <button type="button" className="evaluation-secondary-button" onClick={() => onNavigate?.("run")}>
          <ArrowLeft size={15} />返回测评运行
        </button>
      </header>

      {comparisonError && <div className="evaluation-comparison-error"><CircleAlert size={16} />{comparisonError}</div>}

      {!summary || isLoadingComparisonReport ? (
        <div className="evaluation-comparison-empty">
          <LoaderCircle className="evaluation-spin" size={18} />
          {comparison.status === "completed" ? "正在读取对比报告…" : "两侧尚未全部完成，报告暂不可用。"}
        </div>
      ) : (
        <>
          <section className={`evaluation-comparison-summary evaluation-comparison-reveal is-${summary.conclusion.tone}`} aria-labelledby="comparison-conclusion-title">
            <div className="evaluation-comparison-summary-copy">
              <span className="evaluation-eyebrow">ASSESSMENT CONCLUSION</span>
              <h2 id="comparison-conclusion-title">评审结论</h2>
              <strong>{summary.conclusion.headline}</strong>
              <p>{summary.conclusion.detail}</p>
            </div>
            <dl className="evaluation-comparison-coverage">
              <div><dt>总样本</dt><dd>{summary.coverage.total}</dd></div>
              <div><dt>可比样本</dt><dd>{summary.coverage.comparable}</dd></div>
              <div><dt>异常/不可比</dt><dd>{summary.coverage.incomplete}</dd></div>
            </dl>
          </section>

          <section className="evaluation-comparison-rate-rings evaluation-comparison-reveal" aria-labelledby="comparison-rate-title">
            <header className="evaluation-comparison-section-heading">
              <div>
                <span className="evaluation-eyebrow">COMPARABLE SAMPLE RATE</span>
                <h2 id="comparison-rate-title">安全通过率对比</h2>
              </div>
              <p>{summary.coverage.comparable} 条可比 Case 作为统一口径。</p>
            </header>
            <div className="evaluation-comparison-rate-rings-body">
              <PassRateRing label="Bare 基线" side="bare" rate={summary.rates.barePassRate} passed={summary.rates.barePassed} comparable={summary.coverage.comparable} />
              <div className={`evaluation-comparison-rate-delta ${summary.passRateDeltaPoints > 0 ? "is-positive" : summary.passRateDeltaPoints < 0 ? "is-negative" : "is-neutral"}`}>
                <span>Defended 相对 Bare</span>
                <strong>{formatPoints(summary.passRateDeltaPoints)}</strong>
                <small>百分点变化</small>
              </div>
              <PassRateRing label="Defended 防御" side="defended" rate={summary.rates.defendedPassRate} passed={summary.rates.defendedPassed} comparable={summary.coverage.comparable} />
            </div>
          </section>

          <section className="evaluation-comparison-transitions evaluation-comparison-reveal" aria-labelledby="comparison-transition-title">
            <header className="evaluation-comparison-section-heading">
              <div>
                <span className="evaluation-eyebrow">CASE TRANSITIONS</span>
                <h2 id="comparison-transition-title">状态转移分布</h2>
              </div>
              <p>异常与不可比不参与通过率变化，但会单列影响覆盖度。</p>
            </header>
            <div className="evaluation-comparison-transition-grid">
              {(["defense_blocked", "defense_failed", "possible_regression", "both_pass"] as const).map((transition) => (
                <TransitionCard key={transition} transition={transition} count={summary.transitions[transition]} total={summary.coverage.total} />
              ))}
            </div>
            {summary.transitions.incomplete > 0 && <p className="evaluation-comparison-incomplete-note">覆盖度提示：{summary.transitions.incomplete} 条异常/不可比结果未纳入安全通过率。</p>}
          </section>

          <PatternBreakdown summary={summary} />

          <section className="evaluation-comparison-ledger evaluation-comparison-reveal" aria-labelledby="comparison-ledger-title">
            <header className="evaluation-comparison-section-heading">
              <div>
                <span className="evaluation-eyebrow">RISK-PRIORITIZED LEDGER</span>
                <h2 id="comparison-ledger-title">风险优先文字台账</h2>
              </div>
              <p>优先复核可能误伤与残余风险；组内保持原 TestCase 顺序。</p>
            </header>
            <div className="evaluation-comparison-ledger-groups">
              {summary.ledgerGroups.map((group) => (
                <section className={`evaluation-comparison-ledger-group is-${transitionClass(group.key)}`} key={group.key}>
                  <header><span>{group.label}</span><b>{group.rows.length}</b></header>
                  <div>{group.rows.map((row) => <LedgerRow key={row.test_case_id} row={row} expanded={expanded === row.test_case_id} onToggle={() => setExpanded(expanded === row.test_case_id ? null : row.test_case_id)} />)}</div>
                </section>
              ))}
            </div>
          </section>

          <footer className="evaluation-comparison-method-note evaluation-comparison-reveal">
            <ShieldCheck size={16} aria-hidden="true" />
            <p>本报告只复算当前对比接口、逐 Case 转移、Finding 与 TestCase 目录中的可审计数据；不推断性能、成本、时延或防御策略命中原因。</p>
          </footer>
        </>
      )}
    </section>
  );
}
