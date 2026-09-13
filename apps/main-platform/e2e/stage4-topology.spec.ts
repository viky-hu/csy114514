import { expect, test, type Page } from "@playwright/test";

const plannerTopology = {
  agent_id: "corpmate-v0",
  topology_type: "planner_executor",
  nodes: [
    { id: "planner", role: "PLANNER", tools: [], trust_boundary: "internal" },
    { id: "executor", role: "EXECUTOR", tools: ["email.send"], trust_boundary: "internal" },
    { id: "browser", role: "AGENT", tools: ["browser.open_page"], trust_boundary: "external" },
  ],
  edges: [
    { from_node: "browser", to_node: "planner", channel: "task_plan", carries_untrusted_content: true },
    { from_node: "planner", to_node: "executor", channel: "task_plan", carries_untrusted_content: false },
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
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const requestKey = `${route.request().method()} ${url.pathname}`;
    requests.push(requestKey);
    if (url.pathname === "/api/topology/corpmate-v0") {
      const presetName =
        route.request().method() === "POST"
          ? (route.request().postDataJSON()?.preset_name ?? "single")
          : "single";
      const body =
        presetName === "rag_agent"
          ? ragTopology
          : presetName === "planner_executor"
            ? plannerTopology
            : singleTopology;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      return;
    }
    if (url.pathname === "/api/agents" && route.request().method() === "POST") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      return;
    }
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "BACKEND_UNAVAILABLE", message: "Backend unavailable in test" } }) });
  });

  await page.goto("/");
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

  await expect(page.locator(".topology-summary")).toBeVisible();
  await expect(page.locator(".topology-summary")).toContainText("Planner–Executor");
  await expect(page.locator(".topology-summary")).toContainText("不可信通道");

  await page.getByRole("button", { name: /安全画像/ }).click();
  await expect(page.getByRole("region", { name: "安全画像", exact: true })).toBeVisible({ timeout: 5_000 });
  // The caption stays readable while the raw backend channel stays inspectable.
  await expect(page.locator(".security-profile-route-label").first()).toHaveText("TASK PLAN");
  await expect(
    page.locator('.security-profile-route[data-profile-route-channel="task_plan"]').first(),
  ).toBeAttached();

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("topology mode navigation cancels without writes and confirms a replacement topology", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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
  await expect(page.locator(".topology-summary")).toContainText("RAG Agent");
  expect(api.requests).toContain("POST /api/topology/corpmate-v0");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".main-window-brand-word")).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
