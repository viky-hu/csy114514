import assert from "node:assert/strict";
import test from "node:test";

import {
  ApiTopologyRepository,
  MockTopologyRepository,
} from "./topology-repository.ts";

test("MockTopologyRepository provides the existing single-agent topology", async () => {
  const repository = new MockTopologyRepository();
  const result = await repository.loadAgentTopology("corpmate-v0");

  assert.equal(result.source, "mock");
  assert.ok(result.topology);
  assert.equal(result.topology.agent_id, "corpmate-v0");
  assert.equal(result.topology.topology_type, "single");
  assert.equal(result.topology.nodes.length, 1);
});

test("ApiTopologyRepository loads an agent topology through the same-origin BFF", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const controller = new AbortController();
  const repository = new ApiTopologyRepository({
    fetcher: async (input, init) => {
      calls.push({ input: String(input), init });
      return Response.json({
        agent_id: "corpmate-v0",
        edges: [
          {
            carries_untrusted_content: true,
            channel: "task_plan",
            from_node: "planner",
            to_node: "executor",
          },
        ],
        nodes: [
          {
            id: "planner",
            role: "PLANNER",
            tools: [],
            trust_boundary: "internal",
          },
          {
            id: "executor",
            role: "EXECUTOR",
            tools: ["email.send"],
            trust_boundary: "internal",
          },
        ],
        topology_type: "planner_executor",
      });
    },
  });

  const result = await repository.loadAgentTopology("corpmate-v0", {
    signal: controller.signal,
  });

  assert.equal(result.source, "api");
  assert.ok(result.topology);
  assert.equal(result.topology.topology_type, "planner_executor");
  assert.equal(calls[0]?.input, "/api/topology/corpmate-v0");
  assert.equal(calls[0]?.init?.method, "GET");
  assert.equal(calls[0]?.init?.signal, controller.signal);
});

test("ApiTopologyRepository labels invalid backend payloads unavailable instead of presenting a fallback as saved", async () => {
  const repository = new ApiTopologyRepository({
    fetcher: async () => Response.json({ nodes: "invalid" }),
  });

  const result = await repository.loadAgentTopology("corpmate-v0");

  assert.equal(result.source, "unavailable");
  assert.equal(result.topology, null);
  assert.match(result.errorMessage ?? "", /Invalid topology payload/i);
});

test("ApiTopologyRepository leaves preset options unavailable when the backend is unavailable", async () => {
  const repository = new ApiTopologyRepository({
    fetcher: async () => {
      throw new Error("offline");
    },
  });

  const presets = await repository.loadPresets();

  assert.deepEqual(presets, []);
});

test("ApiTopologyRepository saves a selected preset without serializing graph structure", async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const repository = new ApiTopologyRepository({
    fetcher: async (input, init) => {
      calls.push({ input: String(input), init });
      return Response.json({
        agent_id: "corpmate-v0",
        edges: [],
        nodes: [
          {
            id: "agent",
            role: "AGENT",
            tools: [],
            trust_boundary: "internal",
          },
        ],
        topology_type: "single",
      });
    },
  });

  const topology = await repository.saveAgentTopology("corpmate-v0", "single");

  assert.equal(topology.topology_type, "single");
  assert.equal(calls[0]?.input, "/api/topology/corpmate-v0");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.body, '{"preset_name":"single"}');
});
