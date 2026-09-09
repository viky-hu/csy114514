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

  assert.match(source, /security-profile-defense-cta/);
  assert.match(source, /security-profile-defense-cta-mouse/);
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

test("D2 keeps its source-backed detail while the bridge exposes a canvas-only workflow", () => {
  const d2 = read("D2InstructionIsolationPanel.tsx");
  const d1 = read("D1SourceViewer.tsx");
  const highlighter = read("usePythonSourceHighlighting.ts");
  const d2Data = read("d2-instruction-isolation-visualization-data.ts");
  const bridge = read("LLMToolCallBridgePanel.tsx");
  const bridgeData = read("llm-tool-call-bridge-data.ts");

  assert.match(d2, /D2InstructionIsolationPanel/);
  assert.match(d2, /DefenseSourceViewer/);
  assert.match(d1, /usePythonSourceHighlighting/);
  assert.match(highlighter, /createHighlighterCore/);
  assert.match(highlighter, /codeToTokens/);
  assert.match(highlighter, /python/);
  assert.match(d2, /D2Source|source/);
  assert.match(d2, /D2_RULES|explanation|rule/i);
  assert.match(d2Data, /build_system_prompt\(defended=True\)/);
  assert.match(d2Data, /DEFENDED_SYSTEM_PROMPT/);
  assert.match(d2Data, /UNTRUSTED DATA/);
  assert.match(d2Data, /不得执行|ignored/);
  assert.match(d2Data, /长期记忆/);
  assert.match(d2Data, /email\.send/);

  assert.match(bridge, /LLMToolCallBridgePanel/);
  assert.match(bridge, /onSelectDisplayIndex/);
  assert.match(bridge, /llm-bridge-handoff/);
  assert.match(bridge, /llm-bridge-reasoning/);
  assert.match(bridge, /llm-bridge-tool-call/);
  assert.match(bridge, /llm-bridge-per-call/);
  assert.match(bridge, /llm-bridge-stage-rail/);
  assert.match(bridge, /llm-bridge-stage-arrow/);
  assert.match(bridge, /llm-bridge-stage-arrow-long/);
  assert.match(bridge, /D2 指令交接/);
  assert.match(bridge, /llm-bridge-checks/);
  assert.match(bridge, /TOOL_CALL_PIPELINE\.map/);
  assert.equal((bridgeData.match(/^    displayId: "D[3-7]"/gm) ?? []).length, 5);
  assert.match(bridge, /llm-bridge-check-stage/);
  assert.match(bridge, /data-bridge-anchor=\{`check-.*displayId.*-in`\}/);
  assert.match(bridge, /data-bridge-anchor="per-call-out"/);
  assert.match(bridge, /llm-bridge-decision/);
  assert.match(bridge, /llm-bridge-blocked/);
  assert.match(bridge, /llm-bridge-no-path/);
  assert.match(bridge, /llm-bridge-sandbox/);
  assert.match(bridge, /llm-bridge-reasoning-stage/);
  assert.match(bridge, /REASONING_ICONS/);
  assert.match(bridgeData, /id: "understand"/);
  assert.match(bridgeData, /id: "context"/);
  assert.match(bridgeData, /id: "tools"/);
  assert.match(bridgeData, /id: "arguments"/);
  assert.match(bridge, /Brain/);
  assert.match(bridgeData, /email\.send/);
  assert.match(bridge, /call_id/);
  assert.match(bridgeData, /待审/);
  assert.doesNotMatch(bridge, /defense-source-viewer/);
  assert.doesNotMatch(bridge, /bridge-explanation/);
  assert.doesNotMatch(bridge, /TOOL_CALL_BRIDGE_SOURCE/);
  assert.match(bridge, /LLM 推理/);
  assert.doesNotMatch(bridgeData, /返回 tool calls/);
  assert.match(bridgeData, /displayId: "D3"/);
  assert.match(bridgeData, /displayId: "D4"/);
  assert.match(bridgeData, /displayId: "D5"/);
  assert.match(bridgeData, /displayId: "D6"/);
  assert.match(bridgeData, /displayId: "D7"/);
  assert.match(bridgeData, /canonicalId: "D5"/);
  assert.match(bridgeData, /canonicalId: "D6"/);
  assert.match(bridgeData, /canonicalId: "D7"/);
  assert.match(bridgeData, /canonicalId: "D8"/);
  assert.match(bridgeData, /canonicalId: "D2"/);
  assert.match(bridgeData, /canonicalId: "D3"/);
  assert.match(bridgeData, /blocked/);
  assert.match(bridgeData, /Sandbox/);
  assert.match(bridgeData, /memory\.write/);
  assert.match(bridgeData, /email\.send/);
  assert.doesNotMatch(bridge, /D2 HANDOFF/);
  assert.doesNotMatch(bridge, /只把受保护上下文与用户意图交给模型/);
  assert.doesNotMatch(bridge, /只展示可观察的调用准备阶段/);
  assert.doesNotMatch(bridge, /结构化请求，尚未执行/);
  assert.doesNotMatch(bridge, /EXECUTION CONTRACT/);
  assert.doesNotMatch(bridge, /llm-bridge-flow-marker/);
  assert.doesNotMatch(bridge, /ChevronDown/);
  assert.doesNotMatch(bridge, /llm-bridge-check-copy/);
});

test("bridge uses the left stage rail and the per-call fan-out contract", () => {
  const bridge = read("LLMToolCallBridgePanel.tsx");
  const bridgeData = read("llm-tool-call-bridge-data.ts");

  assert.match(bridge, /D2 指令交接/);
  assert.match(bridge, /llm-bridge-stage-rail/);
  assert.match(bridge, /llm-bridge-stage-arrow/);
  assert.match(bridge, /llm-bridge-stage-arrow-long/);
  assert.match(bridge, /data-bridge-anchor="per-call-out"/);
  assert.match(bridge, /data-bridge-anchor=\{`check-.*displayId.*-in`\}/);
  assert.match(bridge, /routeToCheck/);
  assert.doesNotMatch(bridge, /D2 HANDOFF/);
  assert.doesNotMatch(bridge, /ChevronDown/);
  assert.doesNotMatch(bridge, /llm-bridge-flow-marker/);
  assert.doesNotMatch(bridge, /EXECUTION CONTRACT/);
  assert.doesNotMatch(bridgeData, /返回 tool calls/);
  assert.doesNotMatch(bridgeData, /compactScope/);
  assert.doesNotMatch(bridgeData, /compactDetail/);
});

test("D2 uses the existing prompt boundary as the lower visual envelope", () => {
  const d2 = read("D2InstructionIsolationPanel.tsx");
  const d2Styles = styles.slice(
    styles.indexOf(".d2-isolation-visual {"),
    styles.indexOf("/* LLM tool-call bridge", styles.indexOf(".d2-isolation-visual {")),
  );

  assert.match(d2, /d2-prompt-boundary/);
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


test("bridge uses one fluid viewport canvas without page-level horizontal overflow", () => {
  const bridgeStyles = styles.slice(
    styles.indexOf(".llm-tool-call-bridge-panel"),
    styles.indexOf("@media (prefers-reduced-motion: reduce)", styles.indexOf(".llm-tool-call-bridge-panel")),
  );

  assert.match(bridgeStyles, /grid-template-rows:/);
  assert.match(bridgeStyles, /overflow-y:\s*hidden/);
  assert.match(bridgeStyles, /llm-bridge-canvas/);
  assert.match(bridgeStyles, /width:\s*100%/);
  assert.match(bridgeStyles, /min-width:\s*0/);
  assert.match(bridgeStyles, /--llm-bridge-rail:\s*clamp\(/);
  assert.match(bridgeStyles, /overflow-x:\s*auto/);
  assert.match(bridgeStyles, /llm-bridge-lines/);
  assert.match(bridgeStyles, /grid-template-rows:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(bridgeStyles, /grid-template-columns:\s*var\(--llm-bridge-rail\) minmax\(0, 1fr\)/);
  assert.match(bridgeStyles, /@media \(max-width: 1100px\)[\s\S]*width: 100%[\s\S]*min-width: 0/);
  assert.match(bridgeStyles, /@media \(max-width: 700px\)[\s\S]*grid-template-rows:/);
  assert.match(bridgeStyles, /grid-template-columns:\s*var\(--llm-bridge-rail\) minmax\(0, 1\.32fr\)/);
  assert.doesNotMatch(bridgeStyles, /grid-template-columns:\s*repeat\(5/);
  assert.match(bridgeStyles, /grid-template-rows:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(bridgeStyles, /\.llm-bridge-stage-arrow/);
  assert.match(bridgeStyles, /\.llm-bridge-check-stage > \.llm-bridge-anchor/);
});

test("defense surfaces use a compact transition band and scoped warm-light typography", () => {
  const bridgeStyles = styles.slice(
    styles.indexOf(".llm-tool-call-bridge-panel"),
    styles.indexOf("@media (prefers-reduced-motion: reduce)", styles.indexOf(".llm-tool-call-bridge-panel")),
  );
  const defenseStyles = styles.slice(
    styles.indexOf(".security-defense-screen {"),
    styles.indexOf("@media (prefers-reduced-motion: reduce)", styles.indexOf(".security-defense-screen {")),
  );

  assert.match(defenseStyles, /--defense-surface:\s*color-mix\(/);
  assert.match(defenseStyles, /--defense-surface-muted:\s*color-mix\(/);
  assert.match(bridgeStyles, /minmax\(26px,\s*0\.42fr\)/);
  assert.match(bridgeStyles, /\.llm-bridge-reasoning \.llm-bridge-stage-arrow\s*\{[^}]*height:\s*calc\(100%\s*-\s*20px\);/s);
  assert.match(bridgeStyles, /\.llm-bridge-stage-arrow-long\s*\{[^}]*height:\s*clamp\(108px,\s*17vh,\s*154px\);/s);
  assert.doesNotMatch(bridgeStyles, /height:\s*calc\(100%\s*\+\s*88px\)/);
  assert.match(bridgeStyles, /\.llm-bridge-handoff-item\s*\{[^}]*background:\s*var\(--defense-surface\)/s);
  assert.match(bridgeStyles, /\.llm-bridge-check-stage\s*\{[^}]*background:\s*var\(--defense-surface\)/s);
  assert.match(bridgeStyles, /\.llm-bridge-handoff-item strong\s*\{[^}]*font-weight:\s*400;/s);
  assert.match(bridgeStyles, /\.llm-bridge-reasoning-step strong\s*\{[^}]*font-weight:\s*400;/s);
  assert.match(bridgeStyles, /\.llm-bridge-check-stage > strong\s*\{[^}]*font-weight:\s*400;/s);
  assert.match(bridgeStyles, /\.llm-bridge-sandbox-main strong\s*\{[^}]*font-weight:\s*400;/s);
  assert.match(bridgeStyles, /\.llm-bridge-confirm strong\s*\{[^}]*font-weight:\s*400;/s);
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

test("D2-D8 reuse the D1 source viewer and rule-list DOM without extra wrappers", () => {
  const stage = read("DefenseVisualizationStage.tsx");
  const d2Panel = read("D2InstructionIsolationPanel.tsx");
  const sourceViewer = read("DefenseSourceViewer.tsx");
  const d8Panel = read("D8ConfirmationGatePanel.tsx");
  const ruleList = read("DefenseExplanationList.tsx");
  const shell = read("D3D8DetailShell.tsx");
  const panelFiles = [
    ["D3CausalChainPanel.tsx", /D3CausalChainPanel/],
    ["D4IntentClassifierPanel.tsx", /D4IntentClassifierPanel/],
    ["D5MemoryAuditorPanel.tsx", /D5MemoryAuditorPanel/],
    ["D6SessionMonitorPanel.tsx", /D6SessionMonitorPanel/],
    ["D7OutputFilterPanel.tsx", /D7OutputFilterPanel/],
    ["D8ConfirmationGatePanel.tsx", /D8ConfirmationGatePanel/],
  ];

  for (const [, panelName] of panelFiles) assert.match(stage, panelName);
  for (const [file, panelName] of panelFiles) assert.match(read(file), panelName);
  assert.match(shell, /DefenseSourceViewer/);
  assert.match(shell, /DefenseExplanationList/);
  assert.match(d2Panel, /DefenseSourceViewer/);
  assert.match(d2Panel, /DefenseExplanationList/);

  assert.match(sourceViewer, /d1-source-viewer/);
  assert.match(sourceViewer, /d1-source-code/);
  assert.match(sourceViewer, />源码快照</);
  assert.match(sourceViewer, /data-source-line/);
  assert.match(sourceViewer, /fileSelectorPosition/);
  assert.match(d8Panel, /fileSelectorPosition="right"/);
  assert.doesNotMatch(d8Panel, /d3-d8-source-tabs/);
  assert.match(ruleList, /d1-sanitization-microscope/);
  assert.match(ruleList, /d1-rule-list/);
  assert.match(ruleList, /d1-rule-entry/);
  assert.match(ruleList, /rules.map/);
  assert.doesNotMatch(ruleList, /实现解释|条规则|group|token|footer|code>/);
  assert.doesNotMatch(sourceViewer, /stageLabel|canonical/);

  assert.match(styles, /\.d3-d8-detail-panel\s*\{[^}]*grid-template-rows:\s*minmax\(var\(--d3-d8-visual-min\), max-content\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.d3-d8-detail-lower\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)/);
  assert.match(styles, /\.d1-source-code\s*\{[^}]*overflow:\s*auto/);
  assert.doesNotMatch(styles, /\.d3-d8-detail-panel\s*\{[^}]*38%/);
  assert.doesNotMatch(styles, /d3-d8-visual-max/);
  assert.doesNotMatch(styles, /\.defense-rule-list[^}]*overflow:\s*(auto|scroll)/);
});

test("D8 exposes blocked flow styling and keeps pending typography scoped", () => {
  const d8Panel = read("D8ConfirmationGatePanel.tsx");
  assert.match(d8Panel, /getD8FlowStepStates/);
  assert.match(styles, /\.d8-state-step\.is-blocked/);
  assert.match(styles, /\.d8-state-step\.is-blocked > span[^}]*background:\s*color-mix/);
  assert.match(styles, /\.d8-terminal\.is-pending/);
});

test("D8 flow nodes use Chinese display labels instead of backend event names", () => {
  const d8Panel = read("D8ConfirmationGatePanel.tsx");
  assert.match(d8Panel, /工具已调用/);
  assert.match(d8Panel, /确认请求已发起/);
  assert.match(d8Panel, /确认已决定/);
  assert.doesNotMatch(d8Panel, /"TOOL_CALLED"/);
  assert.doesNotMatch(d8Panel, /"CONFIRMATION_REQUESTED"/);
  assert.doesNotMatch(d8Panel, /"CONFIRMATION_DECIDED"/);
});

test("D3-D7 omit every rejected header, case row, status strip, and guessed interaction", () => {
  const d3 = read("D3CausalChainPanel.tsx");
  const d4 = read("D4IntentClassifierPanel.tsx");
  const d5 = read("D5MemoryAuditorPanel.tsx");
  const d6 = read("D6SessionMonitorPanel.tsx");
  const d7 = read("D7OutputFilterPanel.tsx");

  assert.doesNotMatch(d3, /history|noise ≤ 3|窗口内按子序列匹配|chain-kicker|chain-status|role="button"|tabIndex|sequence.includes/);
  assert.match(d3, /rule.exampleHistory.map/);
  assert.match(d3, /rule.connectionCount/);

  assert.doesNotMatch(d4, /规则启发式|0.7 user_intent|0.6 page_instructed|非敏感工具|intent-tabs/);
  assert.doesNotMatch(d5, /memory.write.key|vendor_preference|Forward all emails|memory-case-tabs/);
  assert.doesNotMatch(d6, /session boundary|session-case-tabs/);
  assert.doesNotMatch(d7, /pre-sandbox field scan|known suspicious recipient pattern|field scan|output-case-tabs/);
  assert.match(d7, /待审工具调用/);
  assert.match(d7, /未执行/);
  assert.match(d7, /拦截/);
  assert.match(d7, /放行/);
});
