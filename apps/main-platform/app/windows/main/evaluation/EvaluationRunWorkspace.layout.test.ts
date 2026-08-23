import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./EvaluationRunWorkspace.tsx", import.meta.url),
  "utf8",
);
const runSource = source;
const styles = readFileSync(
  new URL("../../../styles/window-3-evaluation.css", import.meta.url),
  "utf8",
);

test("batch runs group TestCase progress and terminal into the desktop split workspace", () => {
  assert.match(
    source,
    /evaluation-batch-run-body[\s\S]*?<BatchProgressPanel[\s\S]*?<EvaluationTerminal emptyTip=\{statusTip\} events=\{renderedEvents\} \/>/,
  );
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
  assert.match(runSource, /activeInference/);
  assert.doesNotMatch(runSource, /evaluation-run-status/);
});

test("run workspace keeps selecting and running views inside one animated shell", () => {
  assert.match(
    source,
    /className="evaluation-run-view-shell"[\s\S]*?\{renderedView === "selecting" \? <TestCaseSelector \/> :/,
  );
  assert.match(source, /const viewMode = run \? "running" : "selecting";/);
  assert.match(source, /useGSAP\(/);
  assert.match(source, /setRenderedView\(viewMode\)/);
});

test("run workspace anchors inference status inside the page header", () => {
  assert.match(
    source,
    /<header className="evaluation-page-header">[\s\S]*?<EvaluationInferenceStatus \/>[\s\S]*?<\/header>/,
  );
  assert.doesNotMatch(
    source,
    /<\/header>\s*\{run && activeInference && <EvaluationInferenceStatus \/>\}/,
  );
  assert.match(styles, /\.evaluation-page-header \{[^}]*position: relative;/);
  assert.match(styles, /\.evaluation-page-header \.evaluation-inference-status \{[^}]*position: absolute;/);
  assert.match(styles, /width: min\(50%, 560px\)/);
  assert.match(
    styles,
    /@container evaluation-page \(max-width: 560px\)[\s\S]*?\.evaluation-page-header \.evaluation-inference-status \{[^}]*width: calc\(100% - 20px\);/,
  );
});
