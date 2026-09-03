import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const profileDir = new URL("./", import.meta.url);
const read = (file) => readFileSync(new URL(file, profileDir), "utf8");
const styles = readFileSync(
  new URL("../../../styles/window-3-main.css", profileDir),
  "utf8",
);

test("defense flow is an independent eight-node SVG in display order", () => {
  const source = read("DefenseFlow.tsx");

  assert.match(source, /<svg/);
  assert.equal((source.match(/data-defense-flow-node/g) ?? []).length, 1);
  assert.match(source, /DEFENSE_DISPLAY_LAYERS\.map/);
  assert.match(source, /selectedDisplayIndex/);
  assert.match(source, /<line/);
  assert.match(source, /<circle/);
  assert.match(source, /security-defense-flow-label/);
  assert.match(source, /security-defense-flow-id/);
  assert.doesNotMatch(source, /preserveAspectRatio="none"/);
  assert.match(source, /preserveAspectRatio="xMidYMid meet"/);
});

test("security profile owns enter, reveal, and return transitions", () => {
  const source = read("SecurityProfileGraph.tsx");

  assert.match(source, /MousePointerClick/);
  assert.match(source, /DefenseVisualizationStage/);
  assert.match(source, /autoAlpha/);
  assert.match(source, /security-profile-profile-screen/);
  assert.match(source, /security-profile-defense-screen/);
  assert.match(source, /security-profile-page-track/);
  assert.doesNotMatch(source, /yPercent/);
  assert.doesNotMatch(styles, /grid-template-rows:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/);
});

test("the visualizer renders one canonical detail and exposes ordered arrow navigation", () => {
  const source = read("DefenseVisualizationStage.tsx");

  assert.match(source, /DEFENSE_DISPLAY_LAYERS/);
  assert.match(source, /getDefenseDisplayIndexFromCanonicalIndex/);
  assert.match(source, /getDefenseCanonicalIndexFromDisplayIndex/);
  assert.match(source, /selectedDisplayIndex/);
  assert.match(source, /ChevronLeft/);
  assert.match(source, /ChevronRight/);
  assert.match(source, /security-defense-step-button/);
  assert.match(source, /disabled={!canGoPrevious}/);
  assert.match(source, /disabled={!canGoNext}/);
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /key={activeLayer\.id}/);
  assert.doesNotMatch(source, /DefenseOptionWheel|DEFENSE_WHEEL|getDefenseWheel|security-defense-wheel/);
  assert.doesNotMatch(source, /DEFENSE_LAYERS\.map/);
});

test("the defense workspace uses a centered three-column stage with no wheel column", () => {
  const source = read("DefenseVisualizationStage.tsx");
  const workspace = styles.slice(
    styles.indexOf(".security-defense-workspace {"),
    styles.indexOf(".security-defense-step-button {"),
  );
  const placeholder = styles.slice(
    styles.indexOf(".security-defense-placeholder {"),
    styles.indexOf(".security-defense-placeholder-code {"),
  );

  assert.match(source, /className="security-defense-workspace"/);
  assert.match(workspace, /grid-template-columns: 56px minmax\(0, 1fr\) 56px/);
  assert.match(styles, /grid-template-columns: 48px minmax\(0, 1fr\) 48px/);
  assert.match(styles, /\.security-defense-step-button[\s\S]*min-width: 44px/);
  assert.match(styles, /\.security-defense-step-button[\s\S]*min-height: 44px/);
  assert.match(styles, /linear-gradient\(180deg/);
  assert.match(styles, /border-radius: 6px/);
  assert.doesNotMatch(styles, /\.security-defense-wheel-column|\.security-defense-wheel\s*\{/);
  assert.doesNotMatch(placeholder, /visibility: hidden|pointer-events: none/);
});

test("D1 restores its dedicated input-filter visualization chain", () => {
  const stage = read("DefenseVisualizationStage.tsx");
  const panel = read("D1InputFilterPanel.tsx");
  const sourceViewer = read("D1SourceViewer.tsx");
  const microscope = read("D1SanitizationMicroscope.tsx");
  const data = read("d1-input-filter-visualization-data.ts");

  assert.match(stage, /D1InputFilterPanel/);
  assert.match(panel, /D1FilterTransferArrow/);
  assert.match(panel, /D1SourceViewer/);
  assert.match(panel, /D1SanitizationMicroscope/);
  assert.match(sourceViewer, /createHighlighterCore/);
  assert.match(sourceViewer, /input_filter\.py/);
  assert.match(microscope, /d1-rule-list/);
  assert.match(microscope, /D1_RULES\.map/);
  assert.doesNotMatch(microscope, /d1-microscope-heading|D1 检测规则|处理规则/);
  assert.doesNotMatch(microscope, /<strong/);
  assert.doesNotMatch(microscope, /Pause|Play|RotateCcw|setInterval|playing/);
  assert.match(data, /zero-width/);
  assert.match(data, /unicodedata\.normalize/);
  assert.match(data, /REDACTED-BASE64/);
  assert.match(data, /HTML_STRIP_PATTERNS/);
  assert.match(data, /INJECTION_PATTERNS/);
  assert.doesNotMatch(sourceViewer, /完整文件|可滚动|backend[\\/]/);
});

test("D1 remains a fixed two-column detail with source-only scrolling", () => {
  const d1Styles = styles.slice(
    styles.indexOf(".d1-input-filter-panel"),
    styles.indexOf(".security-defense-flow,"),
  );

  assert.match(d1Styles, /overflow-y: hidden/);
  assert.match(d1Styles, /grid-template-rows: clamp\(132px, 31%, 154px\) minmax\(0, 1fr\)/);
  assert.match(d1Styles, /\.d1-comparison-grid[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(d1Styles, /\.d1-input-filter-lower[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(d1Styles, /\.d1-source-code[^}]*overflow: auto/);
  assert.match(d1Styles, /\.d1-rule-entry[^}]*min-height: 44px/);
  assert.doesNotMatch(d1Styles, /\.d1-rule-list[^}]*overflow:\s*(auto|scroll)/);
});
