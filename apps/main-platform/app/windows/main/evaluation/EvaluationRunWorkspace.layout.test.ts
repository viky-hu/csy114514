import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./EvaluationRunWorkspace.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../../styles/window-3-evaluation.css", import.meta.url),
  "utf8",
);

test("batch runs group TestCase progress and terminal into the desktop split workspace", () => {
  assert.match(
    source,
    /<div className="evaluation-batch-run-body">\s*<BatchProgressPanel[\s\S]*?<EvaluationTerminal emptyTip=\{statusTip\} events=\{events\} \/>\s*<\/div>/,
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
    /const \{ run, activeStage, events, isStarting, isBootstrapping, error, retryEvaluation, resetEvaluationSelection \} = useEvaluationWorkspace\(\);/,
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
