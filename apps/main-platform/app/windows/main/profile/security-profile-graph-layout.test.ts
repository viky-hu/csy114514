import assert from "node:assert/strict";
import test from "node:test";

import {
  PROFILE_GRAPH_BOUNDARY,
  PROFILE_COLUMNS,
  PROFILE_GRAPH_VIEWBOX,
  PROFILE_NODE_LAYOUTS,
  buildProfileRouteSegments,
  findProfileHoverColumnId,
  getProfileColumnBounds,
  getProfileNodeAnchor,
  getProfileNodeBounds,
  profileHoverBands,
} from "./security-profile-graph-layout.ts";

test("defines stable bounds for the agent boundary graph", () => {
  assert.deepEqual(PROFILE_GRAPH_VIEWBOX, {
    height: 500,
    width: 1000,
  });
  assert.deepEqual(PROFILE_GRAPH_BOUNDARY, {
    height: 448,
    rx: 8,
    width: 944,
    x: 28,
    y: 26,
  });

  const agentBounds = getProfileNodeBounds(PROFILE_NODE_LAYOUTS.agent);

  assert.deepEqual(agentBounds, {
    bottom: 308,
    left: 310,
    right: 484,
    top: 204,
  });
  for (const column of PROFILE_COLUMNS) {
    assert.ok(column.labelX > PROFILE_GRAPH_BOUNDARY.x);
    assert.ok(column.labelX < PROFILE_GRAPH_BOUNDARY.x + PROFILE_GRAPH_BOUNDARY.width);
    assert.deepEqual(Object.keys(column.infoLines), ["label", "summary", "title"]);
  }
});

test("builds route segments from node boundary anchors without DOM measurement", () => {
  const segments = buildProfileRouteSegments();

  assert.deepEqual(
    segments.map((segment) => [
      segment.id,
      segment.sourceNodeId,
      segment.targetNodeId,
      segment.sourceAnchor,
      segment.targetAnchor,
    ]),
    [
      ["source-browser-to-agent", "source-browser", "agent-corpmate", "right", "left"],
      ["data-email-to-email-read", "data-email", "tool-email-read", "right", "left"],
      ["agent-to-email-read", "agent-corpmate", "tool-email-read", "right", "left"],
      ["agent-to-email-send", "agent-corpmate", "tool-email-send", "right", "left"],
      ["agent-to-memory", "agent-corpmate", "memory-persistent", "right", "left"],
    ],
  );
  assert.equal(segments.length, 5);
  assert.deepEqual(
    getProfileNodeAnchor(PROFILE_NODE_LAYOUTS.sourceBrowser, "right"),
    { x: 242, y: 184 },
  );
  assert.deepEqual(
    getProfileNodeAnchor(PROFILE_NODE_LAYOUTS.agent, "left"),
    { x: 310, y: 256 },
  );
  assert.equal(segments[0].d.startsWith("M 242 184 C "), true);
  assert.equal(segments[0].d.endsWith(" 310 256"), true);
  assert.equal(segments.at(-1)?.d.startsWith("M 484 256 C "), true);
  assert.equal(segments.at(-1)?.d.endsWith(" 552 384"), true);
  assert.equal(segments.every((segment) => segment.d.includes(" C ")), true);
});

test("separates route visual priority so default lines do not read as a loop", () => {
  const segments = buildProfileRouteSegments();

  assert.deepEqual(
    segments.map((segment) => [segment.id, segment.visualIntent, segment.routeTone]),
    [
      ["source-browser-to-agent", "inbound", "blue"],
      ["data-email-to-email-read", "data-access", "amber"],
      ["agent-to-email-read", "tool-read", "blue"],
      ["agent-to-email-send", "tool-send", "red"],
      ["agent-to-memory", "memory-write", "green"],
    ],
  );
  assert.equal(new Set(segments.map((segment) => segment.d)).size, segments.length);
  assert.equal(
    segments.some((segment) => /H \d+ V \d+ H/.test(segment.d)),
    false,
  );
});

test("routes email data to email read with a concave downward curve", () => {
  const segment = buildProfileRouteSegments().find(
    (route) => route.id === "data-email-to-email-read",
  );

  assert.ok(segment);

  const numbers = segment.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const [, sourceY, , controlOneY, , controlTwoY, , targetY] = numbers;

  assert.equal(sourceY, 326);
  assert.equal(targetY, 184);
  assert.ok(controlOneY > sourceY);
  assert.ok(controlTwoY > sourceY);
  assert.ok(controlOneY <= sourceY + 44);
  assert.ok(controlTwoY <= sourceY + 44);
});

test("derives equal-gap hover columns from measured node horizontal bounds", () => {
  assert.deepEqual(
    PROFILE_COLUMNS.map((column) => [column.id, column.title]),
    [
      ["input-data", "输入/数据边界"],
      ["agent-core", "Agent执行核心"],
      ["persistent-memory", "持久记忆资产"],
      ["tool-sink", "工具/外发边界"],
    ],
  );
  assert.deepEqual(
    profileHoverBands.map((band) => [band.id, band.xStart, band.xEnd]),
    [
      ["input-data", 90, 242],
      ["agent-core", 310, 484],
      ["persistent-memory", 552, 712],
      ["tool-sink", 780, 944],
    ],
  );
  assert.deepEqual(
    profileHoverBands
      .slice(1)
      .map((band, index) => band.xStart - profileHoverBands[index].xEnd),
    [68, 68, 68],
  );
  assert.deepEqual(getProfileColumnBounds("input-data"), {
    xEnd: 242,
    xStart: 90,
  });
  assert.equal(findProfileHoverColumnId(166), "input-data");
  assert.equal(findProfileHoverColumnId(397), "agent-core");
  assert.equal(findProfileHoverColumnId(632), "persistent-memory");
  assert.equal(findProfileHoverColumnId(862), "tool-sink");
  assert.equal(findProfileHoverColumnId(276), null);
});
