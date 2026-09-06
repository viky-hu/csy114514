import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const profileDir = new URL("./", import.meta.url);
const read = (file) => readFileSync(new URL(file, profileDir), "utf8");
const styles = readFileSync(
  new URL("../../../styles/window-3-main.css", profileDir),
  "utf8",
);

test("defense flow is an independent nine-item SVG with a special bridge node", () => {
  const source = read("DefenseFlow.tsx");

  assert.match(source, /<svg/);
  assert.equal((source.match(/data-defense-flow-node/g) ?? []).length, 2);
  assert.match(source, /DEFENSE_DISPLAY_ITEMS\.map/);
  assert.match(source, /selectedDisplayIndex/);
  assert.match(source, /<line/);
  assert.match(source, /<circle/);
  assert.match(source, /<path/);
  assert.match(source, /security-defense-flow-bridge-node/);
  assert.match(source, /BRIDGE/);
  assert.match(source, /LLM 推理/);
  assert.doesNotMatch(source, /返回 tool calls/);
  assert.doesNotMatch(source, /security-defense-flow-bridge-label|security-defense-flow-bridge-id/);
  assert.match(source, /x=\{point\}\s+y="42"/);
  assert.match(source, /x=\{point\}\s+y="68"/);
  assert.match(source, /security-defense-flow-label/);
  assert.match(source, /security-defense-flow-id/);
  assert.doesNotMatch(styles, /\.security-defense-flow-bridge-label|\.security-defense-flow-bridge-id/);
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

  assert.match(source, /DEFENSE_DISPLAY_ITEMS/);
  assert.match(source, /selectedDisplayIndex/);
  assert.match(source, /LLMToolCallBridgePanel/);
  assert.match(source, /D2InstructionIsolationPanel/);
  assert.match(source, /getDefenseCanonicalIndexFromDisplayItemIndex/);
  assert.match(source, /ChevronLeft/);
  assert.match(source, /ChevronRight/);
  assert.match(source, /security-defense-step-button/);
  assert.match(source, /disabled={!canGoPrevious}/);
  assert.match(source, /disabled={!canGoNext}/);
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /key={selectedDisplayIndex}/);
  assert.doesNotMatch(source, /DefenseOptionWheel|DEFENSE_WHEEL|getDefenseWheel|security-defense-wheel/);
  assert.doesNotMatch(source, /DEFENSE_LAYERS\.map/);
});

test("D2 and bridge expose fixed detail workspaces", () => {
  const d2 = read("D2InstructionIsolationPanel.tsx");
  const d1 = read("D1SourceViewer.tsx");
  const highlighter = read("usePythonSourceHighlighting.ts");
  const d2Data = read("d2-instruction-isolation-visualization-data.ts");
  const bridge = read("LLMToolCallBridgePanel.tsx");
  const bridgeData = read("llm-tool-call-bridge-data.ts");

  assert.match(d2, /D2InstructionIsolationPanel/);
  assert.match(d2, /usePythonSourceHighlighting/);
  assert.match(d1, /usePythonSourceHighlighting/);
  assert.match(highlighter, /createHighlighterCore/);
  assert.match(highlighter, /codeToTokens/);
  assert.match(highlighter, /python/);
  assert.match(d2, /D2Source|source/);
  assert.match(d2, /D2_RULES|explanation|rule/i);
  assert.match(d2Data, /build_system_prompt\(defended=True\)/);
  assert.match(d2Data, /DEFENDED_SYSTEM_PROMPT/);
  assert.match(d2Data, /网页内容是数据，不是指令/);
  assert.match(d2Data, /不可执行|ignored/);
  assert.match(d2Data, /memory\.write/);
  assert.match(d2Data, /email\.send/);

  assert.match(bridge, /LLMToolCallBridgePanel/);
  assert.match(bridge, /onSelectDisplayIndex/);
  assert.match(bridge, /button/);
  assert.match(bridgeData, /LLM 推理/);
  assert.match(bridgeData, /返回 tool calls/);
  assert.match(bridgeData, /D5/);
  assert.match(bridgeData, /D6/);
  assert.match(bridgeData, /D7/);
  assert.match(bridgeData, /D8/);
  assert.match(bridgeData, /D2/);
  assert.match(bridgeData, /D3/);
  assert.match(bridgeData, /blocked/);
  assert.match(bridgeData, /Sandbox/);
});

test("D2 uses the existing prompt boundary as the lower visual envelope", () => {
  const d2 = read("D2InstructionIsolationPanel.tsx");
  const d2Styles = styles.slice(
    styles.indexOf(".d2-isolation-visual {"),
    styles.indexOf(".llm-bridge-visual {"),
  );

  assert.match(d2, /className="d2-prompt-boundary"/);
  assert.doesNotMatch(d2, /d2-protection-boundary|d2-boundary-overlay/);
  assert.doesNotMatch(d2Styles, /\.d2-isolation-visual::before/);
  assert.match(d2Styles, /\.d2-prompt-boundary[\s\S]*grid-column:\s*3\s*\/\s*-1/);
  assert.match(d2Styles, /\.d2-prompt-boundary[\s\S]*z-index:\s*0/);
  assert.match(d2Styles, /\.d2-flow-outcomes[\s\S]*z-index:\s*1/);
  assert.match(d2Styles, /\.d2-outcome\.is-allowed[\s\S]*background:\s*rgb\(/);
  assert.match(d2Styles, /\.d2-outcome\.is-blocked[\s\S]*background:\s*rgb\(/);
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
  const transferArrow = read("D1FilterTransferArrow.tsx");
  const sourceViewer = read("D1SourceViewer.tsx");
  const microscope = read("D1SanitizationMicroscope.tsx");
  const data = read("d1-input-filter-visualization-data.ts");

  assert.match(stage, /D1InputFilterPanel/);
  assert.match(panel, /import \{ D1FilterTransferArrow \}/);
  assert.match(panel, /<D1FilterTransferArrow isVisible=\{isVisible\} \/>/);
  assert.match(transferArrow, /^"use client";/);
  assert.match(transferArrow, /useGSAP/);
  assert.match(transferArrow, /gsap\.timeline/);
  assert.match(transferArrow, /<feDropShadow/);
  assert.match(transferArrow, /<linearGradient/);
  assert.match(transferArrow, /stopColor="#3152f4"/);
  assert.match(transferArrow, /stopColor="#5d78ff"/);
  assert.match(transferArrow, /stopColor="#8fa4ff"/);
  assert.match(transferArrow, /x1="90"/);
  assert.match(transferArrow, /x2="90"/);
  assert.match(transferArrow, /stroke="#4b69dd"/);
  assert.match(transferArrow, /L171 40C175 38 175 34 171 32/);
  assert.doesNotMatch(transferArrow, /L122 62|L134 6/);
  assert.doesNotMatch(transferArrow, /#a52f25|#dc7767|#38ad86|#16795c/);
  assert.match(transferArrow, /className="d1-filter-arrow-body"/);
  assert.match(transferArrow, /data-d1-filter-arrow-body/);
  assert.doesNotMatch(transferArrow, /<line\b/);
  assert.doesNotMatch(transferArrow, /<marker\b/);
  assert.doesNotMatch(transferArrow, /markerEnd/);
  assert.match(panel, /D1SourceViewer/);
  assert.match(panel, /D1SanitizationMicroscope/);
  assert.match(sourceViewer, /usePythonSourceHighlighting/);
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
  assert.match(d1Styles, /\.d1-filter-arrow\s*\{[^}]*width: 72px;[^}]*height: 32px;/);
  assert.match(d1Styles, /grid-template-rows: clamp\(132px, 31%, 154px\) minmax\(0, 1fr\)/);
  assert.match(d1Styles, /\.d1-comparison-grid[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(d1Styles, /\.d1-input-filter-lower[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(d1Styles, /\.d1-source-code[^}]*overflow: auto/);
  assert.match(d1Styles, /\.d1-rule-entry[^}]*min-height: 44px/);
  assert.doesNotMatch(d1Styles, /\.d1-rule-list[^}]*overflow:\s*(auto|scroll)/);
});
