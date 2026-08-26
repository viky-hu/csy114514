import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

const buttonSource = readFileSync(
  new URL("./MainSidebarToggleButton.tsx", import.meta.url),
  "utf8",
);

const mainWindowSource = readFileSync(
  new URL("./MainWindow.tsx", import.meta.url),
  "utf8",
);

const sidebarSource = readFileSync(
  new URL("./MainLineSidebar.tsx", import.meta.url),
  "utf8",
);

test("sidebar toggle is an independent accessible SVG control", () => {
  assert.match(buttonSource, /export type MainSidebarToggleButtonProps = \{/);
  assert.match(buttonSource, /controlsId: string;/);
  assert.match(buttonSource, /isCollapsed: boolean;/);
  assert.match(buttonSource, /onToggle: \(\) => void;/);
  assert.match(buttonSource, /aria-controls=\{controlsId\}/);
  assert.match(buttonSource, /aria-expanded=\{!isCollapsed\}/);
  assert.match(buttonSource, /aria-label=\{label\}/);
  assert.match(buttonSource, /type="button"/);
  assert.match(buttonSource, /className="main-sidebar-toggle-svg"/);
  assert.match(buttonSource, /className="main-sidebar-toggle-icon"/);
  assert.match(buttonSource, /viewBox="0 0 44 44"/);
  assert.match(buttonSource, /className="main-sidebar-toggle-ring"/);
  assert.doesNotMatch(buttonSource, /main-sidebar-toggle-coil/);
  assert.doesNotMatch(buttonSource, /M30 14v16/);
  assert.doesNotMatch(buttonSource, /MainLineSidebar/);
});

test("sidebar toggle remains outside the sidebar implementation boundary", () => {
  assert.match(mainWindowSource, /<MainLineSidebar[\s\S]*?\/>/);
  assert.match(mainWindowSource, /<MainSidebarToggleButton[\s\S]*?\/>/);
  assert.ok(
    mainWindowSource.indexOf("<MainSidebarToggleButton") >
      mainWindowSource.indexOf("<MainLineSidebar"),
  );
  assert.doesNotMatch(sidebarSource, /MainSidebarToggleButton/);
});
