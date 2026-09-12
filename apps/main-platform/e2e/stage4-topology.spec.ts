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

async function openMainWindow(page: Page) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/topology/corpmate-v0") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(plannerTopology) });
      return;
    }
    if (url.pathname === "/api/topology/presets") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ topology_type: "planner_executor", description: "规划与执行分离", node_count: 3, edge_count: 2 }]) });
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
}

test("planner-executor topology renders shared flow on overview and profile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMainWindow(page);

  await expect(page.getByRole("region", { name: "总览页" })).toBeVisible();
  await expect(page.locator(".topology-flow")).toBeVisible();
  await expect(page.getByRole("button", { name: /规划器 planner/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /执行器 executor/ })).toBeVisible();
  await expect(page.locator(".topology-flow").locator(".react-flow__edge-path")).toHaveCount(2);

  await page.getByRole("button", { name: /安全画像/ }).click();
  await expect(page.getByRole("region", { name: "安全画像", exact: true })).toBeVisible({ timeout: 5_000 });
  await expect(page.locator(".security-profile-topology .topology-flow")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});