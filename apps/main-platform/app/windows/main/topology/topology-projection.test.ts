import assert from "node:assert/strict";
import test from "node:test";
import {
  createTopologyProjection,
  getTopologyRiskPath,
  getTopologySummary,
} from "./topology-projection.ts";

test("projection keeps planner-executor topology records without fabricating browser or tool nodes", () => {
  const projection = createTopologyProjection({
    attackGraph: {
      edges: [
        {
          edge_id: "planner-executor",
          edge_type: "TASK_PLAN",
          metadata: { description: "Planner task plan reaches Executor." },
          source_node_id: "planner",
          target_node_id: "executor",
        },
      ],
      nodes: [
        {
          labels: [],
          metadata: { name: "Planner", role: "planner" },
          node_id: "planner",
          node_type: "AGENT",
        },
        {
          labels: [],
          metadata: { name: "Executor", role: "executor" },
          node_id: "executor",
          node_type: "AGENT",
        },
      ],
      risk_path_ids: ["R5"],
    },
    findings: [],
    topology: {
      agent_id: "corp-mate",
      edges: [
        {
          carries_untrusted_content: true,
          channel: "task_plan",
          from_node: "planner",
          to_node: "executor",
        },
      ],
      nodes: [
        { id: "planner", role: "PLANNER", tools: [], trust_boundary: "internal" },
        { id: "executor", role: "EXECUTOR", tools: ["email.send"], trust_boundary: "internal" },
      ],
      topology_type: "planner_executor",
    },
  });

  assert.equal(projection.dataState, "ready");
  assert.deepEqual(
    projection.nodes.map((node) => node.id),
    ["planner", "executor"],
  );
  assert.deepEqual(projection.edges, [
    {
      carries_untrusted_content: true,
      channel: "task_plan",
      from_node: "planner",
      to_node: "executor",
    },
  ]);
  assert.equal(projection.contextNodes.length, 0);
  assert.deepEqual(getTopologySummary(projection), {
    nodeCount: 2,
    topologyType: "planner_executor",
    untrustedChannelCount: 1,
  });
});

test("RAG risk path uses only graph-backed context and findings alone verify it", () => {
  const projection = createTopologyProjection({
    attackGraph: {
      edges: [],
      nodes: [
        {
          labels: ["UNTRUSTED"],
          metadata: { name: "External Documents", role: "external" },
          node_id: "external-documents",
          node_type: "SOURCE",
        },
        {
          labels: [],
          metadata: { name: "Knowledge Base", role: "knowledge_base" },
          node_id: "knowledge-base",
          node_type: "KNOWLEDGE_BASE",
        },
        {
          labels: [],
          metadata: { name: "Retriever", role: "retriever" },
          node_id: "retriever",
          node_type: "AGENT",
        },
        {
          labels: [],
          metadata: { name: "CorpMate", role: "agent" },
          node_id: "agent",
          node_type: "AGENT",
        },
        {
          labels: ["DANGEROUS"],
          metadata: { name: "email.send" },
          node_id: "email-send",
          node_type: "TOOL",
        },
      ],
      risk_path_ids: ["R6"],
    },
    findings: [{ risk_pattern_id: "R6" }],
    topology: {
      agent_id: "corp-mate",
      edges: [
        {
          carries_untrusted_content: true,
          channel: "retrieval",
          from_node: "knowledge-base",
          to_node: "retriever",
        },
        {
          carries_untrusted_content: true,
          channel: "context",
          from_node: "retriever",
          to_node: "agent",
        },
      ],
      nodes: [
        { id: "knowledge-base", role: "KNOWLEDGE_BASE", tools: [], trust_boundary: "external" },
        { id: "retriever", role: "RETRIEVER", tools: [], trust_boundary: "internal" },
        { id: "agent", role: "AGENT", tools: ["email.send"], trust_boundary: "internal" },
      ],
      topology_type: "rag_agent",
    },
  });

  const path = getTopologyRiskPath(projection, "R6");

  assert.equal(path?.status, "verified");
  assert.deepEqual(path?.nodeIds, [
    "external-documents",
    "knowledge-base",
    "retriever",
    "agent",
    "email-send",
  ]);
  assert.equal(path?.edges[0]?.channel, "retrieval");
  assert.equal(path?.edges[1]?.channel, "context");
});
