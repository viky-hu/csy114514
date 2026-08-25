import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./EvaluationRunWorkspace.tsx", import.meta.url),
  "utf8",
);
const runSource = source;
const providerSource = readFileSync(
  new URL("./EvaluationWorkspaceProvider.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../styles/window-3-evaluation.css", import.meta.url),
  "utf8",
);

test("batch runs group TestCase progress and terminal into the desktop split workspace", () => {
  assert.match(
    source,
    /evaluation-batch-run-body[\s\S]*?<BatchProgressPanel[\s\S]*?<EvaluationTerminal events=\{renderedEvents\} \/>/,
  );
});

test("comparison run keeps live side modules and moves controls to one global action group", () => {
  const comparisonRun = readFileSync(
    new URL("./EvaluationComparisonRunWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const comparisonReport = readFileSync(
    new URL("./EvaluationComparisonWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const comparisonBadge = readFileSync(
    new URL("./EvaluationComparisonBadge.tsx", import.meta.url),
    "utf8",
  );
  assert.match(comparisonRun, /BatchProgressPanel[\s\S]*showControls=\{false\}/);
  assert.match(comparisonRun, /comparisonEvents\[side\]/);
  assert.doesNotMatch(comparisonRun, /BARE VS DEFENDED · LIVE RUN/);
  assert.doesNotMatch(comparisonRun, /双侧测评运行/);
  assert.doesNotMatch(comparisonRun, /同一组 TestCase 同时进入 Bare 与 Defended 两条独立执行链/);
  assert.doesNotMatch(comparisonRun, /evaluation-comparison-global-actions/);
  assert.doesNotMatch(comparisonRun, /<button/);
  assert.doesNotMatch(comparisonRun, /evaluation-comparison-table/);
  assert.match(source, /evaluation-comparison-global-actions/);
  assert.match(source, /evaluation-comparison-global-actions[\s\S]*EvaluationComparisonBadge/);
  assert.match(source, /EvaluationComparisonBadge/);
  assert.match(comparisonBadge, /Brain/);
  assert.match(comparisonBadge, /ShieldCheck/);
  assert.match(comparisonBadge, /Bare/);
  assert.match(comparisonBadge, /Defended/);
  assert.match(comparisonBadge, /evaluation-comparison-badge/);
  assert.match(source, /对比报告/);
  assert.match(comparisonReport, /comparison-report-summary/);
  assert.match(comparisonReport, /evaluation-comparison-rate-rings/);
  assert.match(comparisonReport, /evaluation-comparison-transition-grid/);
  assert.match(comparisonReport, /evaluation-comparison-pattern-grid/);
  assert.match(comparisonReport, /evaluation-comparison-ledger/);
  assert.match(comparisonReport, /评审结论/);
  assert.doesNotMatch(comparisonReport, /evaluation-comparison-table/);
  assert.doesNotMatch(comparisonReport, /开始测评/);
  assert.match(
    styles,
    /\.evaluation-comparison-run-grid \{[^}]*display: grid;[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/,
  );
  assert.match(
    styles,
    /@container evaluation-page \(max-width: 920px\)[\s\S]*?\.evaluation-comparison-run-grid \{ grid-template-columns: minmax\(0, 1fr\);/,
  );
  assert.match(
    styles,
    /\.evaluation-comparison-run-workspace \{[^}]*height: 100%;/,
  );
  assert.match(
    styles,
    /\.evaluation-comparison-run-content \{[^}]*height: 100%;/,
  );
  assert.match(
    styles,
    /\.evaluation-comparison-run-grid \{[^}]*height: 100%;/,
  );
  assert.match(
    styles,
    /\.evaluation-comparison-run-group \{[^}]*height: 100%;/,
  );
  assert.match(styles, /\.evaluation-comparison-badge/);
});

test("comparison header places global actions to the left of the mode badge", () => {
  assert.match(
    styles,
    /\.evaluation-run-header-actions\.is-comparison \{[^}]*display: flex;[^}]*align-items: center;[^}]*justify-content: flex-end;[^}]*gap: 12px;/,
  );
  assert.doesNotMatch(
    styles,
    /\.evaluation-run-header-actions\.is-comparison \{[^}]*display: grid;/,
  );
  assert.match(
    source,
    /<div className="evaluation-comparison-global-actions">[\s\S]*?<\/div>\s*<EvaluationComparisonBadge \/>/,
  );
});

test("batch flow keeps the selection entry action and run-page back action", () => {
  const selector = readFileSync(
    new URL("./TestCaseSelector.tsx", import.meta.url),
    "utf8",
  );
  const batchPanel = readFileSync(
    new URL("./BatchProgressPanel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(selector, /开始批量测评/);
  assert.doesNotMatch(selector, /创建批量测评/);
  assert.match(batchPanel, /ArrowLeft/);
  assert.match(batchPanel, /title="返回选择 TestCase"/);
  assert.match(batchPanel, /onClick=\{resetEvaluationSelection\}/);
  assert.match(batchPanel, /isActive \? "批量运行中" : "开始测评"/);
});

test("batch workspace keeps the R4 desktop split and stacks below the compact breakpoint", () => {
  assert.match(
    styles,
    /\.evaluation-batch-run-body \{ display: grid; grid-template-columns: minmax\(0, 62fr\) minmax\(300px, 38fr\);/,
  );
  assert.match(
    styles,
    /@container evaluation-page \(max-width: 920px\)[\s\S]*?\.evaluation-run-body, \.evaluation-batch-run-body \{ grid-template-columns: minmax\(0, 1fr\);/,
  );
});

test("legacy R4 offers TestCase reselection whenever it is not running", () => {
  assert.match(
    source,
    /import \{[^}]*Settings2[^}]*\} from "lucide-react";/,
  );
  assert.match(
    source,
    /run: workspaceRun,[\s\S]*?activeStage: workspaceActiveStage,[\s\S]*?events: workspaceEvents,[\s\S]*?resetEvaluationSelection,/,
  );
  assert.match(
    source,
    /\{!running && <button className="evaluation-icon-command" type="button" title="重新选择 TestCase" aria-label="重新选择 TestCase" onClick=\{resetEvaluationSelection\}><Settings2 size=\{16\} \/><\/button>\}/,
  );
  assert.match(
    source,
    /\{completed \? <button className="evaluation-primary-button"[^>]*>.*查看测评报告.*<\/button> : failed \? <button className="evaluation-primary-button"[^>]*>.*新建测评重试.*<\/button>/,
  );
  assert.match(
    styles,
    /@container evaluation-page \(max-width: 920px\)[\s\S]*?\.evaluation-rail-action \{ grid-column: 1 \/ -1; grid-row: auto; display: flex; align-items: center; justify-content: flex-end; \}/,
  );
});

test("run workspace renders Agent identity without rotating header loading copy", () => {
  assert.match(runSource, /EvaluationAgentBadge/);
  assert.match(runSource, /EvaluationInferenceStatus/);
  assert.match(runSource, /isInferenceRunActive/);
  assert.doesNotMatch(runSource, /evaluation-run-status/);
  assert.doesNotMatch(runSource, /emptyTip|evaluation-terminal-empty/);
});

test("run workspace keeps selecting and running views inside one animated shell", () => {
  assert.match(
    source,
    /className="evaluation-run-view-shell"[\s\S]*?\{renderedView === "selecting" \? <TestCaseSelector \/> :/,
  );
  assert.match(source, /const viewMode = comparison && evaluationMode === "comparison" \? "comparison" : run \? "running" : "selecting";/);
  assert.match(source, /const isComparisonMode = evaluationMode === "comparison";/);
  assert.match(
    source,
    /isComparisonRun \? <ComparisonRunHeaderActions[\s\S]*?isComparisonMode \? <EvaluationComparisonBadge/,
  );
  assert.match(source, /useGSAP\(/);
  assert.match(source, /setRenderedView\(viewMode\)/);
});

test("evaluation view shell preserves selector height for the nested scroll list and fixed footer", () => {
  assert.match(
    styles,
    /\.evaluation-run-view-shell \{ display: grid; height: 100%; min-height: 0; overflow: hidden; \}/,
  );
  assert.match(
    styles,
    /\.evaluation-run-view-content \{ display: grid; grid-template-rows: minmax\(0, 1fr\); height: 100%; min-height: 0; \}/,
  );
  assert.match(
    styles,
    /\.evaluation-selector \{ display: grid; grid-template-rows: auto auto minmax\(0, 1fr\) auto; height: 100%; min-height: 0;/,
  );
  assert.match(styles, /\.evaluation-selector-list \{ min-height: 0; overflow: auto;/);
  assert.match(styles, /\.evaluation-selector-footer \{ display: flex;/);
});

test("run workspace anchors inference status inside the page header", () => {
  assert.match(
    source,
    /<header className="evaluation-page-header">[\s\S]*?<EvaluationInferenceStatus isRunActive=\{isInferenceRunActive\(run\?\.status, isStarting\)\} \/>[\s\S]*?<\/header>/,
  );
  assert.doesNotMatch(
    source,
    /run && activeInference && <EvaluationInferenceStatus/,
  );
  assert.match(source, /isStarting/);
  assert.match(source, /isInferenceRunActive/);
  assert.doesNotMatch(source, /const \{ run, events, activeStage, isBootstrapping, isStarting, error,/);
  assert.match(styles, /\.evaluation-page-header \{[^}]*position: relative;/);
  assert.match(styles, /\.evaluation-page-header \.evaluation-inference-status \{[^}]*position: absolute;/);
  assert.match(styles, /width: min\(42%, 460px\)/);
  assert.match(styles, /background: #fff;/);
  assert.match(styles, /box-shadow: 0 4px 12px rgba\(17, 22, 34, \.08\)/);
  assert.match(styles, /\.evaluation-inference-status\.is-visible/);
  assert.match(styles, /\.evaluation-inference-status\.is-hidden/);
  assert.match(styles, /@keyframes evaluation-inference-status-in/);
  assert.match(styles, /@keyframes evaluation-inference-status-out/);
  assert.doesNotMatch(styles, /\.evaluation-inference-copy strong/);
  const inferenceStatus = readFileSync(new URL("./EvaluationInferenceStatus.tsx", import.meta.url), "utf8");
  assert.match(inferenceStatus, /<span className="evaluation-inference-title">\{meta\.shortLabel\} 推理中…<\/span>/);
  assert.match(inferenceStatus, /<button className="evaluation-inference-dismiss" type="button" title="关闭推理状态" aria-label="关闭推理状态"/);
  assert.match(inferenceStatus, /<X size=\{14\} aria-hidden="true" \/>/);
  assert.doesNotMatch(
    inferenceStatus,
    /推理运行中|等待下一轮推理|<strong>|activeInference|turnLabel|waitedSeconds|isLongWait/,
  );
  assert.doesNotMatch(providerSource, /activeInference|inferenceNow|setInferenceNow|findActiveInference/);
  assert.match(
    styles,
    /@container evaluation-page \(max-width: 560px\)[\s\S]*?\.evaluation-page-header \.evaluation-inference-status \{[^}]*width: calc\(100% - 28px\);/,
  );
  assert.match(styles, /\.evaluation-inference-dismiss \{[^}]*pointer-events: auto;/);
});
