import { expect, test, type Page } from "@playwright/test";
import agentProfile from "../../../csy——全智赛/shared/fixtures/agent_profile.json";
import singleAttackGraph from "../../../csy——全智赛/shared/fixtures/attack_graph.json";

const plannerTopology = {
  agent_id: "corpmate-v0",
  topology_type: "planner_executor",
  nodes: [
    { id: "planner", role: "PLANNER", tools: [], trust_boundary: "internal" },
    { id: "executor", role: "EXECUTOR", tools: ["email.send"], trust_boundary: "internal" },
  ],
  edges: [
    { from_node: "planner", to_node: "executor", channel: "task_plan", carries_untrusted_content: false },
  ],
};

const plannerAttackGraph = {
  risk_path_ids: ["R5"],
  nodes: [
    { node_id: "web", node_type: "SOURCE", labels: ["UNTRUSTED"], metadata: { name: "browser.open_page", role: "external" } },
    { node_id: "planner", node_type: "AGENT", labels: [], metadata: { name: "Planner", role: "planner" } },
    { node_id: "executor", node_type: "AGENT", labels: [], metadata: { name: "Executor", role: "executor" } },
    { node_id: "memory", node_type: "MEMORY", labels: ["PERSISTENT"], metadata: { name: "long_term" } },
    { node_id: "send", node_type: "TOOL", labels: ["DANGEROUS"], metadata: { name: "email.send" } },
  ],
  edges: [
    { edge_id: "web-planner", edge_type: "UNTRUSTED_INPUT", source_node_id: "web", target_node_id: "planner", metadata: {} },
    { edge_id: "planner-executor", edge_type: "TASK_PLAN", source_node_id: "planner", target_node_id: "executor", metadata: {} },
    { edge_id: "executor-memory", edge_type: "READ_FROM", source_node_id: "executor", target_node_id: "memory", metadata: {} },
    { edge_id: "executor-send", edge_type: "CALL", source_node_id: "executor", target_node_id: "send", metadata: {} },
  ],
};

const ragTopology = {
  agent_id: "corpmate-v0",
  topology_type: "rag_agent",
  nodes: [
    { id: "knowledge_base", role: "KNOWLEDGE_BASE", tools: [], trust_boundary: "external" },
    { id: "retriever", role: "RETRIEVER", tools: [], trust_boundary: "internal" },
    { id: "agent", role: "AGENT", tools: ["email.send"], trust_boundary: "internal" },
  ],
  edges: [
    { from_node: "knowledge_base", to_node: "retriever", channel: "retrieval", carries_untrusted_content: true },
    { from_node: "retriever", to_node: "agent", channel: "retrieval", carries_untrusted_content: true },
  ],
};

const ragAttackGraph = {
  risk_path_ids: ["R6"],
  nodes: [
    { node_id: "docs", node_type: "SOURCE", labels: ["UNTRUSTED"], metadata: { name: "External Documents", role: "external" } },
    { node_id: "knowledge_base", node_type: "DATA", labels: ["EXTERNAL"], metadata: { name: "Knowledge Base", role: "knowledge_base" } },
    { node_id: "retriever", node_type: "AGENT", labels: [], metadata: { name: "Retriever", role: "retriever" } },
    { node_id: "agent", node_type: "AGENT", labels: [], metadata: { name: "CorpMate", role: "agent" } },
    { node_id: "send", node_type: "TOOL", labels: ["DANGEROUS"], metadata: { name: "email.send" } },
  ],
  edges: [
    { edge_id: "docs-kb", edge_type: "INGEST", source_node_id: "docs", target_node_id: "knowledge_base", metadata: {} },
    { edge_id: "kb-retriever", edge_type: "RETRIEVAL", source_node_id: "knowledge_base", target_node_id: "retriever", metadata: {} },
    { edge_id: "retriever-agent", edge_type: "CONTEXT", source_node_id: "retriever", target_node_id: "agent", metadata: {} },
    { edge_id: "agent-send", edge_type: "CALL", source_node_id: "agent", target_node_id: "send", metadata: {} },
  ],
};

const singleTopology = {
  agent_id: "corpmate-v0",
  topology_type: "single",
  nodes: [
    { id: "agent", role: "AGENT", tools: ["email.send"], trust_boundary: "internal" },
  ],
  edges: [],
};

async function openMainWindow(page: Page) {
  const requests: string[] = [];
  let activePresetName = "single";
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const requestKey = `${route.request().method()} ${url.pathname}`;
    requests.push(requestKey);
    if (url.pathname === "/api/topology/corpmate-v0") {
      const presetName =
        route.request().method() === "POST"
          ? (route.request().postDataJSON()?.preset_name ?? "single")
          : activePresetName;
      activePresetName = presetName;
      const body =
        presetName === "rag_agent"
          ? ragTopology
          : presetName === "planner_executor"
            ? plannerTopology
            : singleTopology;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    if (url.pathname === "/api/agents/corpmate-v0/graph") {
      const body = activePresetName === "rag_agent"
        ? ragAttackGraph
        : activePresetName === "planner_executor"
          ? plannerAttackGraph
          : singleAttackGraph;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    if (url.pathname === "/api/agents/corpmate-v0" && route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(agentProfile) });
      return;
    }
    if (url.pathname === "/api/agents" && route.request().method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "BACKEND_UNAVAILABLE", message: "Backend unavailable in test" } }) });
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hitArea = page.locator(".login-placeholder-hitarea");
  const hitAreaBox = await hitArea.boundingBox();
  expect(hitAreaBox).not.toBeNull();
  await page.mouse.click(hitAreaBox!.x + hitAreaBox!.width / 2, hitAreaBox!.y + hitAreaBox!.height / 2);
  await page.getByRole("button", { name: "进入平台" }).click();
  await expect(page.locator(".login-placeholder-page")).toHaveAttribute("data-scroll-ready", "true");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "auto" }));
  await page.getByRole("button", { name: "稍后再说" }).click();
  await expect(page.locator(".main-window")).toHaveAttribute("data-main-window-stage", "settled", { timeout: 20_000 });
  return { requests };
}

test("planner-executor topology uses page-native overview and profile projections", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const api = await openMainWindow(page);

  // Entering the platform always starts at the Single Agent mode.
  await expect(page.getByRole("region", { name: "总览页" })).toBeVisible();
  await expect(page.locator(".topology-mode-nav-current")).toHaveText("Single Agent 模式");
  await expect(page.locator(".topology-summary")).toHaveCount(0);

  // Switching modes replays the white-screen entry intro before the new
  // topology projections become visible.
  await page.getByRole("button", { name: "打开拓扑模式菜单" }).click();
  await page.getByRole("button", { name: /Planner–Executor/ }).click();
  await page.getByRole("button", { name: "确认切换" }).click();
  await expect(page.locator(".main-window")).toHaveAttribute("data-main-window-stage", "settled", { timeout: 20_000 });
  await expect(page.locator(".topology-mode-nav-current")).toHaveText("Planner–Executor 模式");
  expect(api.requests).toContain("POST /api/topology/corpmate-v0");

  await expect(page.locator(".topology-overview-graph")).toBeVisible();
  await expect(page.locator("[data-topology-node-id=planner]")).toBeVisible();
  await expect(page.locator("[data-topology-edge-id*=task_plan]").first()).toBeVisible();
  const overviewRoutes = page.locator(".topology-risk-edge-stroke");
  await expect(overviewRoutes).toHaveCount(3);
  expect(await overviewRoutes.evaluateAll((paths) =>
    paths.map((path) => ({
      length: (path as SVGPathElement).getTotalLength(),
      opacity: Number.parseFloat(getComputedStyle(path).opacity),
    })),
  )).toEqual(expect.arrayContaining([
    expect.objectContaining({ length: expect.any(Number), opacity: expect.any(Number) }),
  ]));
  for (const route of await overviewRoutes.evaluateAll((paths) =>
    paths.map((path) => ({
      length: (path as SVGPathElement).getTotalLength(),
      opacity: Number.parseFloat(getComputedStyle(path).opacity),
    })),
  )) {
    expect(route.length).toBeGreaterThanOrEqual(48);
    expect(route.opacity).toBeGreaterThan(0.7);
  }

  const plannerNode = page.locator("[data-topology-node-id=planner]");
  await expect(plannerNode.locator(".graph-hover-outline")).toHaveCSS("opacity", "0");
  await plannerNode.hover();
  await expect(plannerNode.locator(".graph-hover-outline")).toHaveCSS("opacity", "1");
  const plannerTransform = await plannerNode.evaluate((node) => {
    const matrix = (node as SVGGElement).transform.baseVal.consolidate()?.matrix;
    return matrix ? { a: matrix.a, d: matrix.d, e: matrix.e } : null;
  });
  expect(plannerTransform).toMatchObject({ a: 1, d: 1, e: 0 });
  await page.mouse.move(4, 4);
  await expect(plannerNode.locator(".graph-hover-outline")).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: /安全画像/ }).click();
  await expect(page.getByRole("region", { name: "安全画像", exact: true })).toBeVisible({ timeout: 5_000 });
  // The caption stays readable while the raw backend channel stays inspectable.
  const taskPlanRoute = page.locator('.security-profile-route[data-profile-route-channel="task_plan"]').first();
  await expect(taskPlanRoute).toBeAttached();
  await expect(taskPlanRoute.locator("xpath=following-sibling::*[1]")).toHaveText("TASK PLAN");
  const executorMemoryRoute = page.locator('[data-profile-route-id="graph-executor-memory"]');
  await expect(executorMemoryRoute).toBeVisible();
  const executorMemoryAnchors = await executorMemoryRoute.evaluate((path) => {
    const route = path as SVGPathElement;
    const start = route.getPointAtLength(0);
    const end = route.getPointAtLength(route.getTotalLength());
    const source = document.querySelector<SVGGElement>('[data-profile-node-id="executor"] .security-profile-node-surface')!.getBBox();
    const target = document.querySelector<SVGGElement>('[data-profile-node-id="memory-persistent"] .security-profile-node-surface')!.getBBox();
    return {
      start: [start.x, start.y],
      end: [end.x, end.y],
      source: { x: source.x, y: source.y, width: source.width, height: source.height },
      target: { x: target.x, y: target.y, width: target.width, height: target.height },
    };
  });
  expect(executorMemoryAnchors.start).toEqual([
    executorMemoryAnchors.source.x + executorMemoryAnchors.source.width,
    executorMemoryAnchors.source.y + executorMemoryAnchors.source.height / 2,
  ]);
  expect(executorMemoryAnchors.end).toEqual([
    executorMemoryAnchors.target.x,
    executorMemoryAnchors.target.y + executorMemoryAnchors.target.height / 2,
  ]);

  const executorHitbox = page.locator('.security-profile-node-hitbox[data-profile-node-id="executor"]');
  await executorHitbox.hover();
  await expect(page.locator(".security-profile-svg-node.is-active")).toHaveCount(1);
  await expect(page.locator('[data-profile-node-id="executor"] .security-profile-hover-outline')).toHaveCSS("opacity", "1");
  const executorTransform = await page.locator('.security-profile-svg-node[data-profile-node-id="executor"]').evaluate((node) => {
    const matrix = (node as SVGGElement).transform.baseVal.consolidate()?.matrix;
    return matrix ? { a: matrix.a, d: matrix.d, e: matrix.e } : null;
  });
  expect(executorTransform).toMatchObject({ a: 1, d: 1, e: 0 });
  await page.mouse.move(4, 4);
  await expect(page.locator(".security-profile-svg-node.is-active")).toHaveCount(0);
  await expect(page.locator('[data-profile-node-id="executor"] .security-profile-hover-outline')).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: /攻击图谱/ }).click();
  await expect(page.locator(".anatomy-map.is-topology")).toBeVisible();
  await expect(page.locator('[data-topology-placeholder="task-plan"]')).toBeVisible();
  const anatomyRoutes = page.locator(".anatomy-topology-route");
  await expect(anatomyRoutes).toHaveCount(4);
  const anatomyRouteMetrics = await anatomyRoutes.evaluateAll((paths) =>
    paths.map((path) => ({
      dash: getComputedStyle(path).strokeDasharray,
      length: (path as SVGPathElement).getTotalLength(),
      opacity: Number.parseFloat(getComputedStyle(path).opacity),
    })),
  );
  for (const route of anatomyRouteMetrics) {
    expect(route.length).toBeGreaterThanOrEqual(30);
    expect(route.dash).toBe("none");
    expect(route.opacity).toBeGreaterThan(0.7);
  }
  const topologyStages = page.locator(
    ".anatomy-map.is-topology .anatomy-svg-node, .anatomy-map.is-topology .anatomy-topology-placeholder",
  );
  await expect(topologyStages).toHaveCount(5);
  const stageCenters = await topologyStages.evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = (node as SVGGElement).getBBox();
      return Math.round(box.y + box.height / 2);
    }),
  );
  expect(new Set(stageCenters).size).toBe(1);

  const firstTopologyNode = page.locator('.anatomy-map.is-topology .anatomy-svg-node').first();
  await expect(firstTopologyNode.locator(".anatomy-node-outline")).toHaveCSS("opacity", "0");
  await page.locator(".anatomy-map.is-topology .anatomy-node-hitbox").first().hover();
  await expect(firstTopologyNode.locator(".anatomy-node-outline")).toHaveCSS("opacity", "1");
  await expect(page.locator(".anatomy-topology-route.is-hovered")).toHaveCount(1);
  const anatomyTransform = await firstTopologyNode.evaluate((node) => {
    const matrix = (node as SVGGElement).transform.baseVal.consolidate()?.matrix;
    return matrix ? { a: matrix.a, d: matrix.d, e: matrix.e } : null;
  });
  expect(anatomyTransform).toMatchObject({ a: 1, d: 1, e: 0 });
  await page.mouse.move(4, 4);
  await expect(firstTopologyNode.locator(".anatomy-node-outline")).toHaveCSS("opacity", "0");

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("topology mode navigation cancels without writes and confirms a replacement topology", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const api = await openMainWindow(page);
  const toggle = page.getByRole("button", { name: "打开拓扑模式菜单" });

  await toggle.click();
  await expect(page.getByRole("button", { name: /Single Agent/ })).toBeDisabled();
  await page.getByRole("button", { name: /RAG Agent/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(api.requests.filter((request) => request.startsWith("POST"))).toHaveLength(0);

  await page.getByRole("button", { name: "稍后再说" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(api.requests.filter((request) => request.startsWith("POST"))).toHaveLength(0);

  await toggle.click();
  await page.getByRole("button", { name: /RAG Agent/ }).click();
  await page.getByRole("button", { name: "确认切换" }).click();
  await expect(page.locator(".main-window")).toHaveAttribute("data-main-window-stage", "settled", { timeout: 20_000 });
  await expect(page.locator(".topology-mode-nav-current")).toHaveText("RAG Agent 模式");
  await expect(page.locator(".topology-overview-graph")).toBeVisible();
  await expect(page.locator("[data-topology-node-id=knowledge_base]")).toBeVisible();
  await expect(page.locator("[data-topology-node-id=planner]")).toHaveCount(0);
  await expect(page.locator(".topology-risk-edge-stroke")).toHaveCount(4);
  expect(api.requests).toContain("POST /api/topology/corpmate-v0");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".main-window-brand-word")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
