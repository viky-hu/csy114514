import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

function getNumericExport(source, name) {
  const match = source.match(new RegExp(`export const ${name} = (?<value>\\d+)`));
  assert.ok(match?.groups?.value, `Missing numeric export ${name}`);
  return Number(match.groups.value);
}

function getObjectNumericProperty(source, exportName, propertyName) {
  const objectMatch = source.match(
    new RegExp(`export const ${exportName} = \\{(?<body>[\\s\\S]*?)\\} as const;`),
  );
  assert.ok(objectMatch?.groups?.body, `Missing object export ${exportName}`);
  const propertyMatch = objectMatch.groups.body.match(
    new RegExp(`${propertyName}: (?<value>\\d+)`),
  );
  assert.ok(
    propertyMatch?.groups?.value,
    `Missing numeric property ${exportName}.${propertyName}`,
  );
  return Number(propertyMatch.groups.value);
}

function getStepLayout(source, id) {
  const objectMatch = source.match(
    new RegExp(
      `\\{\\s*caption: "[^"]+",\\s*height: \\d+,\\s*icon: "[^"]+",\\s*id: "${id}",\\s*width: \\d+,\\s*x: \\d+,\\s*y: \\d+,\\s*\\}`,
    ),
  );
  assert.ok(objectMatch, `Missing layout object for ${id}`);
  const match = objectMatch[0].match(
    /height: (?<height>\d+),[\s\S]*?width: (?<width>\d+),[\s\S]*?x: (?<x>\d+),[\s\S]*?y: (?<y>\d+),/,
  );
  assert.ok(match?.groups, `Missing coordinates for ${id}`);
  return {
    height: Number(match.groups.height),
    width: Number(match.groups.width),
    x: Number(match.groups.x),
    y: Number(match.groups.y),
  };
}

const dashboardSource = readFileSync(
  new URL("./OverviewDashboard.tsx", import.meta.url),
  "utf8",
);

const graphSource = readFileSync(
  new URL("./OverviewR4Graph.tsx", import.meta.url),
  "utf8",
);

const layoutSource = readFileSync(
  new URL("./overview-r4-layout.ts", import.meta.url),
  "utf8",
);

const mainStyles = readFileSync(
  new URL("../../../styles/window-3-main.css", import.meta.url),
  "utf8",
);

test("R4 graph uses layered orthogonal SVG structure with x-axis hot zones", () => {
  assert.match(dashboardSource, /OverviewR4Graph/);
  assert.doesNotMatch(dashboardSource, /gsap\/MorphSVGPlugin/);
  assert.doesNotMatch(graphSource, /gsap\/MorphSVGPlugin/);
  assert.match(graphSource, /gsap\/DrawSVGPlugin/);
  assert.doesNotMatch(graphSource, /overview-chain-pulse/);
  assert.doesNotMatch(graphSource, /overview-route-morph/);
  assert.doesNotMatch(graphSource, /overview-route-final/);
  assert.doesNotMatch(graphSource, /overview-node-box/);
  assert.match(graphSource, /overview-r4-layer-band/);
  assert.match(graphSource, /overview-r4-hot-zone/);
  assert.match(graphSource, /overview-r4-route-segment/);
  assert.match(graphSource, /overview-r4-hover-outline/);
  assert.match(graphSource, /overview-r4-node-icon/);
  assert.match(graphSource, /"--hot-rail-alpha": 0/);
  assert.doesNotMatch(graphSource, /hot-sheen/);
  assert.match(mainStyles, /\.overview-r4-hot-zone::before/);
  assert.doesNotMatch(mainStyles, /\.overview-r4-hot-zone::after/);
  assert.match(mainStyles, /backdrop-filter: blur\(16px\) saturate\(175%\) brightness\(1\.05\);/);
  assert.match(graphSource, /viewBox="0 0 1000 440"/);
  assert.match(graphSource, /overview-r4-layer-info/);
  assert.match(graphSource, /onPointerMove/);
  assert.match(graphSource, /setActiveStepFromClientX/);
  assert.match(layoutSource, /buildOrthogonalRouteSegments/);
  assert.match(layoutSource, /direction: "down"/);
  assert.match(layoutSource, /direction: "up"/);
  assert.match(layoutSource, /R4_LAYER_INFO_BOUNDARY_X/);
  assert.match(mainStyles, /grid-template-columns:\s*minmax\(700px,\s*1fr\)\s*minmax\(300px,\s*360px\);/);
  assert.match(layoutSource, /hoverBands/);
  assert.match(dashboardSource, /overview-map-footer/);
  assert.doesNotMatch(mainStyles, /overview-route-morph[\s\S]*stroke: url/);
  assert.doesNotMatch(dashboardSource, /overview-node-tags/);
  assert.doesNotMatch(dashboardSource, /overview-node-role/);
  assert.match(graphSource, /overview-node-popover/);
  assert.match(mainStyles, /\.overview-dashboard \{[\s\S]*overflow: auto;/);
  assert.match(mainStyles, /height: clamp\(320px,\s*46vh,\s*520px\);/);
  assert.match(mainStyles, /height: clamp\(280px,\s*42vh,\s*400px\);/);
  assert.match(mainStyles, /height: clamp\(300px,\s*58vh,\s*460px\);/);
});

test("R4 graph reserves a left lane for layer copy before the attack chain", () => {
  const infoBoundaryX = getNumericExport(layoutSource, "R4_LAYER_INFO_BOUNDARY_X");
  const sourceLayout = getStepLayout(layoutSource, "source");
  const sourceLeft = sourceLayout.x - sourceLayout.width / 2;

  assert.equal(getNumericExport(layoutSource, "R4_LAYER_INFO_BOUNDARY_X"), 160);
  assert.ok(
    sourceLeft > infoBoundaryX,
    `source node left edge ${sourceLeft} should sit beyond info boundary ${infoBoundaryX}`,
  );
});

test("R4 graph derives hover and route geometry from adjusted node bounds", () => {
  const sourceLayout = getStepLayout(layoutSource, "source");
  const agentLayout = getStepLayout(layoutSource, "agent-parse");
  const memoryLayout = getStepLayout(layoutSource, "memory");
  const sourceLeft = sourceLayout.x - sourceLayout.width / 2;

  assert.doesNotMatch(graphSource, /<marker[\s>]/);
  assert.doesNotMatch(graphSource, /markerEnd=/);
  assert.ok(
    agentLayout.x - sourceLayout.x <= 152,
    `source-to-agent x gap ${agentLayout.x - sourceLayout.x} should be tightened`,
  );
  assert.ok(
    memoryLayout.x - agentLayout.x <= 152,
    `agent-to-memory x gap ${memoryLayout.x - agentLayout.x} should be tightened`,
  );

  assert.match(layoutSource, /sourceBounds\.left \+ sourceBounds\.right/);
  assert.match(layoutSource, /sourceBounds\.bottom : sourceBounds\.top/);
  assert.match(layoutSource, /targetBounds\.top \+ targetBounds\.bottom/);
  assert.match(layoutSource, /targetBounds\.left/);
  assert.match(layoutSource, /M \$\{sourceCenterX\} \$\{sourceBoundaryY\}/);
  assert.match(layoutSource, /H \$\{targetBounds\.left\}/);
  assert.match(layoutSource, /xStart: currentBounds\.left/);
  assert.match(layoutSource, /xEnd: currentBounds\.right/);
  assert.doesNotMatch(layoutSource, /previousBounds/);
  assert.doesNotMatch(layoutSource, /nextBounds/);
  assert.doesNotMatch(graphSource, /hotZones\[[^\]]+\][\s\S]*scaleX/);
  assert.equal(sourceLeft, 170, "first hover zone must cover the adjusted source node left edge");
});

test("R4 hover bands exactly match the measured node horizontal bounds", () => {
  const measuredBounds = [
    ["source", 170, 302],
    ["agent-parse", 319, 457],
    ["memory", 469, 611],
    ["agent-recall", 623, 761],
    ["email", 778, 910],
  ];

  for (const [id, expectedLeft, expectedRight] of measuredBounds) {
    const layout = getStepLayout(layoutSource, id);
    const measuredLeft = layout.x - layout.width / 2;
    const measuredRight = layout.x + layout.width / 2;

    assert.equal(measuredLeft, expectedLeft, `${id} node left bound drifted`);
    assert.equal(measuredRight, expectedRight, `${id} node right bound drifted`);
  }

  assert.match(
    layoutSource,
    /export const hoverBands = R4_STEP_LAYOUTS\.map\(\(layout, index\) => \{\s*const currentBounds = getNodeBounds\(layout\);[\s\S]*xStart: currentBounds\.left,[\s\S]*xEnd: currentBounds\.right,/,
  );
  assert.match(layoutSource, /return null;/);
  assert.match(graphSource, /activateStep\(findHoverStepIndex\(viewBoxX\)\)/);
});

test("R4 graph expands vertical SVG space and uses fixed node content slots", () => {
  const stepIds = ["source", "agent-parse", "memory", "agent-recall", "email"];
  const stepLayouts = stepIds.map((id) => getStepLayout(layoutSource, id));

  assert.equal(getObjectNumericProperty(layoutSource, "R4_GRAPH_VIEWBOX", "height"), 440);
  assert.equal(getObjectNumericProperty(layoutSource, "R4_GRAPH_BOUNDARY", "height"), 388);
  assert.equal(getNumericExport(layoutSource, "R4_LAYER_BAND_HEIGHT"), 108);
  assert.match(layoutSource, /y: 34,/);
  assert.match(layoutSource, /y: 160,/);
  assert.match(layoutSource, /y: 286,/);

  for (const layout of stepLayouts) {
    assert.ok(
      layout.height >= 84,
      `node at x=${layout.x} should reserve at least 84 viewBox units of height`,
    );
  }

  assert.deepEqual(
    stepLayouts.map((layout) => layout.y),
    [88, 214, 340, 214, 340],
  );
  assert.match(graphSource, /const iconY = layout\.y - 34;/);
  assert.match(graphSource, /y=\{layout\.y \+ 14\}/);
  assert.match(graphSource, /y=\{layout\.y \+ 34\}/);
  assert.doesNotMatch(graphSource, /preserveAspectRatio="none"/);
  assert.match(graphSource, /M\$\{R4_LAYER_INFO_BOUNDARY_X\} 34 V394/);
  assert.match(graphSource, /M\$\{R4_ATTACK_CHAIN_START_X\} 34 V394/);
  assert.match(graphSource, /d="M48 151 H952"/);
  assert.match(graphSource, /d="M48 277 H952"/);
});

test("R4 graph paints layer info as an independent foreground text layer", () => {
  const bandIndex = graphSource.indexOf("overview-r4-layer-band");
  const infoLayerIndex = graphSource.indexOf("overview-r4-layer-info-layer");
  const routesIndex = graphSource.indexOf('className="overview-r4-routes"');

  assert.ok(bandIndex >= 0, "Missing R4 layer band background");
  assert.ok(infoLayerIndex >= 0, "Missing foreground layer info group");
  assert.ok(routesIndex >= 0, "Missing R4 route layer");
  assert.ok(
    bandIndex < infoLayerIndex,
    "Layer info text must be painted after glass lane backgrounds",
  );
  assert.ok(
    infoLayerIndex < routesIndex,
    "Layer info text should stay in the lane foreground before attack-chain routes",
  );
  assert.doesNotMatch(graphSource, /overview-r4-layer-info-plate/);
  assert.doesNotMatch(mainStyles, /\.overview-r4-layer-info-plate/);
  assert.match(graphSource, /const layerInfoGroups = gsap\.utils\.toArray<SVGGElement>/);
  assert.match(graphSource, /"\.overview-r4-layer-info"/);
  assert.match(graphSource, /\[\.\.\.layerBands, \.\.\.layerInfoGroups, \.\.\.nodeGroups\]/);
  assert.match(graphSource, /\.to\(\s*layerInfoGroups,/);
  assert.match(layoutSource, /export const R4_LAYER_INFO_TEXT_MAX_WIDTH = 92;/);
  assert.match(
    graphSource,
    /textLength=\{\s*band\.id === "memory-tool" \? R4_LAYER_INFO_TEXT_MAX_WIDTH : undefined\s*\}/,
  );
  assert.match(graphSource, /lengthAdjust="spacingAndGlyphs"/);
  assert.match(mainStyles, /\.overview-r4-layer-info \{[\s\S]*opacity: 1;/);
  assert.match(mainStyles, /\.overview-r4-layer-label \{[\s\S]*font-size: 12px;/);
  assert.match(mainStyles, /\.overview-r4-layer-title \{[\s\S]*font-size: 16px;/);
  assert.match(mainStyles, /\.overview-r4-layer-subtitle \{[\s\S]*font-size: 12px;/);
  assert.match(mainStyles, /\.overview-r4-layer-title \{[\s\S]*rgba\(17,\s*22,\s*34,\s*0\.88\)/);
  assert.match(mainStyles, /\.overview-r4-layer-subtitle \{[\s\S]*rgba\(17,\s*22,\s*34,\s*0\.66\)/);
});
