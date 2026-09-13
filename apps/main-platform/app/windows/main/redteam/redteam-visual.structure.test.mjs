import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(
  new URL("../../../styles/window-3-redteam.css", import.meta.url),
  "utf8",
);
const workspace = readFileSync(
  new URL("./RedTeamWorkspace.tsx", import.meta.url),
  "utf8",
);
const running = readFileSync(
  new URL("./redteam-running.ts", import.meta.url),
  "utf8",
);

test("red-team workbench inherits the shell surface and uses compact controls", () => {
  assert.match(styles, /\.redteam-page\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*auto;/s);
  assert.match(styles, /\.redteam-page\s*\{[^}]*background:\s*transparent;/s);
  assert.doesNotMatch(styles, /\.redteam-page\s*\{[^}]*background:\s*var\(--rt-surface\)/s);
  assert.match(styles, /--rt-line:\s*rgba\(17,\s*22,\s*34,\s*\.13\)/);
  assert.match(styles, /\.redteam-primary\s*\{[^}]*min-height:\s*38px;[^}]*background:\s*var\(--rt-blue\);/s);
  assert.match(styles, /\.redteam-ghost\s*\{[^}]*min-height:\s*32px;[^}]*border-radius:\s*3px;/s);
  assert.match(styles, /\.redteam-icon-command\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*3px;/s);
  assert.match(styles, /\.redteam-command-card,[\s\S]*?\.redteam-weight-data\s*\{[^}]*border-radius:\s*0;[^}]*background:\s*rgba\(255,\s*255,\s*255,\s*\.28\);/s);
  assert.match(styles, /\.redteam-header h1\s*\{[^}]*font-size:\s*30px;/s);
  assert.match(styles, /\.redteam-command-card h2\s*\{[^}]*font-size:\s*20px;/s);
  assert.doesNotMatch(styles, /background:\s*#fff[;\s]/i);
  assert.doesNotMatch(styles, /border-radius:\s*999px/);
  assert.doesNotMatch(styles, /#fffaf7|#b8472b|#dc8c2d/i);
});

test("report visualizations retain a flat, inspectable SVG workbench", () => {
  assert.match(styles, /\.redteam-visual-grid\s*\{/);
  assert.match(styles, /\.rt-viz-grid\s*\{[^}]*stroke:/s);
  assert.match(styles, /\.rt-viz-intercept\s*\{[^}]*stroke:/s);
});

test("header actions use an accessible refresh icon and a labelled back control", () => {
  assert.match(workspace, /ArrowLeft/);
  assert.match(workspace, /className="redteam-ghost"/);
  assert.match(workspace, /<ArrowLeft size=\{15\} \/>返回入口/);
  assert.match(workspace, /className="redteam-icon-command" title="刷新历史" aria-label="刷新历史"/);
  assert.match(workspace, /<RefreshCw size=\{15\} \/>/);
});

test("running view uses a fixed shell, four vertical steps, and header report action", () => {
  assert.match(styles, /\.redteam-running\s*\{[^}]*height:\s*100%;[^}]*min-height:\s*0;[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /\.redteam-running-body\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*62fr\)\s+minmax\(300px,\s*38fr\);[^}]*min-height:\s*0;/s);
  assert.match(styles, /\.redteam-step-list\s*\{[^}]*grid-template-columns:\s*1fr;/s);
  assert.match(styles, /\.redteam-step-row\.is-error/);
  assert.match(styles, /\.redteam-event-feed\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(styles, /\.redteam-event-feed-content\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(workspace, /查看运行报告/);
  assert.match(workspace, /className="redteam-primary redteam-header-report"/);
  assert.doesNotMatch(workspace, /activeRun\?\.report_available && <button className="redteam-primary"/);
  assert.match(running, /选取种子/);
  assert.match(running, /生成变体/);
  assert.match(running, /沙箱测评/);
  assert.match(running, /调整权重/);
  assert.match(workspace, /实时事件流/);
});
