import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const profileDir = new URL("./", import.meta.url);
const read = (file) => readFileSync(new URL(file, profileDir), "utf8");
const styles = readFileSync(
  new URL("../../../styles/window-3-main.css", profileDir),
  "utf8",
);

test("defense visualization keeps the supplied wheel interaction surface", () => {
  const source = read("DefenseOptionWheel.tsx");

  assert.match(source, /requestAnimationFrame/);
  assert.match(source, /onWheel|wheel/);
  assert.match(source, /onPointerDown/);
  assert.match(source, /ArrowUp|ArrowDown/);
  assert.match(source, /resolveDefenseWheelTarget/);
  assert.match(source, /commitPosition/);

  const pointerMove = source.slice(
    source.indexOf("const handlePointerMove"),
    source.indexOf("const handlePointerEnd"),
  );
  assert.doesNotMatch(pointerMove, /notifySelection|onChange/);

  const pointerEnd = source.slice(
    source.indexOf("const handlePointerEnd"),
    source.indexOf("const handleItemClick"),
  );
  assert.match(pointerEnd, /dragMovedRef\.current/);
  assert.match(pointerEnd, /commitPosition/);
});

test("wheel release commits the nearest center option and preserves the smooth return", () => {
  const source = read("DefenseOptionWheel.tsx");
  const commit = source.slice(
    source.indexOf("const commitPosition"),
    source.indexOf("useEffect(() =>", source.indexOf("const commitPosition")),
  );
  const controlledSync = source.slice(
    source.indexOf("if (selectedIndexProp === undefined"),
    source.indexOf("const handleWheel"),
  );

  assert.match(commit, /Math\.round\(targetPositionRef\.current\)/);
  assert.match(commit, /resolveDefenseWheelTarget|resolveDefenseWheelSelection/);
  assert.match(commit, /requestPosition|startLoop/);
  assert.doesNotMatch(controlledSync, /positionRef\.current\s*=\s*nextIndex/);
  assert.doesNotMatch(controlledSync, /renderPosition\(nextIndex\)/);
});

test("defense flow is an independent eight-node SVG", () => {
  const source = read("DefenseFlow.tsx");

  assert.match(source, /<svg/);
  assert.equal((source.match(/data-defense-flow-node/g) ?? []).length, 1);
  assert.match(source, /DEFENSE_LAYERS\.map/);
  assert.match(source, /<line/);
  assert.match(source, /<circle/);
  assert.doesNotMatch(source, /preserveAspectRatio=\"none\"/);
  assert.match(source, /preserveAspectRatio=\"xMidYMid meet\"/);
});

test("security profile owns enter, reveal, and return transitions", () => {
  const source = read("SecurityProfileGraph.tsx");

  assert.match(source, /MousePointerClick/);
  assert.match(source, /DefenseVisualizationStage/);
  assert.match(source, /yPercent: -50/);
  assert.match(source, /security-profile-page-track/);
});

test("the visualizer reserves one independent placeholder for every layer", () => {
  const source = read("DefenseVisualizationStage.tsx");

  assert.match(source, /DEFENSE_LAYERS\.map/);
  assert.match(source, /security-defense-placeholder/);
  assert.match(source, /onReturn/);
  assert.ok(
    source.indexOf('<div className="security-defense-region">') <
      source.indexOf('className="security-defense-return"'),
    "return control should be positioned inside the outer defense region",
  );
});

test("the defense workspace uses open whitespace inside the outer region", () => {
  const wheelColumn = styles.slice(
    styles.indexOf(".security-defense-wheel-column"),
    styles.indexOf(".security-defense-wheel {"),
  );
  const content = styles.slice(
    styles.indexOf(".security-defense-content"),
    styles.indexOf(".security-defense-placeholder"),
  );

  assert.doesNotMatch(wheelColumn, /border-right/);
  assert.doesNotMatch(content, /border:|background/);
  assert.match(styles, /grid-template-columns: 154px minmax\(0, 1fr\)/);
  assert.match(styles, /grid-template-columns: 154px minmax\(0, 1fr\);\s*gap: 0/);

  const region = styles.slice(
    styles.indexOf("\n.security-defense-region {") + 1,
    styles.indexOf("\n.security-defense-screen.is-revealed .security-defense-region"),
  );
  const flow = styles.slice(
    styles.indexOf("\n.security-defense-flow {") + 1,
    styles.indexOf("\n.security-defense-flow-segment"),
  );
  const returnControl = styles.slice(
    styles.lastIndexOf("\n.security-defense-return {") + 1,
    styles.indexOf("\n.security-defense-screen.is-revealed .security-defense-return"),
  );

  assert.match(region, /position: relative;/);
  assert.match(region, /border: 1px solid/);
  assert.doesNotMatch(region, /background/);
  assert.match(flow, /width: min\(100%, 1180px\);/);
  assert.match(flow, /justify-self: center;/);
  assert.match(returnControl, /top: 12px;[\s\S]*left: 12px;/);
});
