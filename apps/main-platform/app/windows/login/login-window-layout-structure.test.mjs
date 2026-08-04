import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

const loginStyles = readFileSync(
  new URL("../../styles/window-1-login.css", import.meta.url),
  "utf8",
);

test("login placeholder root keeps the SVG band pinned to the viewport width", () => {
  const rootBlock = loginStyles.match(/\.login-placeholder-page\s*\{(?<body>[^}]*)\}/);

  assert.ok(rootBlock?.groups?.body);
  assert.match(rootBlock.groups.body, /width:\s*100vw;/);
  assert.doesNotMatch(rootBlock.groups.body, /width:\s*100%;/);
});
