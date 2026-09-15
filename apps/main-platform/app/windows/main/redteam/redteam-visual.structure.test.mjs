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
const visualizations = readFileSync(
  new URL("./RedTeamVisualizations.tsx", import.meta.url),
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

test("report visualizations use ECharts with stable chart containers", () => {
  assert.match(workspace, /RedTeamVisualizations/);
  assert.match(styles, /rt-chart-canvas/);
  assert.doesNotMatch(workspace, /pathLength|strokeDashoffset|rt-viz-/);
  assert.match(visualizations, /type ChartVariant = "strategy" \| "round" \| "defense" \| "weight"/);
  assert.match(visualizations, /rt-chart-\$\{variant\}/);
  assert.match(visualizations, /outerBoundsMode:\s*"same"/);
  assert.match(visualizations, /outerBoundsContain:\s*"axisLabel"/);
  assert.match(visualizations, /escapeHtml/);
  assert.match(visualizations, /fontFamily:\s*FONT_FAMILY/);
  assert.match(visualizations, /dispose\(\)/);
  assert.match(visualizations, /resize\(\{ silent: true \}\)/);
  assert.match(styles, /grid-template-areas:/);
  assert.match(styles, /\.rt-chart-strategy\s*\{[^}]*grid-area:\s*strategy/s);
  assert.match(styles, /\.rt-chart-round\s*\{[^}]*grid-area:\s*round/s);
  assert.match(styles, /\.rt-chart-defense\s*\{[^}]*grid-area:\s*defense/s);
  assert.match(styles, /\.rt-chart-weight\s*\{[^}]*grid-area:\s*weight/s);
  assert.doesNotMatch(styles, /\.rt-chart-canvas\s*\{[^}]*height:\s*190px/s);
});

test("report chart options expose units and the defense chart uses result bars", () => {
  assert.match(visualizations, /name:\s*"最终权重"/);
  assert.match(visualizations, /name:\s*"变体数（个）"/);
  assert.match(visualizations, /name:\s*"结果数量（次）"/);
  assert.match(visualizations, /name:\s*"策略权重（0–1）"/);
  assert.match(visualizations, /完成轮次/);
  assert.match(visualizations, /其他结果/);
  assert.doesNotMatch(visualizations, /x1:\s*8,\s*y1:\s*62/);
});

test("round coverage keeps the progress title centered inside a larger ring", () => {
  assert.match(visualizations, /type:\s*"group"/);
  assert.match(visualizations, /bounding:\s*"raw"/);
  assert.match(visualizations, /const ROUND_PROGRESS_CENTER: \[string, string\] = \["18%",\s*"52%"\]/);
  assert.match(visualizations, /center:\s*ROUND_PROGRESS_CENTER/);
  assert.match(visualizations, /left:\s*ROUND_PROGRESS_CENTER\[0\]/);
  assert.match(visualizations, /top:\s*ROUND_PROGRESS_CENTER\[1\]/);
  assert.match(visualizations, /align:\s*"center"/);
  assert.match(visualizations, /verticalAlign:\s*"middle"/);
  assert.match(visualizations, /x:\s*0,\s*y:\s*0/);
  assert.match(visualizations, /rich:\s*\{/);
  assert.match(visualizations, /text:\s*`\{value\|\$\{completedRounds\}/);
  assert.match(visualizations, /radius:\s*\["56%",\s*"68%"\]/);
  assert.match(visualizations, /grid:\s*\{ left:\s*"50%"/);
});

test("strategy labels stay complete and normalized weight ticks remain compact", () => {
  assert.doesNotMatch(visualizations, /overflow:\s*"truncate"/);
  assert.match(visualizations, /const formatWeightTick/);
  assert.match(visualizations, /formatter:\s*formatWeightTick/);
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

test("global errors use a dismissible header overlay and the terminal keeps the project font", () => {
  assert.match(workspace, /redteam-error-overlay/);
  assert.match(workspace, /role="status" aria-live="polite"/);
  assert.match(workspace, /关闭错误提示/);
  assert.match(styles, /\.redteam-header\s*\{[^}]*position:\s*relative;/s);
  assert.match(styles, /\.redteam-error-overlay\s*\{[^}]*position:\s*absolute;/s);
  assert.doesNotMatch(styles, /redteam-event-line time[^}]*ui-monospace/s);
  assert.match(styles, /\.redteam-event-line time\s*\{[^}]*font-family:\s*var\(--main-body-font\)/s);
});
