import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

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
  assert.match(graphSource, /viewBox="0 0 880 340"/);
  assert.match(graphSource, /onPointerMove/);
  assert.match(graphSource, /setActiveStepFromClientX/);
  assert.match(layoutSource, /buildOrthogonalRouteSegments/);
  assert.match(layoutSource, /direction: "down"/);
  assert.match(layoutSource, /direction: "up"/);
  assert.match(layoutSource, /hoverBands/);
  assert.match(dashboardSource, /overview-map-footer/);
  assert.doesNotMatch(mainStyles, /overview-route-morph[\s\S]*stroke: url/);
  assert.doesNotMatch(dashboardSource, /overview-node-tags/);
  assert.doesNotMatch(dashboardSource, /overview-node-role/);
  assert.match(graphSource, /overview-node-popover/);
  assert.match(mainStyles, /\.overview-dashboard \{[\s\S]*overflow: auto;/);
  assert.doesNotMatch(mainStyles, /height: clamp\(320px, 46vh, 490px\);/);
});
