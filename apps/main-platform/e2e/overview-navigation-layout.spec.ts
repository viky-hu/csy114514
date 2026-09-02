import { expect, test, type Page } from "@playwright/test";

async function openMainWindow(page: Page) {
  await page.route("**/api/**", (route) =>
    route.fulfill({
      body: JSON.stringify({
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "Backend unavailable in this test",
        },
      }),
      contentType: "application/json",
      status: 503,
    }),
  );

  await page.goto("/");
  const hitArea = page.locator(".login-placeholder-hitarea");
  const hitAreaBox = await hitArea.boundingBox();
  expect(hitAreaBox).not.toBeNull();

  await page.mouse.click(
    hitAreaBox!.x + hitAreaBox!.width / 2,
    hitAreaBox!.y + hitAreaBox!.height / 2,
  );
  await page.getByRole("button", { name: "进入平台" }).click();
  await expect(page.locator(".login-placeholder-page")).toHaveAttribute(
    "data-scroll-ready",
    "true",
  );
  await page.evaluate(() =>
    window.scrollTo({ top: window.innerHeight, behavior: "auto" }),
  );
  await page.getByRole("button", { name: "稍后再说" }).click();
  await expect(page.locator(".main-window")).toHaveAttribute(
    "data-main-window-stage",
    "settled",
    { timeout: 20_000 },
  );
}

async function readOverviewLayoutMetrics(page: Page) {
  return page.evaluate(() => {
    const dashboard = document.querySelector<HTMLElement>(".overview-dashboard");
    const content = document.querySelector<HTMLElement>(".main-content-region");

    if (!dashboard || !content) {
      throw new Error("Overview layout metrics targets are missing");
    }

    return {
      contentWidth: content.getBoundingClientRect().width,
      dashboardClientHeight: dashboard.clientHeight,
      dashboardScrollHeight: dashboard.scrollHeight,
      dashboardOverflowY: getComputedStyle(dashboard).overflowY,
      dashboardPaddingRight: getComputedStyle(dashboard).paddingRight,
      dashboardScrollbarWidth: dashboard.offsetWidth - dashboard.clientWidth,
    };
  });
}

test("returning to overview never introduces a vertical scrollbar or width shift", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openMainWindow(page);

  const initial = await readOverviewLayoutMetrics(page);

  await page.getByRole("button", { name: /测评运行/ }).click();
  await expect(page.getByRole("region", { name: "测评运行工作台" })).toBeVisible({
    timeout: 5_000,
  });

  await page.getByRole("button", { name: /总览/ }).click();
  await expect(page.getByRole("region", { name: "总览页" })).toBeVisible({
    timeout: 5_000,
  });
  await page.waitForTimeout(700);

  const returned = await readOverviewLayoutMetrics(page);

  expect(returned.dashboardScrollHeight).toBeLessThanOrEqual(
    returned.dashboardClientHeight + 1,
  );
  expect(returned.dashboardOverflowY).toBe("hidden");
  expect(returned.dashboardPaddingRight).toBe("0px");
  expect(returned.dashboardScrollbarWidth).toBe(0);
  expect(returned.contentWidth).toBeCloseTo(initial.contentWidth, 0);
});
