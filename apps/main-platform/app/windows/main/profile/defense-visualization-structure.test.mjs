import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const profileDir = new URL("./", import.meta.url);
const read = (file) => readFileSync(new URL(file, profileDir), "utf8");
const styles = readFileSync(
  new URL("../../../styles/window-3-main.css", profileDir),
  "utf8",
);

test("defense visualization keeps the supplied wheel interaction surface", () => {
  const source = read("DefenseOptionWheel.tsx");

  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /onWheel|wheel/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /ArrowUp|ArrowDown/);
  assert.match(source, /resolveDefenseWheelTarget/);
  assert.match(source, /resolveDefenseWheelLoopTarget/);
  assert.match(source, /commitPosition/);

  const pointerMove = source.slice(
    source.indexOf("const handlePointerMove"),
    source.indexOf("const handlePointerEnd"),
  );
  assert.doesNotMatch(pointerMove, /notifySelection|onChange/);

  const pointerEnd = source.slice(
    source.indexOf("const handlePointerEnd"),
    source.indexOf("const handleItemClick"),
  );
  assert.match(pointerEnd, /dragMovedRef\.current/);
  assert.match(pointerEnd, /commitPosition/);
});

test("wheel release commits the nearest center option and preserves the smooth return", () => {
  const source = read("DefenseOptionWheel.tsx");
  const commit = source.slice(
    source.indexOf("const commitPosition"),
    source.indexOf("useEffect(() =>", source.indexOf("const commitPosition")),
  );
  const controlledSync = source.slice(
    source.indexOf("if (selectedIndexProp === undefined"),
    source.indexOf("const handleWheel"),
  );

  assert.match(commit, /Math\.round\(targetPositionRef\.current\)/);
  assert.match(commit, /resolveDefenseWheelTarget|resolveDefenseWheelSelection/);
  assert.match(commit, /requestPosition|startLoop/);
  assert.doesNotMatch(controlledSync, /positionRef\.current\s*=\s*nextIndex/);
  assert.doesNotMatch(controlledSync, /renderPosition\(nextIndex\)/);
});

test("controlled loop updates do not reset a wrapped position to its business index", () => {
  const source = read("DefenseOptionWheel.tsx");

  assert.doesNotMatch(
    source,
    /requestPosition\(selectedIndexRef\.current, false\)/,
  );
});

test("defense flow is an independent eight-node SVG", () => {
  const source = read("DefenseFlow.tsx");

  assert.match(source, /<svg/);
  assert.equal((source.match(/data-defense-flow-node/g) ?? []).length, 1);
  assert.match(source, /DEFENSE_LAYERS\.map/);
  assert.match(source, /<line/);
  assert.match(source, /<circle/);
  assert.doesNotMatch(source, /preserveAspectRatio=\"none\"/);
  assert.match(source, /preserveAspectRatio=\"xMidYMid meet\"/);
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

test("the visualizer reserves one independent placeholder for every layer", () => {
  const source = read("DefenseVisualizationStage.tsx");

  assert.match(source, /DEFENSE_LAYERS\.map/);
  assert.match(source, /security-defense-placeholder/);
  assert.match(source, /onReturn/);
  assert.match(source, /loop\s*\n/);
  assert.ok(
    source.indexOf('<div className="security-defense-region">') <
      source.indexOf('className="security-defense-return"'),
    "return control should be positioned inside the outer defense region",
  );
});

test("D1 restores its dedicated input-filter visualization chain", () => {
  const stage = read("DefenseVisualizationStage.tsx");
  const panel = read("D1InputFilterPanel.tsx");
  const sourceViewer = read("D1SourceViewer.tsx");
  const microscope = read("D1SanitizationMicroscope.tsx");
  const data = read("d1-input-filter-visualization-data.ts");

  assert.match(stage, /D1InputFilterPanel/);
  assert.match(panel, /D1FilterTransferArrow/);
  assert.match(panel, /d1-filter-arrow/);
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

test("keeps wheel display order separate from canonical flow state", () => {
  const source = read("DefenseVisualizationStage.tsx");

  assert.match(source, /DEFENSE_WHEEL_LAYERS/);
  assert.match(source, /getDefenseWheelIndex/);
  assert.match(source, /getDefenseCanonicalIndexFromWheelIndex/);
  assert.match(source, /items=\{DEFENSE_WHEEL_LAYERS\}/);
  assert.match(source, /selectedIndex=\{selectedWheelIndex\}/);
  assert.match(source, /onChange=\{\(wheelIndex\)/);
  assert.match(source, /<DefenseFlow selectedIndex=\{selectedIndex\}/);
  assert.match(source, /DEFENSE_LAYERS\.map/);
});

test("the defense workspace uses open whitespace inside the outer region", () => {
  const wheelColumn = styles.slice(
    styles.indexOf(".security-defense-wheel-column"),
    styles.indexOf(".security-defense-wheel {"),
  );
  const content = styles.slice(
    styles.indexOf(".security-defense-content"),
    styles.indexOf(".security-defense-placeholder"),
  );

  assert.doesNotMatch(wheelColumn, /border-right/);
  assert.doesNotMatch(content, /border:|background/);
  assert.match(styles, /grid-template-columns: 154px minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-columns: 154px minmax\(0, 1fr\);\s*gap: 0/);

  const region = styles.slice(
    styles.indexOf("\n.security-defense-region {") + 1,
    styles.indexOf("\n.security-defense-screen.is-revealed .security-defense-region"),
  );
  const flow = styles.slice(
    styles.indexOf("\n.security-defense-flow {") + 1,
    styles.indexOf("\n.security-defense-flow-segment"),
  );
  const returnControl = styles.slice(
    styles.lastIndexOf("\n.security-defense-return {") + 1,
    styles.indexOf("\n.security-defense-screen.is-revealed .security-defense-return"),
  );

  assert.match(region, /position: relative;/);
  assert.match(region, /border:\s*1px solid/);
  assert.doesNotMatch(region, /border-block/);
  assert.doesNotMatch(region, /background/);
  assert.match(flow, /width: min\(100%, 1180px\);/);
  assert.match(flow, /justify-self: center;/);
  assert.match(returnControl, /top: 12px;[\s\S]*left: 12px;/);
});

test("D1 renders a direct comparison, semantic light code reader, and mapped rule list", () => {
  const panel = read("D1InputFilterPanel.tsx");
  const sourceViewer = read("D1SourceViewer.tsx");
  const microscope = read("D1SanitizationMicroscope.tsx");
  const data = read("d1-input-filter-visualization-data.ts");

  assert.match(panel, /d1-input-filter-comparison/);
  assert.match(panel, /D1_UNTRUSTED_CONTENT/);
  assert.match(panel, /D1_SANITIZED_CONTENT/);
  assert.match(panel, /D1SourceViewer/);
  assert.match(panel, /D1SanitizationMicroscope/);
  assert.match(panel, /D1FilterTransferArrow/);
  assert.doesNotMatch(panel, /交给模型前先经过五道净化/);

  assert.match(sourceViewer, /<pre/);
  assert.match(sourceViewer, /<code/);
  assert.match(sourceViewer, /data-source-line/);
  assert.match(sourceViewer, /INPUT_FILTER_SOURCE/);
  assert.match(microscope, /D1_RULES\.map/);
  assert.match(microscope, /d1-rule-list/);
  assert.doesNotMatch(microscope, /d1-microscope-heading|D1 检测规则|处理规则/);
  assert.doesNotMatch(microscope, /<strong/);
  assert.doesNotMatch(microscope, /d1-microscope-controls/);
  assert.match(data, /D1_FILTER_INPUT_META/);
  assert.match(data, /D1_FILTER_OUTPUT_META/);
  assert.match(data, /D1_RULES/);

  const d1Styles = styles.slice(
    styles.indexOf(".d1-input-filter-panel"),
    styles.indexOf(".security-defense-flow,"),
  );
  assert.match(d1Styles, /overflow-y: hidden/);
  assert.match(d1Styles, /grid-template-rows: clamp\(142px, 35%, 168px\) minmax\(0, 1fr\)/);
  assert.match(d1Styles, /\.d1-comparison-grid[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(d1Styles, /\.d1-comparison-grid[^}]*position: relative/);
  assert.match(d1Styles, /\.d1-input-filter-lower[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(d1Styles, /\.d1-filter-arrow[^}]*position: absolute/);
  assert.match(d1Styles, /\.d1-filter-arrow[^}]*pointer-events: none/);
  assert.match(d1Styles, /\.d1-source-code[^}]*overflow: auto/);
  assert.match(d1Styles, /background: color-mix\(in srgb, var\(--main-surface\) 78%, white\)/);
  assert.match(d1Styles, /\.d1-rule-list[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(d1Styles, /\.d1-rule-list[^}]*grid-template-rows: repeat\(5, minmax\(42px, 1fr\)\)/);
  assert.match(d1Styles, /\.d1-rule-entry[^}]*min-height: 42px/);
  assert.match(d1Styles, /\.d1-rule-label/);
  assert.doesNotMatch(d1Styles, /\.d1-rule-copy strong/);
  assert.doesNotMatch(d1Styles, /\.d1-microscope-heading/);
  assert.doesNotMatch(d1Styles, /background: #111622/);
  assert.doesNotMatch(d1Styles, /background: #f7faff/);
  assert.doesNotMatch(d1Styles, /color: #d7deee/);
  assert.match(d1Styles, /text-align: left/);
  assert.match(d1Styles, /\.security-defense-placeholder\.is-d1\[aria-hidden="false"\][\s\S]*overflow: hidden/);
});
