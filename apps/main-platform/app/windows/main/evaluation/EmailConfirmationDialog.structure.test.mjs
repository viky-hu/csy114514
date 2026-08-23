import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

const dialogSource = readFileSync(
  new URL("./EmailConfirmationDialog.tsx", import.meta.url),
  "utf8",
);

const evaluationStyles = readFileSync(
  new URL("../../../styles/window-3-evaluation.css", import.meta.url),
  "utf8",
);

test("confirmation decisions wait for the exit state and clean up its timer", () => {
  assert.match(dialogSource, /isExiting/);
  assert.match(dialogSource, /evaluation-confirmation-backdrop.*is-exiting/);
  assert.match(dialogSource, /window\.setTimeout/);
  assert.match(dialogSource, /clearTimeout/);
  assert.match(dialogSource, /if \(!confirmation \|\| isExitingRef\.current\) return/);
});

test("confirmation styles keep allow text readable and animate entry and exit", () => {
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-allow \{[^}]*background: transparent;[^}]*color: var\(--evaluation-ink, #111622\);/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-allow \{[^}]*border: 1px solid transparent;[^}]*background: transparent;/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-allow:hover[^}]*background: var\(--evaluation-blue, var\(--main-blue, #3152f4\)\);[^}]*color: white;/s,
  );
  assert.match(evaluationStyles, /evaluation-confirmation-backdrop-in/);
  assert.match(evaluationStyles, /evaluation-confirmation-backdrop-out/);
  assert.match(evaluationStyles, /evaluation-confirmation-dialog-in/);
  assert.match(evaluationStyles, /evaluation-confirmation-dialog-out/);
  assert.match(evaluationStyles, /prefers-reduced-motion: reduce/);
});

test("confirmation colors remain valid outside the evaluation-page variable scope", () => {
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-dialog \{[^}]*border-top: 2px solid var\(--evaluation-blue, var\(--main-blue, #3152f4\)\);/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-allow:hover[^}]*background: var\(--evaluation-blue, var\(--main-blue, #3152f4\)\);/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-allow \{[^}]*color: var\(--evaluation-ink, #111622\);/s,
  );
});

test("confirmation secondary and close actions share the allow button contrast treatment", () => {
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-dialog \.evaluation-secondary-button \{[^}]*background: transparent;[^}]*color: var\(--evaluation-ink, #111622\);/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-dialog \.evaluation-secondary-button:hover[^}]*background: var\(--evaluation-blue, var\(--main-blue, #3152f4\)\);[^}]*color: white;/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-dialog \.evaluation-icon-command \{[^}]*background: transparent;[^}]*color: var\(--evaluation-ink, #111622\);/s,
  );
  assert.match(
    evaluationStyles,
    /\.evaluation-confirmation-dialog \.evaluation-icon-command:hover[^}]*background: var\(--evaluation-blue, var\(--main-blue, #3152f4\)\);[^}]*color: white;/s,
  );
});
