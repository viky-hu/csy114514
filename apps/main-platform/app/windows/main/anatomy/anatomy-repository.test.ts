import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiAnatomyRepository,
  MockAnatomyRepository,
} from "./anatomy-repository.ts";
import { anatomyPreviewInput } from "./anatomy-fixtures.ts";

test("MockAnatomyRepository returns the fixture-backed preview model", async () => {
  const repository = new MockAnatomyRepository();

  const result = await repository.load({
    agentId: "corpmate-v0",
    selectedPathId: "R4",
  });

  assert.equal(result.source, "mock");
  assert.equal(result.errorMessage, undefined);
  assert.equal(result.viewModel.mode, "preview");
  assert.equal(result.viewModel.selectedPathId, "R4");
});

test("ApiAnatomyRepository loads live graph data through the same-origin BFF", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const repository = new ApiAnatomyRepository({
    fetcher: async (input, init) => {
      calls.push({ input: String(input), init });
      return Response.json(anatomyPreviewInput.attackGraph);
    },
  });

  const result = await repository.load({
    agentId: "corpmate-v0",
    selectedPathId: "R2",
  });

  assert.equal(result.source, "api");
  assert.equal(result.viewModel.mode, "live");
  assert.equal(result.viewModel.selectedPathId, "R2");
  assert.equal(result.viewModel.statusCounts.verified, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.input, "/api/agents/corpmate-v0/graph");
  assert.equal(calls[0]?.init?.method, "GET");
});

test("ApiAnatomyRepository falls back to mock data when graph fetch fails", async () => {
  const repository = new ApiAnatomyRepository({
    fetcher: async () =>
      Response.json(
        {
          error: {
            code: "AGENT_GRAPH_UNAVAILABLE",
            details: {},
            message: "Agent graph backend is not connected.",
          },
        },
        { status: 503 },
      ),
  });

  const result = await repository.load({
    agentId: "corpmate-v0",
    selectedPathId: "R3",
  });

  assert.equal(result.source, "mock");
  assert.equal(result.viewModel.mode, "preview");
  assert.equal(result.viewModel.selectedPathId, "R3");
  assert.match(result.errorMessage ?? "", /backend/i);
});

test("ApiAnatomyRepository rejects invalid graph payloads without posting agents", async () => {
  const calls: string[] = [];
  const repository = new ApiAnatomyRepository({
    fetcher: async (input, init) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return Response.json({ nodes: "invalid", risk_path_ids: ["R4"] });
    },
  });

  const result = await repository.load({
    agentId: "corpmate-v0",
    selectedPathId: "R4",
  });

  assert.equal(result.source, "mock");
  assert.equal(result.viewModel.mode, "preview");
  assert.match(result.errorMessage ?? "", /Invalid attack graph/i);
  assert.deepEqual(calls, ["GET /api/agents/corpmate-v0/graph"]);
});
