import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateMeetViewport,
  svgUserRectToFrameStyle,
} from "./overview-r4-svg-viewport.ts";
import {
  getNodeBounds,
  hoverBands,
  R4_GRAPH_VIEWBOX,
  R4_STEP_LAYOUTS,
} from "./overview-r4-layout.ts";

function assertAlmostEqual(actual, expected, message) {
  assert.ok(
    Math.abs(actual - expected) < 0.001,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

test("calculates a no-offset viewport when the frame matches the R4 viewBox aspect ratio", () => {
  const viewport = calculateMeetViewport({
    frameHeight: 440,
    frameWidth: 1000,
    viewBox: R4_GRAPH_VIEWBOX,
  });

  assert.deepEqual(viewport, {
    height: 440,
    offsetLeft: 0,
    offsetTop: 0,
    scale: 1,
    width: 1000,
  });
});

test("calculates horizontal letterbox offset for a wide monitor frame", () => {
  const viewport = calculateMeetViewport({
    frameHeight: 520,
    frameWidth: 1600,
    viewBox: R4_GRAPH_VIEWBOX,
  });
  const sourceBand = hoverBands.find((band) => band.id === "source");
  assert.ok(sourceBand, "Missing source hover band");
  const sourceStyle = svgUserRectToFrameStyle(
    {
      bottom: R4_GRAPH_VIEWBOX.height,
      left: sourceBand.xStart,
      right: sourceBand.xEnd,
      top: 0,
    },
    viewport,
  );
  const scale = 520 / 440;
  const offsetLeft = (1600 - 1000 * scale) / 2;

  assertAlmostEqual(viewport.scale, scale, "wide frame scale");
  assertAlmostEqual(viewport.offsetLeft, offsetLeft, "wide frame x offset");
  assertAlmostEqual(sourceStyle.left, offsetLeft + 170 * scale, "source left");
  assertAlmostEqual(sourceStyle.width, (302 - 170) * scale, "source width");
});

test("calculates vertical letterbox offset for a narrow tall frame", () => {
  const viewport = calculateMeetViewport({
    frameHeight: 520,
    frameWidth: 820,
    viewBox: R4_GRAPH_VIEWBOX,
  });
  const scale = 820 / 1000;
  const offsetTop = (520 - 440 * scale) / 2;

  assert.equal(viewport.offsetLeft, 0);
  assertAlmostEqual(viewport.scale, scale, "narrow frame scale");
  assertAlmostEqual(viewport.offsetTop, offsetTop, "narrow frame y offset");
});

test("keeps every R4 hover interval equal to its measured node rectangle bounds", () => {
  for (const [index, layout] of R4_STEP_LAYOUTS.entries()) {
    const bounds = getNodeBounds(layout);
    const band = hoverBands[index];

    assert.equal(band.id, layout.id);
    assert.equal(band.xStart, bounds.left, `${layout.id} hover left bound`);
    assert.equal(band.xEnd, bounds.right, `${layout.id} hover right bound`);
  }
});
