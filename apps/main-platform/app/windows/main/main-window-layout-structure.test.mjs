import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

const mainWindowSource = readFileSync(
  new URL("./MainWindow.tsx", import.meta.url),
  "utf8",
);

const mainStyles = readFileSync(
  new URL("../../styles/window-3-main.css", import.meta.url),
  "utf8",
);

test("main workspace keeps the sidebar boundary tight against the menu body", () => {
  assert.match(mainWindowSource, /SIDEBAR_WIDTH_UNITS = 5\.65/);
  assert.match(mainWindowSource, /SIDEBAR_WIDTH_MIN = 224/);
  assert.match(mainWindowSource, /SIDEBAR_WIDTH_MAX = 252/);
  assert.doesNotMatch(mainWindowSource, /snap\(7 \* cmX\)/);
  assert.doesNotMatch(mainWindowSource, /Math\.max\(snap\(7 \* cmX\), 260\)/);
  assert.match(
    mainWindowSource,
    /sidebarLeft \+ sidebarWidth \+ SIDEBAR_TO_CONTENT_GAP_UNITS \* cmX/,
  );
  assert.doesNotMatch(mainWindowSource, /sidebarLeft \+ sidebarWidth \+ 0\.42 \* cmX/);
});

test("main workspace CSS fallback mirrors the tighter sidebar boundary", () => {
  assert.match(
    mainStyles,
    /--main-sidebar-width:\s*clamp\(224px,\s*16vw,\s*252px\);/,
  );
  assert.match(
    mainStyles,
    /--main-content-left:\s*clamp\(292px,\s*21\.2vw,\s*342px\);/,
  );
  assert.doesNotMatch(mainStyles, /--main-sidebar-width:\s*clamp\(260px,\s*20\.6vw,\s*300px\);/);
  assert.doesNotMatch(mainStyles, /--main-content-left:\s*clamp\(310px,\s*25\.7vw,\s*480px\);/);
});
