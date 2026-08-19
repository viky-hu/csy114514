import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

const selectorSource = readFileSync(
  new URL("./TestCaseSelector.tsx", import.meta.url),
  "utf8",
);

const providerSource = readFileSync(
  new URL("./EvaluationWorkspaceProvider.tsx", import.meta.url),
  "utf8",
);

const evaluationStyles = readFileSync(
  new URL("../../../styles/window-3-evaluation.css", import.meta.url),
  "utf8",
);

test("checkbox selection delegates each toggle to the provider's current state", () => {
  assert.match(
    providerSource,
    /toggleTestCaseSelection:\s*\(testCaseId:\s*string\)\s*=>\s*void;/,
  );
  assert.match(
    providerSource,
    /const toggleTestCaseSelection = useCallback\(\(testCaseId:\s*string\) => \{\s*setState\(\(current\) => \(\{[\s\S]*selectedTestCaseIds:\s*toggleTestCaseSelectionIds\(current\.selectedTestCaseIds,\s*testCaseId\)/,
  );
  assert.match(
    selectorSource,
    /onChange=\{\(\) => toggleTestCaseSelection\(testCase\.id\)\}/,
  );
});

test("selector checkbox stays within its row and selected decoration does not change layout", () => {
  assert.match(
    evaluationStyles,
    /\.evaluation-selector-row\s*\{[^}]*position:\s*relative;/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-selector-row > input\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0 auto auto 0;[^}]*width:\s*1px;[^}]*height:\s*1px;[^}]*margin:\s*0;/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-selector-row\.is-selected\s*\{[^}]*box-shadow:\s*inset 2px 0 0 var\(--evaluation-blue\);[^}]*\}/s,
  );
  assert.doesNotMatch(
    evaluationStyles,
    /\.evaluation-selector-row\.is-selected\s*\{[^}]*\b(?:margin|grid-template-columns|position)\s*:/s,
  );
});
