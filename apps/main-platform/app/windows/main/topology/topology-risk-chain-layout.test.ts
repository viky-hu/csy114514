import assert from "node:assert/strict";
import test from "node:test";
import {
  createTopologyRiskChainLayout,
  TOPOLOGY_RISK_CHAIN_VIEWBOX,
} from "./topology-risk-chain-layout.ts";

test("lays out four and five-node risk chains compactly with visible forward line bodies", () => {
  for (const count of [4, 5]) {
    const layout = createTopologyRiskChainLayout(
      Array.from({ length: count }, (_, index) => `node-${index}`),
    );

    assert.equal(layout.nodes.length, count);
    assert.equal(layout.edges.length, count - 1);
    assert.equal(TOPOLOGY_RISK_CHAIN_VIEWBOX.height, 260);
    layout.edges.forEach((edge, index) => {
      const numbers = edge.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const source = layout.nodes[index]!;
      const target = layout.nodes[index + 1]!;
      assert.deepEqual(
        [numbers[0], numbers[1], numbers[2], numbers[3]],
        [
          source.x + source.width / 2,
          source.y,
          target.x - target.width / 2,
          target.y,
        ],
        "connector endpoints must be the measured right/left boundary midpoints",
      );
      assert.ok(numbers[2] - numbers[0] >= 48, "line body must remain visible before its arrow");
      assert.equal(numbers[1], numbers[3], "risk-chain connectors must be short horizontal lines");
    });
  }
});
