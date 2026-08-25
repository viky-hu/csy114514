import { expect, test, type Page } from "@playwright/test";

async function enterMockPlatform(page: Page) {
  await page.goto("/?evaluationMock=1");

  const root = page.locator(".login-placeholder-page");
  const hitArea = page.locator(".login-placeholder-hitarea");
  await expect(root).toHaveAttribute("data-panel-stage", "idle");

  const box = await hitArea.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect(root).toHaveAttribute("data-panel-stage", "open");
  await page.getByRole("button", { name: "进入平台" }).click();
  await expect(root).toHaveAttribute("data-scroll-ready", "true");
  await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "auto" }));
  await page.getByRole("button", { name: "稍后再说" }).click();
  await expect(page.locator(".main-window")).toBeVisible({ timeout: 12_000 });
}

test("completed comparison can return and create a normal batch run", async ({ page }) => {
  await enterMockPlatform(page);

  await page.getByRole("button", { name: "测评运行 执行流程" }).click();
  await expect(page.locator(".evaluation-selector")).toBeVisible();

  await page.getByLabel("Agent 类型").selectOption("comparison");
  await page.getByRole("button", { name: /开始批量对比/ }).click();

  const startComparison = page.getByRole("button", { name: "开始测评", exact: true });
  await expect(startComparison).toBeVisible();
  await startComparison.click();
  await expect(page.getByRole("button", { name: "对比报告", exact: true })).toBeVisible({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "返回选择 TestCase", exact: true }).click();

  const startNormalBatch = page.getByRole("button", { name: /开始批量测评/ });
  await expect(startNormalBatch).toBeVisible();
  await expect(startNormalBatch).toBeEnabled();
  await startNormalBatch.click();

  await expect(page.locator(".evaluation-run-page.is-batch")).toBeVisible();
  await expect(page.locator(".evaluation-batch-panel")).toBeVisible();
});
