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
