import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const graphSource = readFileSync(
  new URL("./AnatomyGraph.tsx", import.meta.url),
  "utf8",
);

const layoutSource = readFileSync(
  new URL("./anatomy-graph-layout.ts", import.meta.url),
  "utf8",
);

const mainWindowSource = readFileSync(
  new URL("../MainWindow.tsx", import.meta.url),
  "utf8",
);

const mainStyles = readFileSync(
  new URL("../../../styles/window-3-main.css", import.meta.url),
  "utf8",
);

const graphColumnIndex = graphSource.indexOf('className="anatomy-graph-column');
const pathListIndex = graphSource.indexOf('className="anatomy-path-list');
const sideIndex = graphSource.indexOf('className="anatomy-side');

test("anatomy graph keeps a focused workbench header and SVG route choreography", () => {
  assert.match(graphSource, /未接入 Agent/);
  assert.match(graphSource, /anatomy-heading-line/);
  assert.match(graphSource, /anatomy-inline-badge/);
  assert.match(graphSource, /useGSAP/);
  assert.match(graphSource, /DrawSVGPlugin/);
  assert.match(graphSource, /anatomy-route-stroke/);
  assert.match(graphSource, /anatomy-graph-column/);
  assert.match(graphSource, /anatomy-node-hitbox/);
  assert.match(graphSource, /anatomy-phase-rail/);
  assert.match(graphSource, /anatomy-stage-pill/);
  assert.match(graphSource, /anatomy-path-card/);
  assert.match(graphSource, /anatomy-verify-button/);
  assert.match(graphSource, /repository = defaultAnatomyRepository/);
  assert.match(graphSource, /selectedNodeId/);
  assert.match(graphSource, /onClick=\{\(\) => setSelectedNodeId\(node\.id\)\}/);
  assert.match(graphSource, /onFocus=\{\(\) => setSelectedNodeId\(node\.id\)\}/);
  assert.match(graphSource, /anatomy-label-chip/);
  assert.match(graphSource, /数据来源/);
  assert.match(graphSource, /ANATOMY_PHASE_RAIL_PATH/);
  assert.match(graphSource, /ANATOMY_PHASE_LABEL_Y/);
  assert.match(graphSource, /ANATOMY_ACTIVE_NODE_DURATION/);
  assert.match(graphSource, /ANATOMY_ACTIVE_NODE_Y/);
  assert.match(graphSource, /getActiveAnatomyRouteNodeIds/);
  assert.match(graphSource, /getVisibleActiveNodeIds/);
  assert.match(graphSource, /如何验证/);
  assert.match(graphSource, /恶意网页/);
  assert.match(graphSource, /Agent 解析/);
  assert.match(graphSource, /长期记忆/);
  assert.match(graphSource, /二次唤起/);
  assert.match(graphSource, /发送邮件/);
  assert.doesNotMatch(graphSource, /示例预览/);
  assert.doesNotMatch(graphSource, /真实接入/);
  assert.doesNotMatch(graphSource, /const viewModel = previewViewModel/);
  assert.doesNotMatch(graphSource, /anatomy-mode-panel/);
  assert.doesNotMatch(graphSource, /anatomy-filter-chip/);
  assert.doesNotMatch(graphSource, /anatomy-boundary/);
  assert.doesNotMatch(graphSource, /anatomy-phase-dot/);
  assert.doesNotMatch(graphSource, /ANATOMY_GRAPH_BOUNDARY/);
  assert.doesNotMatch(graphSource, /canvas/);
  assert.doesNotMatch(graphSource, /anatomy-footer/);
  assert.doesNotMatch(graphSource, /preserveAspectRatio="none"/);
  assert.doesNotMatch(graphSource, /scale:\s*1\.026/);
  assert.doesNotMatch(graphSource, /scale:\s*1\.035/);
  assert.match(graphSource, /duration: reduceMotion \? 0 : ANATOMY_ACTIVE_NODE_DURATION/);
  assert.match(graphSource, /ease: "power2\.out"/);
  assert.match(graphSource, /y: ANATOMY_ACTIVE_NODE_Y/);
  assert.match(mainWindowSource, /AttackGraphWorkspace/);
  assert.match(mainWindowSource, /activeNavKey === "anatomy"/);
  assert.match(mainStyles, /\.anatomy-page/);
  assert.match(mainStyles, /grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(mainStyles, /\.anatomy-heading-line/);
  assert.match(mainStyles, /\.anatomy-inline-badge/);
  assert.match(mainStyles, /\.anatomy-route-stroke/);
  assert.match(mainStyles, /\.anatomy-phase-rail/);
  assert.match(mainStyles, /grid-template-rows: auto minmax\(0, 1fr\);/);
  assert.match(mainStyles, /align-content: stretch;/);
  assert.match(mainStyles, /minmax\(500px, 800px\) minmax\(420px, 1fr\)/);
  assert.match(mainStyles, /\.anatomy-graph-column/);
  assert.match(mainStyles, /aspect-ratio: 1000 \/ 520/);
  assert.match(mainStyles, /container: anatomy-map \/ inline-size/);
  assert.match(mainStyles, /\.anatomy-map-stage \{[\s\S]*inset: 0;[\s\S]*width: 100%;[\s\S]*height: 100%;/);
  assert.doesNotMatch(mainStyles, /940px/);
  assert.doesNotMatch(mainStyles, /100cqh \* 1000 \/ 520/);
  assert.match(mainStyles, /\.anatomy-path-card/);
  assert.match(mainStyles, /grid-template-rows: repeat\(2, minmax\(58px, 1fr\)\);/);
  assert.match(mainStyles, /grid-auto-rows: minmax\(58px, 1fr\);/);
  assert.match(mainStyles, /align-self: stretch;/);
  assert.match(mainStyles, /height: 100%;/);
  assert.match(mainStyles, /box-sizing: border-box;/);
  assert.match(mainStyles, /padding-bottom: 6px;/);
  assert.match(mainStyles, /\.anatomy-column-label \{[\s\S]*font-size: 18px;/);
  assert.match(mainStyles, /\.anatomy-column-title \{[\s\S]*font-size: 18px;/);
  assert.match(mainStyles, /\.anatomy-column-subtitle \{[\s\S]*font-size: 13px;/);
  assert.match(mainStyles, /\.anatomy-path-card span \{[\s\S]*font-size: 17px;/);
  assert.match(mainStyles, /\.anatomy-path-card strong \{[\s\S]*font-size: 14px;/);
  assert.match(mainStyles, /\.anatomy-path-card em \{[\s\S]*font-size: 12px;/);
  assert.match(mainStyles, /\.anatomy-status-badge \{[\s\S]*font-size: 13px;/);
  assert.match(mainStyles, /\.anatomy-label-chip/);
  assert.match(mainStyles, /\.anatomy-node-detail-list/);
  assert.match(mainStyles, /\.anatomy-inspector-heading h2 \{[\s\S]*font-size: 23px;/);
  assert.match(mainStyles, /\.anatomy-inspector-heading p,[\s\S]*\.anatomy-detail-block p \{[\s\S]*font-size: 13px;/);
  assert.match(mainStyles, /\.anatomy-detail-block > span \{[\s\S]*font-size: 13px;/);
  assert.match(mainStyles, /\.anatomy-verify-button \{[\s\S]*font-size: 13px;/);
  assert.match(mainStyles, /\.anatomy-risk-meta dt,[\s\S]*\.anatomy-verify-meta dd \{[\s\S]*font-size: 12px;/);
  assert.match(mainStyles, /\.anatomy-stage-pill \{[\s\S]*font-size: 12px;/);
  assert.match(mainStyles, /\.anatomy-step-list strong,[\s\S]*\.anatomy-evidence-list strong \{[\s\S]*font-size: 14px;/);
  assert.match(mainStyles, /\.anatomy-step-list em \{[\s\S]*font-size: 12px;/);
  assert.match(mainStyles, /\.anatomy-evidence-list p \{[\s\S]*font-size: 13px;/);
  assert.doesNotMatch(mainStyles, /\.anatomy-mode-panel/);
  assert.doesNotMatch(mainStyles, /\.anatomy-filter-chip/);
  assert.doesNotMatch(mainStyles, /\.anatomy-boundary/);
  assert.doesNotMatch(mainStyles, /\.anatomy-phase-dot/);
  assert.doesNotMatch(mainStyles, /\.anatomy-footer/);
});

test("anatomy graph keeps R4 as the default focus and reuses the graph primitives", () => {
  assert.ok(graphColumnIndex >= 0);
  assert.ok(pathListIndex > graphColumnIndex);
  assert.ok(sideIndex > pathListIndex);
  assert.match(layoutSource, /selectedPathId: "R4"/);
  assert.match(layoutSource, /ANATOMY_GRAPH_VIEWBOX/);
  assert.match(layoutSource, /createClockwiseRoundedRectPath/);
  assert.match(layoutSource, /getAnatomyNodeAnchor/);
  assert.match(layoutSource, /getAnatomyNodeBounds/);
  assert.match(layoutSource, /getActiveAnatomyRouteNodeIds/);
  assert.match(layoutSource, /ANATOMY_LAYOUT_OFFSET_X = 48/);
  assert.match(layoutSource, /ANATOMY_LAYOUT_OFFSET_Y = 28/);
  assert.match(layoutSource, /ANATOMY_ACTIVE_NODE_DURATION = 0\.26/);
  assert.match(layoutSource, /ANATOMY_ACTIVE_NODE_Y = -5/);
  assert.match(layoutSource, /ANATOMY_NODE_WIDTH = 150/);
  assert.match(layoutSource, /ANATOMY_NODE_HEIGHT = 88/);
  assert.match(layoutSource, /width: ANATOMY_NODE_WIDTH/);
  assert.match(layoutSource, /height: ANATOMY_NODE_HEIGHT/);
  assert.match(layoutSource, /buildAnatomyRouteSegments/);
  assert.match(layoutSource, /ANATOMY_PHASES/);
  assert.match(layoutSource, /ANATOMY_PHASE_LABEL_Y = 390 \+ ANATOMY_LAYOUT_OFFSET_Y/);
  assert.match(layoutSource, /ANATOMY_PHASE_RAIL_PATH = `M \$\{56 \+ ANATOMY_LAYOUT_OFFSET_X\}/);
  assert.match(layoutSource, /offsetPoint\(438, 156\)/);
  assert.match(layoutSource, /id: "agent-first-pass-to-email-send"[\s\S]*pathIds: \["R1", "R3"\]/);
  assert.doesNotMatch(layoutSource, /agent-first-pass-to-email-send-r3/);
  assert.match(layoutSource, /first_pass/);
  assert.match(layoutSource, /persistence/);
  assert.match(layoutSource, /recall/);
  assert.doesNotMatch(layoutSource, /ANATOMY_GRAPH_BOUNDARY/);
  assert.doesNotMatch(layoutSource, /ANATOMY_COLUMNS/);
  assert.match(layoutSource, /source-browser/);
  assert.match(layoutSource, /tool-email-send/);
  assert.match(layoutSource, /tool-email-read/);
  assert.match(layoutSource, /memory-persistent/);
  assert.match(layoutSource, /agent-first-pass/);
  assert.match(layoutSource, /agent-recall/);
});
