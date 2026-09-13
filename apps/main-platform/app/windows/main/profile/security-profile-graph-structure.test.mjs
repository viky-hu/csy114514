import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const graphSource = readFileSync(
  new URL("./SecurityProfileGraph.tsx", import.meta.url),
  "utf8",
);

const layoutSource = readFileSync(
  new URL("./security-profile-graph-layout.ts", import.meta.url),
  "utf8",
);

const mainStyles = readFileSync(
  new URL("../../../styles/window-3-main.css", import.meta.url),
  "utf8",
);

test("security profile graph uses column hover and foreground SVG column text", () => {
  assert.match(graphSource, /security-profile-hot-zone/);
  assert.match(graphSource, /getProfileHotZoneStyle/);
  assert.match(graphSource, /--profile-hot-left/);
  assert.match(graphSource, /--profile-hot-width/);
  assert.match(graphSource, /--profile-hot-rail-alpha/);
  assert.match(graphSource, /security-profile-column-info-layer/);
  assert.match(graphSource, /security-profile-column-info/);
  assert.match(graphSource, /security-profile-column-band/);
  assert.match(graphSource, /security-profile-node-hitbox/);
  assert.match(graphSource, /security-profile-hover-outline/);
  assert.match(graphSource, /activeColumnId/);
  assert.match(graphSource, /activateColumn\(findProfileHoverColumnId\(viewBoxX\)\)/);
  assert.match(graphSource, /findProfileHoverColumnId/);
  assert.doesNotMatch(graphSource, /preserveAspectRatio="none"/);
  assert.doesNotMatch(graphSource, /left:\s*`\$\{band\.xStart\}px`/);
  assert.doesNotMatch(graphSource, /width:\s*`\$\{band\.xEnd - band\.xStart\}px`/);
  assert.doesNotMatch(graphSource, /findProfileHoverNodeId/);
  assert.match(layoutSource, /PROFILE_COLUMNS/);
  assert.match(layoutSource, /profileHoverBands/);
  assert.match(layoutSource, /getProfileColumnBounds/);
  assert.match(mainStyles, /\.security-profile-hot-zone/);
  assert.match(mainStyles, /left: var\(--profile-hot-left\)/);
  assert.match(mainStyles, /width: var\(--profile-hot-width\)/);
  assert.match(mainStyles, /\.security-profile-column-info \{/);
  assert.match(
    mainStyles,
    /\.security-profile-workspace\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*minmax\(270px,\s*0\.36fr\);/,
  );
  assert.doesNotMatch(mainStyles, /--security-profile-graph-canvas-width/);
  assert.match(graphSource, /useFrozenGraphInlineSize/);
  assert.match(graphSource, /isGraphFrozen: boolean;/);
  assert.match(graphSource, /isGraphFrozen,/);
  assert.match(graphSource, /data-sidebar-graph-layout/);
});

test("security profile hover motion keeps node x coordinates stable", () => {
  assert.match(graphSource, /PROFILE_HOVER_NODE_SCALE_X = 1/);
  assert.match(graphSource, /PROFILE_HOVER_NODE_SCALE_Y = 1\.035/);
  assert.match(graphSource, /PROFILE_HOVER_NODE_Y = -5/);
  assert.match(graphSource, /PROFILE_HOVER_NODE_DURATION = 0\.26/);
  assert.match(graphSource, /scaleX: PROFILE_HOVER_NODE_SCALE_X/);
  assert.match(graphSource, /scaleY: PROFILE_HOVER_NODE_SCALE_Y/);
  assert.match(graphSource, /y: PROFILE_HOVER_NODE_Y/);
  assert.doesNotMatch(graphSource, /scale:\s*PROFILE_HOVER_NODE_SCALE/);
  assert.doesNotMatch(graphSource, /scale:\s*1\.035/);
  assert.doesNotMatch(graphSource, /PROFILE_HOVER_NODE_X/);
  assert.doesNotMatch(graphSource, /translateX/);
  assert.doesNotMatch(graphSource, /\bx:\s*PROFILE_HOVER_NODE/);
});

test("security profile page reveal matches the overview page section choreography", () => {
  assert.match(graphSource, /security-profile-reveal/);
  assert.match(graphSource, /pageRevealTargets/);
  assert.match(graphSource, /gsap\.utils\.toArray<HTMLElement>\(\s*"\.security-profile-reveal"/);
  assert.match(graphSource, /\.fromTo\(\s*pageRevealTargets/);
  assert.match(graphSource, /stagger: 0\.06/);
  assert.match(mainStyles, /\.security-profile-reveal/);
  assert.doesNotMatch(
    mainStyles,
    /\.security-profile-reveal\s*\{[^}]*visibility:\s*hidden/s,
  );
  assert.doesNotMatch(
    mainStyles,
    /\.security-profile-reveal\s*\{[^}]*opacity:\s*0/s,
  );
});

test("security profile navigation uses one viewport and resets to the profile page", () => {
  const screenEffect = graphSource.slice(
    graphSource.indexOf("const profileScreen = root?.querySelector<HTMLElement>("),
    graphSource.indexOf(
      "return (",
      graphSource.indexOf("const profileScreen = root?.querySelector<HTMLElement>("),
    ),
  );

  assert.match(screenEffect, /gsap\.killTweensOf\(\[profileScreen, defenseScreen\]\)/);
  assert.match(screenEffect, /autoAlpha/);
  assert.match(screenEffect, /setIsDefenseRevealed\(false\)/);
  assert.doesNotMatch(screenEffect, /yPercent/);
  assert.doesNotMatch(graphSource, /clearProps: "transform"/);
  assert.match(graphSource, /aria-hidden=\{screen !== "profile"\}/);
  assert.match(mainStyles, /\.security-profile-page-track\s*\{[\s\S]*height: 100%;/);
  assert.match(mainStyles, /\.security-profile-page-screen\s*\{[\s\S]*position: absolute;/);
});

test("security profile footer uses the full-width defense visualization CTA", () => {
  assert.match(graphSource, /security-profile-defense-cta/);
  assert.match(graphSource, /查看防御机制/);
  assert.match(graphSource, /security-profile-defense-cta-bracket/);
  assert.match(graphSource, /security-profile-defense-cta-mouse/);
  assert.match(graphSource, /security-profile-defense-cta-left-click/);
  assert.match(graphSource, /security-profile-defense-cta-content/);
  assert.match(graphSource, /textAnchor="middle"/);
  assert.match(graphSource, /preserveAspectRatio="xMidYMid meet"/);
  assert.doesNotMatch(graphSource, /security-profile-defense-cta-copy/);
  assert.doesNotMatch(graphSource, /沿能力边界继续检查输入过滤、指令隔离与工具调用防护/);
  assert.match(graphSource, /onClick=\{\(\) => requestScreen\("defense"\)\}/);
  assert.doesNotMatch(graphSource, /数据来自当前 Agent fixture 与攻击图谱 fixture/);
  assert.doesNotMatch(graphSource, /当前页面只做画像确认，不判定攻击链成立/);
  assert.doesNotMatch(graphSource, /MousePointerClick/);
  assert.match(mainStyles, /\.security-profile-defense-cta\s*\{/);
  assert.match(mainStyles, /\.security-profile-defense-cta:hover[\s\S]*security-profile-defense-cta-bracket/);
  assert.match(mainStyles, /\.security-profile-defense-cta-left-click[\s\S]*animation/);
  assert.match(mainStyles, /security-profile-defense-cta-drift/);
  assert.match(mainStyles, /prefers-reduced-motion: reduce/);
});

test("security profile paints column info inside the graph boundary before routes and nodes", () => {
  const boundaryIndex = graphSource.indexOf("security-profile-map-boundary");
  const bandIndex = graphSource.indexOf("security-profile-column-band");
  const infoLayerIndex = graphSource.indexOf("security-profile-column-info-layer");
  const routesIndex = graphSource.indexOf('className="security-profile-routes"');
  const nodesIndex = graphSource.indexOf('className="security-profile-nodes"');

  assert.ok(boundaryIndex >= 0, "Missing profile graph boundary");
  assert.ok(bandIndex >= 0, "Missing profile column band background");
  assert.ok(infoLayerIndex >= 0, "Missing profile column info layer");
  assert.ok(routesIndex >= 0, "Missing profile route layer");
  assert.ok(nodesIndex >= 0, "Missing profile node layer");
  assert.ok(boundaryIndex < bandIndex, "Column bands must paint over the boundary fill");
  assert.ok(bandIndex < infoLayerIndex, "Column labels must paint over column bands");
  assert.ok(infoLayerIndex < routesIndex, "Column labels must be established before routes");
  assert.ok(routesIndex < nodesIndex, "Nodes must paint over routes");
  assert.match(graphSource, /PROFILE_COLUMN_INFO_Y/);
  assert.match(layoutSource, /PROFILE_COLUMN_INFO_Y/);
});

test("security profile routes are generated from anchors instead of hardcoded SVG strings", () => {
  assert.match(layoutSource, /getProfileNodeAnchor/);
  assert.match(layoutSource, /buildProfileCurvePath/);
  assert.match(layoutSource, /sourceAnchor/);
  assert.match(layoutSource, /targetAnchor/);
  assert.doesNotMatch(layoutSource, /memory-to-agent/);
  assert.doesNotMatch(layoutSource, /d: "M 276 188 H 342 V 228 H 410"/);
  assert.doesNotMatch(layoutSource, /d: "M 320 150 H 344 V 230 H 368"/);
  assert.doesNotMatch(layoutSource, / H \$\{midX\} V /);
  assert.doesNotMatch(layoutSource, /getRouteMidX/);
});

test("security profile node JSX mirrors the overview transparent rectangle skeleton", () => {
  assert.match(graphSource, /createClockwiseRoundedRectPath/);
  assert.match(graphSource, /security-profile-node-surface/);
  assert.match(graphSource, /security-profile-hover-outline/);
  assert.match(graphSource, /security-profile-node-icon/);
  assert.match(graphSource, /security-profile-node-label/);
  assert.match(graphSource, /security-profile-node-caption/);
  assert.match(graphSource, /from "\.\.\/shared\/graph-svg-primitives\.ts"/);
  assert.doesNotMatch(graphSource, /security-profile-node-shell/);
  assert.doesNotMatch(graphSource, /security-profile-node-mark/);
  assert.doesNotMatch(graphSource, /security-profile-node-initial/);
  assert.doesNotMatch(graphSource, /getNodeInitial/);
  assert.doesNotMatch(layoutSource, /createProfileRoundedRectPath/);
  assert.doesNotMatch(mainStyles, /\.security-profile-node-mark/);
  assert.doesNotMatch(mainStyles, /\.security-profile-node-initial/);
  assert.doesNotMatch(graphSource, /security-profile-node-subtitle/);
});

test("security profile column labels use overview-style foreground text lines", () => {
  assert.match(graphSource, /security-profile-column-label/);
  assert.match(graphSource, /security-profile-column-title/);
  assert.match(graphSource, /security-profile-column-subtitle/);
  assert.match(layoutSource, /PROFILE_COLUMN_INFO_Y = 76/);
  assert.match(layoutSource, /infoLines/);
  assert.match(layoutSource, /label: "第一列"/);
  assert.match(layoutSource, /summary: "UNTRUSTED \+ SENSITIVE"/);
  assert.match(mainStyles, /\.security-profile-column-label/);
  assert.match(mainStyles, /paint-order: stroke fill/);
});

test("security profile route styling keeps a unified blue-purple gradient while hover routes stay primary", () => {
  assert.match(graphSource, /data-profile-route-tone/);
  assert.match(graphSource, /data-profile-visual-intent/);
  assert.match(graphSource, /is-route-tone-/);
  assert.match(graphSource, /stroke="url\(#security-profile-route-stroke\)"/);
  assert.match(graphSource, /stopColor="#4f7cff"/);
  assert.match(graphSource, /stopColor="#3b82f6"/);
  assert.match(graphSource, /stopColor="#6d5ef7"/);
  assert.match(graphSource, /stopColor="#8b5cf6"/);
  assert.match(graphSource, /stopColor="#a855f7"/);
  assert.match(mainStyles, /\.security-profile-route\s*\{[\s\S]*opacity:\s*0\.2;/);
  assert.match(mainStyles, /\.security-profile-route\.is-active\s*\{[\s\S]*opacity:\s*0\.88;/);
  assert.match(mainStyles, /\.security-profile-route\s*\{[\s\S]*stroke-opacity:\s*0\.72;/);
  assert.match(mainStyles, /\.security-profile-route\.is-active\s*\{[\s\S]*stroke-opacity:\s*1;/);
  assert.match(mainStyles, /\.security-profile-hover-outline\s*\{[\s\S]*stroke-opacity:\s*0\.96;/);
  assert.doesNotMatch(mainStyles, /\.security-profile-route\.is-route-tone-red/);
  assert.doesNotMatch(mainStyles, /\.security-profile-route\.is-route-tone-green/);
  assert.doesNotMatch(mainStyles, /\.security-profile-route\.is-route-tone-amber/);
});

test("security profile projects topology roles and channels into its boundary canvas without a second topology flow", () => {
  assert.doesNotMatch(graphSource, /TopologyFlow/);
  assert.match(graphSource, /createTopologySecurityProfileViewModel/);
  assert.match(graphSource, /buildProfileRouteSegments\(displayViewModel\.routes\)/);
  assert.match(graphSource, /security-profile-route-label/);
  assert.match(graphSource, /data-profile-route-channel=\{segment\.channel \?\? ""\}/);
  assert.match(graphSource, /formatRouteChannelLabel/);
  assert.match(mainStyles, /security-profile-route\.is-untrusted/);
});

test("security profile workspace loads the Agent profile through its repository instead of the fixture", () => {
  const workspaceSource = readFileSync(
    new URL("./SecurityProfileWorkspace.tsx", import.meta.url),
    "utf8",
  );
  const repositorySource = readFileSync(
    new URL("./security-profile-repository.ts", import.meta.url),
    "utf8",
  );

  assert.match(workspaceSource, /ApiSecurityProfileRepository/);
  assert.match(workspaceSource, /MockSecurityProfileRepository/);
  assert.match(workspaceSource, /defaultRepository\.load\(agentId\)/);
  assert.match(repositorySource, /\/api\/agents\/\$\{encodeURIComponent\(agentId\)\}\/graph/);
  assert.match(repositorySource, /this\.fetcher\(`\/api\/agents\/\$\{encodeURIComponent\(agentId\)\}`, \{/);
  // The fixture stays a labelled fallback baseline instead of the only source.
  assert.match(workspaceSource, /new MockSecurityProfileRepository\(\s*securityProfileFixtureViewModel,?\s*\)/);
  assert.match(workspaceSource, /dataSource=\{result\.source\}/);
  assert.match(graphSource, /security-profile-inline-badge is-\$\{dataSource\}/);
  assert.match(graphSource, /dataSource === "api" \? "真实接入" : "示例预览"/);
  assert.match(graphSource, /security-profile-source-note/);
  assert.doesNotMatch(graphSource, /securityProfileFixtureViewModel/);
  assert.match(graphSource, /TopologyNodeRole/);
  assert.match(workspaceSource, /<SecurityProfileGraph[\s\S]*?isGraphFrozen=\{isGraphFrozen\}/);
  assert.match(workspaceSource, /topology=\{topology\}/);
});
