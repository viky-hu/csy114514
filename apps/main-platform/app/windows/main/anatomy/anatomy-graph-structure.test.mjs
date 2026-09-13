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

const chainSource = readFileSync(
  new URL("./anatomy-topology-chain.ts", import.meta.url),
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
  assert.match(mainStyles, /--anatomy-graph-canvas-width:\s*800px;/);
  assert.match(mainStyles, /grid-template-columns:\s*minmax\(0,\s*var\(--anatomy-graph-canvas-width\)\)\s*minmax\(420px,\s*1fr\);/);
  assert.match(mainStyles, /\.anatomy-graph-column/);
  assert.match(mainStyles, /\.anatomy-graph-column\s*\{[\s\S]*?width:\s*min\(100%,\s*var\(--anatomy-graph-canvas-width\)\);/);
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

test("topology modes render the selected risk path instead of embedding the shared topology flow", () => {
  assert.doesNotMatch(graphSource, /TopologyFlow/);
  assert.match(graphSource, /TopologyRiskPathStage/);
  assert.match(graphSource, /path\.steps/);
  assert.match(graphSource, /topologyPathId/);
  assert.match(graphSource, /planner_executor/);
  assert.match(graphSource, /rag_agent/);
  assert.doesNotMatch(graphSource, /anatomy-topology-path-node/);
});

test("topology risk paths reuse the anatomy SVG skeleton instead of text cards", () => {
  assert.match(graphSource, /planTopologyChain\(\{ graphNodes, path, topology \}\)/);
  assert.match(graphSource, /getTopologyStepPhaseXs\(chain\.length\)/);
  assert.match(graphSource, /createTopologyChainNodeLayout\(phaseXs\[index\]\)/);
  assert.match(graphSource, /buildTopologyChainSegments\(layouts\)/);
  assert.match(graphSource, /anatomy-topology-channel-label/);
  assert.match(graphSource, /anatomy-svg-node is-\$\{node\.role\} is-active/);
  assert.match(graphSource, /graphNodes=\{viewModel\.graph\.nodes\}/);
  assert.match(graphSource, /ANATOMY_TOPOLOGY_PHASES/);
  assert.match(graphSource, /ANATOMY_PHASE_RAIL_PATH/);
  assert.match(graphSource, /anatomy-map is-topology is-\$\{status\}/);
  assert.match(graphSource, /viewBox=\{`0 0 \$\{ANATOMY_GRAPH_VIEWBOX\.width\} \$\{ANATOMY_GRAPH_VIEWBOX\.height\}`\}/);
  // The topology stage renders only the graph canvas: no risk-path heading,
  // story paragraph, status badge, or caption block may shrink the canvas.
  assert.doesNotMatch(graphSource, /anatomy-topology-path-heading/);
  assert.doesNotMatch(graphSource, /anatomy-topology-path-story/);
  assert.doesNotMatch(graphSource, /anatomy-topology-path-caption/);
  assert.doesNotMatch(graphSource, /anatomy-topology-path\b/);
});

test("topology risk paths never fabricate nodes when the backend returns no path", () => {
  assert.match(graphSource, /className="anatomy-map is-topology"/);
  assert.match(graphSource, /anatomy-map-empty/);
  assert.match(graphSource, /路径数据不足/);
  assert.match(graphSource, /不会补造节点或连线/);
  assert.match(graphSource, /plan\.missing\.join/);
  assert.match(graphSource, /ShieldQuestion/);
});

test("topology chain layout stays inside the anatomy five-phase rail", () => {
  assert.match(layoutSource, /ANATOMY_TOPOLOGY_NODE_Y = offsetY\(166\)/);
  assert.match(layoutSource, /ANATOMY_TOPOLOGY_NODE_WIDTH = ANATOMY_NODE_WIDTH/);
  assert.match(layoutSource, /ANATOMY_TOPOLOGY_NODE_HEIGHT = ANATOMY_NODE_HEIGHT/);
  assert.match(layoutSource, /export function getTopologyStepPhaseXs/);
  assert.match(layoutSource, /export function createTopologyChainNodeLayout/);
  assert.match(layoutSource, /export function buildTopologyChainSegments/);
  assert.match(layoutSource, /labelY: y - source\.height \/ 2 - 18/);
  assert.match(layoutSource, /ANATOMY_PHASE_RAIL_PATH/);
});

test("topology chain is planned from real topology nodes and real topology edges", () => {
  assert.match(chainSource, /export function planTopologyChain/);
  assert.match(chainSource, /export function orderTopologyChainNodes/);
  assert.match(chainSource, /kind: "missing"/);
  assert.match(chainSource, /reason: "当前 Agent 未接入多节点拓扑。"/);
  assert.match(chainSource, /reason: "拓扑与攻击图谱未同时返回完整节点。"/);
  assert.match(chainSource, /carries_untrusted_content/);
  assert.match(chainSource, /formatChannelLabel/);
  assert.doesNotMatch(chainSource, /TASK PLAN|RETRIEVAL|External Documents|Knowledge Base/);
  assert.doesNotMatch(chainSource, /stageLabel/);
});
