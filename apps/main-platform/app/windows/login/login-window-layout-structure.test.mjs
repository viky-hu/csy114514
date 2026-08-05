import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

const loginStyles = readFileSync(
  new URL("../../styles/window-1-login.css", import.meta.url),
  "utf8",
);
const loginSource = readFileSync(
  new URL("./LoginIntroWindow.tsx", import.meta.url),
  "utf8",
);

test("login placeholder root keeps the original parent-relative width", () => {
  const rootBlock = loginStyles.match(/\.login-placeholder-page\s*\{(?<body>[^}]*)\}/);

  assert.ok(rootBlock?.groups?.body);
  assert.match(rootBlock.groups.body, /width:\s*100%;/);
  assert.doesNotMatch(rootBlock.groups.body, /width:\s*100vw;/);
});

test("login color band and panel keep a generous target width", () => {
  assert.match(loginSource, /const panelWidthInPx = 11 \* \(96 \/ 2\.54\);/);
  assert.match(loginSource, /window\.innerWidth \* 0\.074,\s*72\),\s*122\)/);
  assert.doesNotMatch(loginSource, /const panelWidthInPx = 10 \* \(96 \/ 2\.54\);/);
  assert.doesNotMatch(loginSource, /const panelWidthInPx = 12 \* \(96 \/ 2\.54\);/);
  assert.doesNotMatch(loginSource, /window\.innerWidth \* 0\.1,\s*96\),\s*168\)/);
});
