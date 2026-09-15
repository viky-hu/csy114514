import assert from "node:assert/strict";
import test from "node:test";
import { createTopologyRiskRailModel } from "./topology-risk-rail.ts";
import type { TopologyRiskChain } from "./topology-projection.ts";

function createChain(
  riskPatternId: "R5" | "R6",
  status: "potential" | "verified",
): Extract<TopologyRiskChain, { dataState: "ready" }> {
  const nodes = riskPatternId === "R5"
    ? [
        { id: "source", role: "source" as const, displayName: "外部输入", caption: "不可信输入", graphNodeId: "source", labels: [], nodeType: "SOURCE", origin: "graph" as const, trustBoundary: "external" as const },
        { id: "planner", role: "planner" as const, displayName: "任务规划", caption: "接收不可信内容", graphNodeId: "planner", labels: [], nodeType: "AGENT", origin: "topology" as const, trustBoundary: "internal" as const },
        { id: "executor", role: "executor" as const, displayName: "任务执行", caption: "执行计划中的动作", graphNodeId: "executor", labels: [], nodeType: "AGENT", origin: "topology" as const, trustBoundary: "internal" as const },
        { id: "tool", role: "tool" as const, displayName: "危险工具", caption: "对外发送动作", graphNodeId: "tool", labels: ["DANGEROUS"], nodeType: "TOOL", origin: "graph" as const, trustBoundary: "internal" as const },
      ]
    : [
        { id: "source", role: "source" as const, displayName: "外部文档", caption: "不可信外部文档", graphNodeId: "source", labels: [], nodeType: "SOURCE", origin: "graph" as const, trustBoundary: "external" as const },
        { id: "knowledge_base", role: "knowledge_base" as const, displayName: "知识库", caption: "外部知识内容", graphNodeId: "knowledge_base", labels: [], nodeType: "DATA", origin: "topology" as const, trustBoundary: "external" as const },
        { id: "retriever", role: "retriever" as const, displayName: "上下文检索", caption: "检索知识库内容", graphNodeId: "retriever", labels: [], nodeType: "AGENT", origin: "topology" as const, trustBoundary: "internal" as const },
        { id: "agent", role: "agent" as const, displayName: "主 Agent", caption: "组装上下文并决策", graphNodeId: "agent", labels: [], nodeType: "AGENT", origin: "topology" as const, trustBoundary: "internal" as const },
        { id: "tool", role: "tool" as const, displayName: "危险工具", caption: "对外发送动作", graphNodeId: "tool", labels: ["DANGEROUS"], nodeType: "TOOL", origin: "graph" as const, trustBoundary: "internal" as const },
      ];
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `edge-${index}`,
    sourceNodeId: node.id,
    targetNodeId: nodes[index + 1]!.id,
    channel: riskPatternId === "R5"
      ? ["input", "task_plan", "tool_call"][index] ?? "tool_call"
      : ["ingest", "retrieval", "context", "tool_call"][index] ?? "tool_call",
    carriesUntrustedContent: index < (riskPatternId === "R5" ? 2 : 3),
    description: "",
    label: "",
    origin: "topology" as const,
  }));
  return { dataState: "ready", edges, nodes, riskPatternId, status, topologyType: riskPatternId === "R5" ? "planner_executor" : "rag_agent" };
}

test("maps R5 to an internal rail with task_plan as the highlighted channel", () => {
  const model = createTopologyRiskRailModel(createChain("R5", "potential"));

  assert.equal(model.riskPatternId, "R5");
  assert.deepEqual(model.segments.map((segment) => segment.value), ["外部输入", "task_plan", "计划污染 → 危险工具", "结构命中 · 待验证"]);
  assert.equal(model.segments[1]?.tone, "channel");
  assert.deepEqual(model.segments[1]?.relatedEdgeIds, ["edge-1"]);
  assert.equal(model.primaryAction, "开始拓扑测评");
});

test("maps R6 retrieval/context flow and exposes verified status only for a finding", () => {
  const model = createTopologyRiskRailModel(createChain("R6", "verified"));

  assert.deepEqual(model.segments.map((segment) => segment.value), ["外部文档", "retrieval / context", "上下文投毒 → 危险工具", "结构命中 · 已验证"]);
  assert.deepEqual(model.segments[1]?.relatedEdgeIds, ["edge-1", "edge-2"]);
  assert.equal(model.segments[3]?.tone, "verified");
});
