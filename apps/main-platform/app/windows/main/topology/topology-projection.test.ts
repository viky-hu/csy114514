import assert from "node:assert/strict";
import test from "node:test";
import { createTopologyRiskChain, orderTopologyNodes } from "./topology-projection.ts";

const plannerTopology = {
  agent_id: "corpmate-v0",
  topology_type: "planner_executor" as const,
  nodes: [
    { id: "planner", role: "PLANNER" as const, tools: [], trust_boundary: "internal" as const },
    { id: "executor", role: "EXECUTOR" as const, tools: ["email.send"], trust_boundary: "internal" as const },
  ],
  edges: [{ from_node: "planner", to_node: "executor", channel: "task_plan", carries_untrusted_content: true }],
};

const ragTopology = {
  agent_id: "corpmate-v0",
  topology_type: "rag_agent" as const,
  nodes: [
    { id: "knowledge_base", role: "KNOWLEDGE_BASE" as const, tools: [], trust_boundary: "external" as const },
    { id: "retriever", role: "RETRIEVER" as const, tools: [], trust_boundary: "internal" as const },
    { id: "agent", role: "AGENT" as const, tools: ["email.send"], trust_boundary: "internal" as const },
  ],
  edges: [
    { from_node: "knowledge_base", to_node: "retriever", channel: "retrieval", carries_untrusted_content: true },
    { from_node: "retriever", to_node: "agent", channel: "context", carries_untrusted_content: true },
  ],
};

test("builds the four-node R5 chain from the real two-node topology and graph context", () => {
  const chain = createTopologyRiskChain({
    topology: plannerTopology,
    attackGraph: {
      risk_path_ids: ["R5"],
      nodes: [
        { node_id: "web", node_type: "SOURCE", labels: ["UNTRUSTED"], metadata: { name: "browser.open_page", role: "external" } },
        { node_id: "planner", node_type: "AGENT", labels: [], metadata: { name: "Planner", role: "planner" } },
        { node_id: "executor", node_type: "AGENT", labels: [], metadata: { name: "Executor", role: "executor" } },
        { node_id: "send", node_type: "TOOL", labels: ["DANGEROUS"], metadata: { name: "email.send" } },
      ],
      edges: [
        { edge_id: "web-planner", edge_type: "UNTRUSTED_INPUT", source_node_id: "web", target_node_id: "planner" },
        { edge_id: "planner-executor", edge_type: "TASK_PLAN", source_node_id: "planner", target_node_id: "executor" },
        { edge_id: "executor-send", edge_type: "TOOL_CALL", source_node_id: "executor", target_node_id: "send" },
      ],
    },
  });

  assert.equal(chain.dataState, "ready");
  if (chain.dataState !== "ready") return;
  assert.equal(chain.riskPatternId, "R5");
  assert.deepEqual(chain.nodes.map((node) => node.id), ["web", "planner", "executor", "send"]);
  assert.deepEqual(chain.nodes.map((node) => node.displayName), ["恶意网页", "任务规划", "任务执行", "发送邮件"]);
  assert.deepEqual(chain.edges.map((edge) => [edge.sourceNodeId, edge.targetNodeId]), [["web", "planner"], ["planner", "executor"], ["executor", "send"]]);
  assert.equal(chain.edges[1]?.channel, "task_plan");
  assert.deepEqual(chain.nodes.map((node) => node.origin), ["graph", "topology", "topology", "graph"]);
});

test("builds the five-node R6 chain without a placeholder", () => {
  const chain = createTopologyRiskChain({
    topology: ragTopology,
    findings: [{ risk_pattern_id: "R6" }],
    attackGraph: {
      risk_path_ids: ["R6"],
      nodes: [
        { node_id: "docs", node_type: "SOURCE", labels: ["UNTRUSTED"], metadata: { name: "External Documents", role: "external" } },
        { node_id: "knowledge_base", node_type: "DATA", labels: ["EXTERNAL"], metadata: { name: "Knowledge Base", role: "knowledge_base" } },
        { node_id: "retriever", node_type: "AGENT", labels: [], metadata: { name: "Retriever", role: "retriever" } },
        { node_id: "agent", node_type: "AGENT", labels: [], metadata: { name: "CorpMate", role: "agent" } },
        { node_id: "send", node_type: "TOOL", labels: ["DANGEROUS"], metadata: { name: "email.send" } },
      ],
      edges: [
        { edge_id: "docs-kb", edge_type: "INGEST", source_node_id: "docs", target_node_id: "knowledge_base" },
        { edge_id: "kb-retriever", edge_type: "RETRIEVAL", source_node_id: "knowledge_base", target_node_id: "retriever" },
        { edge_id: "retriever-agent", edge_type: "CONTEXT", source_node_id: "retriever", target_node_id: "agent" },
        { edge_id: "agent-send", edge_type: "TOOL_CALL", source_node_id: "agent", target_node_id: "send" },
      ],
    },
  });

  assert.equal(chain.dataState, "ready");
  if (chain.dataState !== "ready") return;
  assert.equal(chain.status, "verified");
  assert.equal(chain.nodes.length, 5);
  assert.equal(chain.edges.length, 4);
  assert.equal(chain.nodes.some((node) => node.origin === "placeholder"), false);
});

test("returns an explicit insufficient state instead of drawing a partial chain", () => {
  const chain = createTopologyRiskChain({ topology: plannerTopology, attackGraph: { risk_path_ids: ["R5"], nodes: [], edges: [] } });
  assert.deepEqual(chain, { dataState: "insufficient", reason: "拓扑与攻击图谱未同时返回完整节点。", topologyType: "planner_executor" });
});

test("orders topology nodes by real edges and stops on cycles", () => {
  assert.deepEqual(orderTopologyNodes(plannerTopology).map((node) => node.id), ["planner", "executor"]);
  assert.deepEqual(orderTopologyNodes(ragTopology).map((node) => node.id), ["knowledge_base", "retriever", "agent"]);
});
