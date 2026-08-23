import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const evaluationStyles = readFileSync(
  new URL("../../../styles/window-3-evaluation.css", import.meta.url),
  "utf8",
);

test("backend trace eyebrow uses a bright blue on the dark terminal", () => {
  assert.match(
    evaluationStyles,
    /\.evaluation-terminal-panel \.evaluation-panel-header \.evaluation-eyebrow \{[^}]*color: #9eafff;/s,
  );
});
