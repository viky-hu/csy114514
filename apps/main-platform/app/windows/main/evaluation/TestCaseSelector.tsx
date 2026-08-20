"use client";

import { CheckSquare2, CircleAlert, LoaderCircle, Search, Square, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useLoadingTip } from "../../shared/loading-tips";
import { useEvaluationWorkspace } from "./EvaluationWorkspaceProvider";
import { EVALUATION_AGENT_OPTIONS } from "./evaluation-agent";
import { filterTestCases } from "./test-case-selection";

const RISK_PATTERNS = ["ALL", "R1", "R2", "R3", "R4"] as const;

export function TestCaseSelector() {
  const {
    testCases,
    selectedTestCaseIds,
    setSelectedTestCaseIds,
    toggleTestCaseSelection,
    prepareEvaluation,
    isLoadingTestCases,
    isBootstrapping,
    testCaseError,
    error,
    evaluationAgentId,
    setEvaluationAgentId,
  } = useEvaluationWorkspace();
  const [query, setQuery] = useState("");
  const [riskPattern, setRiskPattern] = useState<(typeof RISK_PATTERNS)[number]>("ALL");
  const filtered = useMemo(() => filterTestCases(testCases, query, riskPattern), [query, riskPattern, testCases]);
  const selected = useMemo(() => new Set(selectedTestCaseIds), [selectedTestCaseIds]);
  const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));
  const phase = testCaseError || error ? "error" : isLoadingTestCases || isBootstrapping ? "boot" : "idle";
  const tip = useLoadingTip(phase, {
    active: isLoadingTestCases || isBootstrapping || Boolean(testCaseError || error),
  });

  const toggleVisible = () => {
    const visibleIds = new Set(filtered.map((item) => item.id));
    setSelectedTestCaseIds(allFilteredSelected
      ? selectedTestCaseIds.filter((id) => !visibleIds.has(id))
      : [...selectedTestCaseIds, ...filtered.filter((item) => !selected.has(item.id)).map((item) => item.id)]);
  };

  return (
    <section className="evaluation-selector" aria-label="TestCase 选择器">
      <header className="evaluation-selector-header">
        <div>
          <span className="evaluation-eyebrow">TEST CASE CATALOG</span>
          <h2>选择测评用例</h2>
        </div>
        <div className="evaluation-selector-count"><strong>{selectedTestCaseIds.length}</strong><span>/ {testCases.length} 已选择</span></div>
      </header>
      <div className="evaluation-selector-toolbar">
        <label className="evaluation-search-control"><Search size={15} /><span className="evaluation-visually-hidden">搜索 TestCase</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索 ID、名称或风险类型" /></label>
        <label className="evaluation-pattern-control"><span className="evaluation-visually-hidden">风险路径</span><select value={riskPattern} onChange={(event) => setRiskPattern(event.target.value as (typeof RISK_PATTERNS)[number])}>{RISK_PATTERNS.map((pattern) => <option key={pattern} value={pattern}>{pattern === "ALL" ? "全部路径" : pattern}</option>)}</select></label>
        <label className="evaluation-agent-control"><span className="evaluation-visually-hidden">Agent 类型</span><select value={evaluationAgentId} onChange={(event) => setEvaluationAgentId(event.target.value)}>{EVALUATION_AGENT_OPTIONS.map((agent) => <option key={agent.id} value={agent.id}>{agent.label}</option>)}</select></label>
        <button type="button" className="evaluation-secondary-button" onClick={toggleVisible} disabled={filtered.length === 0}>{allFilteredSelected ? <CheckSquare2 size={15} /> : <Square size={15} />}{allFilteredSelected ? "取消当前结果" : `选择当前结果 (${filtered.length})`}</button>
        <button type="button" className="evaluation-icon-command" title="清空选择" aria-label="清空选择" onClick={() => setSelectedTestCaseIds([])} disabled={selectedTestCaseIds.length === 0}><X size={16} /></button>
      </div>
      <div className="evaluation-selector-list" aria-busy={isLoadingTestCases}>
        {isLoadingTestCases ? <div className="evaluation-selector-empty"><LoaderCircle className="evaluation-spin" size={19} />{tip}</div> : testCaseError ? <div className="evaluation-selector-empty is-error"><CircleAlert size={18} />{testCaseError || tip}</div> : filtered.length === 0 ? <div className="evaluation-selector-empty">{tip}</div> : filtered.map((testCase) => {
          const checked = selected.has(testCase.id);
          return <label className={`evaluation-selector-row ${checked ? "is-selected" : ""}`} key={testCase.id}><input type="checkbox" checked={checked} onChange={() => toggleTestCaseSelection(testCase.id)} /><span className="evaluation-selector-check" aria-hidden="true">{checked && <CheckSquare2 size={16} />}</span><span className="evaluation-selector-main"><strong>{testCase.name}</strong><small>{testCase.id} · {testCase.description}</small></span><span className="evaluation-selector-meta"><b>{testCase.target_risk_pattern}</b><span>{testCase.risk_type}</span><small>{testCase.severity} · {testCase.turn_count} TURN</small></span></label>;
        })}
      </div>
      <footer className="evaluation-selector-footer">
        <span className={error ? "is-error" : ""}>{error ?? (isBootstrapping ? tip : `共 ${testCases.length} 条可用 TestCase`)}</span>
        <button type="button" className="evaluation-primary-button" disabled={selectedTestCaseIds.length === 0 || isBootstrapping || isLoadingTestCases} onClick={() => void prepareEvaluation()}>{isBootstrapping ? <LoaderCircle className="evaluation-spin" size={15} /> : <CheckSquare2 size={15} />}{isBootstrapping ? "正在创建" : `创建批量测评 (${selectedTestCaseIds.length})`}</button>
      </footer>
    </section>
  );
}
