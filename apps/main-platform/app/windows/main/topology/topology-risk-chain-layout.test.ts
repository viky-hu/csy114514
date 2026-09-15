import assert from "node:assert/strict";
import test from "node:test";
import {
  createTopologyRiskChainLayout,
  TOPOLOGY_RISK_CHAIN_VIEWBOX,
} from "./topology-risk-chain-layout.ts";

test("lays out four and five-node risk chains with measured curved connectors", () => {
  for (const count of [4, 5]) {
    const layout = createTopologyRiskChainLayout(
      Array.from({ length: count }, (_, index) => `node-${index}`),
    );

    assert.equal(layout.nodes.length, count);
    assert.equal(layout.edges.length, count - 1);
    assert.equal(TOPOLOGY_RISK_CHAIN_VIEWBOX.height, 360);
    assert.ok(layout.nodes.every((node) => node.y > 0 && node.y < TOPOLOGY_RISK_CHAIN_VIEWBOX.height));
    assert.ok(
      layout.nodes.every((node) => node.y === 162 || node.y === 198),
      "chain should use the centered y-axis with its existing stagger",
    );
    layout.edges.forEach((edge, index) => {
      const numbers = edge.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      const source = layout.nodes[index]!;
      const target = layout.nodes[index + 1]!;
      assert.deepEqual(
        [numbers[0], numbers[1]],
        [source.x + source.width / 2, source.y],
        "connector start must be the measured right boundary midpoint",
      );
      assert.deepEqual(
        numbers.slice(-2),
        [target.x - target.width / 2, target.y],
        "connector end must be the measured left boundary midpoint",
      );
      assert.match(edge.d, / C /, "connector must use a smooth cubic curve");
    });
  }
});
