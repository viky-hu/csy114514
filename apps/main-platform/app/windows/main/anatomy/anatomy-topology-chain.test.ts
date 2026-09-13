import assert from "node:assert/strict";
import test from "node:test";

import type { AnatomyPath, AnatomyPathStep } from "./anatomy-data.ts";
import {
  orderTopologyChainNodes,
  planTopologyChain,
  type TopologyChainGraphNode,
} from "./anatomy-topology-chain.ts";
import type { AgentTopology } from "../topology/topology-types.ts";

const sourceNode: TopologyChainGraphNode = {
  labels: ["UNTRUSTED"],
  metadata: { name: "browser.open_page" },
  node_id: "node-source",
  node_type: "SOURCE",
};

const sinkNode: TopologyChainGraphNode = {
  labels: ["DANGEROUS", "SENSITIVE"],
  metadata: { name: "email.send" },
  node_id: "node-send",
  node_type: "TOOL",
};

const documentsNode: TopologyChainGraphNode = {
  labels: ["UNTRUSTED", "EXTERNAL"],
  metadata: { name: "External Documents" },
  node_id: "node-documents",
  node_type: "SOURCE",
};

function createStep(
  overrides: Partial<AnatomyPathStep> & { label: string },
): AnatomyPathStep {
  return {
    description: "",
    id: overrides.label,
    labels: [],
    nodeType: "AGENT",
    role: "agent",
    stage: "first_pass",
    stageLabel: "初次解析",
    ...overrides,
  };
}

function createPath(steps: AnatomyPathStep[]): AnatomyPath {
  return {
    attackGoal: "",
    description: "",
    evidence: [],
    id: "R5",
    name: "计划污染",
    riskType: "plan_contamination",
    seedIds: [],
    severity: "HIGH",
    status: "potential",
    steps,
    story: "",
    successCondition: "",
    testCaseId: null,
    verification: {
      attackSeedNames: [],
      expectedBehavior: "",
      howToVerify: "",
      seedIds: [],
      testCaseId: null,
      testCaseName: null,
    },
  };
}

const plannerExecutorTopology: AgentTopology = {
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
    { id: "planner", role: "PLANNER", tools: [], trust_boundary: "internal" },
    { id: "executor", role: "EXECUTOR", tools: ["email.send"], trust_boundary: "internal" },
  ],
  topology_type: "planner_executor",
};

const ragTopology: AgentTopology = {
  agent_id: "corpmate-v0",
  edges: [
    {
      carries_untrusted_content: true,
      channel: "retrieval",
      from_node: "knowledge_base",
      to_node: "retriever",
    },
    {
      carries_untrusted_content: true,
      channel: "retrieval",
      from_node: "retriever",
      to_node: "agent",
    },
  ],
  nodes: [
    { id: "agent", role: "AGENT", tools: ["email.send"], trust_boundary: "internal" },
    { id: "knowledge_base", role: "KNOWLEDGE_BASE", tools: [], trust_boundary: "external" },
    { id: "retriever", role: "RETRIEVER", tools: [], trust_boundary: "internal" },
  ],
  topology_type: "rag_agent",
};

test("plans the R5 chain from the real planner-to-executor channel", () => {
  const plan = planTopologyChain({
    graphNodes: [sourceNode, sinkNode],
    path: createPath([
      createStep({ id: "node-source", label: "browser.open_page", role: "source", stage: "ingress" }),
      createStep({ id: "planner", label: "Planner", role: "planner" }),
      createStep({ id: "executor", label: "Executor", role: "executor", stage: "sensitive_read" }),
      createStep({ id: "node-send", label: "email.send", role: "tool", stage: "sink" }),
    ]),
    topology: plannerExecutorTopology,
  });

  assert.equal(plan.kind, "ready");

  if (plan.kind !== "ready") {
    return;
  }

  assert.deepEqual(
    plan.nodes.map((node) => node.nodeId),
    ["node-source", "planner", "executor", "node-send"],
  );
  assert.deepEqual(
    plan.nodes.map((node) => node.role),
    ["source", "planner", "executor", "tool"],
  );
  assert.deepEqual(
    plan.nodes.map((node) => node.displayName),
    ["恶意网页", "任务规划", "任务执行", "发送邮件"],
  );
  assert.deepEqual(
    plan.nodes.map((node) => node.origin),
    ["graph", "topology", "topology", "graph"],
  );
  assert.deepEqual(plan.channels, [
    null,
    { label: "TASK PLAN", untrusted: true },
    null,
  ]);
});

test("plans the R6 chain from the real knowledge-base retrieval channels", () => {
  const plan = planTopologyChain({
    graphNodes: [documentsNode, sinkNode],
    path: createPath([
      createStep({
        id: "node-documents",
        label: "External Documents",
        role: "source",
        stage: "ingress",
      }),
      createStep({ id: "knowledge_base", label: "Knowledge Base", role: "knowledge_base" }),
      createStep({ id: "retriever", label: "Retriever", role: "retriever", stage: "recall" }),
      createStep({ id: "agent", label: "CorpMate v0", role: "agent" }),
      createStep({ id: "node-send", label: "email.send", role: "tool", stage: "sink" }),
    ]),
    topology: ragTopology,
  });

  assert.equal(plan.kind, "ready");

  if (plan.kind !== "ready") {
    return;
  }

  assert.equal(plan.nodes.length, 5);
  assert.deepEqual(
    plan.nodes.map((node) => node.nodeId),
    ["node-documents", "knowledge_base", "retriever", "agent", "node-send"],
  );
  assert.deepEqual(
    plan.nodes.map((node) => node.trustBoundary),
    ["external", "external", "internal", "internal", "internal"],
  );
  assert.equal(plan.nodes[1].caption, "外部信任边界 · 外部");
  assert.deepEqual(plan.channels, [
    null,
    { label: "RETRIEVAL", untrusted: true },
    { label: "RETRIEVAL", untrusted: true },
    null,
  ]);
});

test("orders topology nodes along real edges and stops on cycles", () => {
  assert.deepEqual(
    orderTopologyChainNodes(plannerExecutorTopology).map((node) => node.id),
    ["planner", "executor"],
  );
  assert.deepEqual(
    orderTopologyChainNodes(ragTopology).map((node) => node.id),
    ["knowledge_base", "retriever", "agent"],
  );
  assert.deepEqual(
    orderTopologyChainNodes({
      agent_id: "loop",
      edges: [
        { carries_untrusted_content: false, channel: "a_to_b", from_node: "a", to_node: "b" },
        { carries_untrusted_content: false, channel: "b_to_a", from_node: "b", to_node: "a" },
      ],
      nodes: [
        { id: "a", role: "PLANNER", tools: [], trust_boundary: "internal" },
        { id: "b", role: "EXECUTOR", tools: [], trust_boundary: "internal" },
      ],
      topology_type: "planner_executor",
    }).map((node) => node.id),
    ["a", "b"],
  );
});

test("refuses to draw a chain when the topology or the path is absent", () => {
  const steps = [
    createStep({ id: "node-source", label: "browser.open_page", role: "source" }),
    createStep({ id: "node-send", label: "email.send", role: "tool" }),
  ];

  assert.deepEqual(
    planTopologyChain({ graphNodes: [sourceNode, sinkNode], path: createPath(steps), topology: undefined }),
    { kind: "missing", missing: [], reason: "当前 Agent 未接入多节点拓扑。" },
  );

  assert.deepEqual(
    planTopologyChain({
      graphNodes: [sourceNode, sinkNode],
      path: createPath(steps),
      topology: {
        agent_id: "corpmate-v0",
        edges: [],
        nodes: [{ id: "agent", role: "AGENT", tools: [], trust_boundary: "internal" }],
        topology_type: "single",
      },
    }),
    { kind: "missing", missing: [], reason: "当前 Agent 未接入多节点拓扑。" },
  );

  assert.deepEqual(
    planTopologyChain({
      graphNodes: [sourceNode, sinkNode],
      path: null,
      topology: plannerExecutorTopology,
    }),
    { kind: "missing", missing: [], reason: "攻击图谱未登记该拓扑的风险路径。" },
  );

  assert.deepEqual(
    planTopologyChain({
      graphNodes: [sourceNode, sinkNode],
      path: createPath(steps),
      topology: { ...plannerExecutorTopology, nodes: [] },
    }),
    { kind: "missing", missing: [], reason: "拓扑接口未返回节点。" },
  );
});

test("names the attack-graph node that the topology needs but the graph omits", () => {
  const plan = planTopologyChain({
    graphNodes: [sinkNode],
    path: createPath([
      createStep({ id: "node-documents", label: "External Documents", role: "source" }),
      createStep({ id: "knowledge_base", label: "Knowledge Base", role: "knowledge_base" }),
      createStep({ id: "node-send", label: "email.send", role: "tool" }),
    ]),
    topology: ragTopology,
  });

  assert.deepEqual(plan, {
    kind: "missing",
    missing: ["External Documents"],
    reason: "拓扑与攻击图谱未同时返回完整节点。",
  });
});

test("matches a node whose id fell back to its own name and rejects duplicates", () => {
  const matched = planTopologyChain({
    graphNodes: [
      { ...sourceNode, node_id: "" },
      sinkNode,
    ],
    path: createPath([
      createStep({ id: "browser.open_page", label: "browser.open_page", role: "source" }),
      createStep({ id: "planner", label: "Planner", role: "planner" }),
      createStep({ id: "executor", label: "Executor", role: "executor" }),
      createStep({ id: "node-send", label: "email.send", role: "tool" }),
    ]),
    topology: plannerExecutorTopology,
  });

  assert.equal(matched.kind, "ready");

  assert.deepEqual(
    planTopologyChain({
      graphNodes: [
        { labels: [], metadata: { name: "agent" }, node_id: "agent", node_type: "AGENT" },
        sinkNode,
      ],
      path: createPath([
        createStep({ id: "agent", label: "agent", role: "agent" }),
        createStep({ id: "knowledge_base", label: "Knowledge Base", role: "knowledge_base" }),
        createStep({ id: "retriever", label: "Retriever", role: "retriever" }),
        createStep({ id: "agent-2", label: "agent-2", role: "agent" }),
        createStep({ id: "node-send", label: "email.send", role: "tool" }),
      ]),
      topology: ragTopology,
    }),
    {
      kind: "missing",
      missing: [],
      reason: "拓扑节点在攻击图谱中重复出现，无法确定唯一链路。",
    },
  );
});
