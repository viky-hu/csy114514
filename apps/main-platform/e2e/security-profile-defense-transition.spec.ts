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

test("security profile enters on page one and resets after interrupted navigation", async ({
  page,
}) => {
  await openMainWindow(page);

  await page.getByRole("button", { name: /安全画像/ }).click();
  const profileScreen = page.locator(".security-profile-profile-screen");
  const defenseScreen = page.locator(".security-profile-defense-screen");
  await expect(profileScreen).toHaveAttribute("aria-hidden", "false");
  await expect(defenseScreen).toHaveAttribute("aria-hidden", "true");

  const viewportMetrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".security-profile-page");
    const track = document.querySelector<HTMLElement>(".security-profile-page-track");
    if (!root || !track) {
      throw new Error("security profile screen stack is missing");
    }
    return {
      rootHeight: root.getBoundingClientRect().height,
      trackHeight: track.getBoundingClientRect().height,
    };
  });
  expect(Math.abs(viewportMetrics.rootHeight - viewportMetrics.trackHeight)).toBeLessThan(2);

  await page.getByRole("button", { name: "进入防御机制可视化" }).click();
  await expect(defenseScreen).toHaveAttribute("aria-hidden", "false");
  await expect(
    page.locator('[data-defense-layer="D1"][aria-hidden="false"]'),
  ).toBeVisible();

  const d1Panel = page.locator(".d1-input-filter-panel");
  await expect(d1Panel).toBeVisible();
  await expect(page.locator(".d1-comparison-pane")).toHaveCount(2);
  await expect(page.locator(".d1-source-viewer")).toBeVisible();
  await expect(page.locator(".d1-rule-list")).toBeVisible();

  const d1Metrics = await page.evaluate(() => {
    const pageRoot = document.querySelector<HTMLElement>(".security-profile-page");
    const track = document.querySelector<HTMLElement>(".security-profile-page-track");
    const region = document.querySelector<HTMLElement>(".security-defense-region");
    const flow = document.querySelector<HTMLElement>(".security-defense-flow");
    const workspace = document.querySelector<HTMLElement>(".security-defense-workspace");
    const content = document.querySelector<HTMLElement>(".security-defense-content");
    const panel = document.querySelector<HTMLElement>(".d1-input-filter-panel");
    const comparison = document.querySelector<HTMLElement>(".d1-input-filter-comparison");
    const comparisonPanes = Array.from(
      document.querySelectorAll<HTMLElement>(".d1-comparison-pane"),
    );
    const lower = document.querySelector<HTMLElement>(".d1-input-filter-lower");
    const sourceViewer = document.querySelector<HTMLElement>(".d1-source-viewer");
    const source = document.querySelector<HTMLElement>(".d1-source-code");
    const microscope = document.querySelector<HTMLElement>(".d1-sanitization-microscope");
    const filterArrow = document.querySelector<SVGSVGElement>(".d1-filter-arrow");
    if (
      !pageRoot ||
      !track ||
      !region ||
      !flow ||
      !workspace ||
      !content ||
      !panel ||
      !comparison ||
      comparisonPanes.length !== 2 ||
      !lower ||
      !sourceViewer ||
      !source ||
      !microscope ||
      !filterArrow
    ) {
      throw new Error("D1 fixed viewport structure is missing");
    }
    const box = (node: HTMLElement) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        top: Math.round(rect.top),
        height: Math.round(rect.height),
        scrollHeight: node.scrollHeight,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        overflowY: style.overflowY,
      };
    };
    return {
      pageClientHeight: pageRoot.clientHeight,
      pageScrollHeight: pageRoot.scrollHeight,
      track: box(track),
      region: box(region),
      flow: box(flow),
      workspace: box(workspace),
      content: box(content),
      comparison: box(comparison),
      lower: box(lower),
      panelClientHeight: panel.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      panelOverflowY: getComputedStyle(panel).overflowY,
      sourceClientHeight: source.clientHeight,
      sourceScrollHeight: source.scrollHeight,
      sourceOverflowY: getComputedStyle(source).overflowY,
      microscope: box(microscope),
      regionBorderLeft: getComputedStyle(region).borderLeftStyle,
      regionBorderRight: getComputedStyle(region).borderRightStyle,
      comparisonLeftPane: box(comparisonPanes[0]!),
      comparisonRightPane: box(comparisonPanes[1]!),
      sourceViewer: box(sourceViewer),
      sourceLeft: Math.round(sourceViewer.getBoundingClientRect().left),
      sourceRight: Math.round(sourceViewer.getBoundingClientRect().right),
      microscopeLeft: Math.round(microscope.getBoundingClientRect().left),
      microscopeRight: Math.round(microscope.getBoundingClientRect().right),
      inputPaneLeft: Math.round(comparisonPanes[0]!.getBoundingClientRect().left),
      inputPaneRight: Math.round(comparisonPanes[0]!.getBoundingClientRect().right),
      outputPaneLeft: Math.round(comparisonPanes[1]!.getBoundingClientRect().left),
      outputPaneRight: Math.round(comparisonPanes[1]!.getBoundingClientRect().right),
      arrowCenterX: Math.round(
        filterArrow.getBoundingClientRect().left +
          filterArrow.getBoundingClientRect().width / 2,
      ),
      gridCenterX: Math.round(
        comparison.getBoundingClientRect().left +
          comparison.getBoundingClientRect().width / 2,
      ),
    };
  });
  expect(
    d1Metrics.pageScrollHeight,
    JSON.stringify(d1Metrics),
  ).toBeLessThanOrEqual(d1Metrics.pageClientHeight + 1);
  expect(
    d1Metrics.panelScrollHeight,
    JSON.stringify(d1Metrics),
  ).toBeLessThanOrEqual(d1Metrics.panelClientHeight + 1);
  expect(d1Metrics.panelOverflowY).toBe("hidden");
  expect(d1Metrics.sourceOverflowY).toBe("auto");
  expect(d1Metrics.sourceScrollHeight).toBeGreaterThan(
    d1Metrics.sourceClientHeight,
  );
  expect(d1Metrics.regionBorderLeft).toBe("solid");
  expect(d1Metrics.regionBorderRight).toBe("solid");
  expect(Math.abs(d1Metrics.sourceLeft - d1Metrics.inputPaneLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(d1Metrics.sourceRight - d1Metrics.inputPaneRight)).toBeLessThanOrEqual(1);
  expect(Math.abs(d1Metrics.microscopeLeft - d1Metrics.outputPaneLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(d1Metrics.microscopeRight - d1Metrics.outputPaneRight)).toBeLessThanOrEqual(1);
  expect(Math.abs(d1Metrics.arrowCenterX - d1Metrics.gridCenterX)).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "返回安全画像" }).click();
  await expect(profileScreen).toHaveAttribute("aria-hidden", "false");
  await expect(defenseScreen).toHaveAttribute("aria-hidden", "true");
  await expect(profileScreen).toBeVisible();

  await page.getByRole("button", { name: "进入防御机制可视化" }).click();
  await page.waitForTimeout(80);
  await page.getByRole("button", { name: /总览/ }).click();
  await expect(page.locator(".overview-dashboard")).toBeVisible();
  await page.getByRole("button", { name: /安全画像/ }).click();
  await expect(page.locator(".security-profile-profile-screen")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(page.locator(".security-profile-defense-screen")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".security-profile-profile-screen")).toBeVisible();
});

test("D1 keeps its fixed viewport layout at a narrow width", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await openMainWindow(page);

  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();
  await expect(
    page.locator('[data-defense-layer="D1"][aria-hidden="false"]'),
  ).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".security-profile-page");
    const panel = document.querySelector<HTMLElement>(".d1-input-filter-panel");
    const source = document.querySelector<HTMLElement>(".d1-source-code");
    const rules = document.querySelector<HTMLElement>(".d1-rule-list");
    const ruleButtons = Array.from(
      document.querySelectorAll<HTMLElement>(".d1-rule-entry"),
    );
    const comparison = document.querySelector<HTMLElement>(".d1-input-filter-comparison");
    const lower = document.querySelector<HTMLElement>(".d1-input-filter-lower");
    const microscope = document.querySelector<HTMLElement>(".d1-sanitization-microscope");
    const filterArrow = document.querySelector<SVGSVGElement>(".d1-filter-arrow");
    if (!root || !panel || !source || !rules || !filterArrow || ruleButtons.length !== 5) {
      throw new Error("narrow D1 layout is missing");
    }
    return {
      rootScrollHeight: root.scrollHeight,
      rootClientHeight: root.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      panelClientHeight: panel.clientHeight,
      panelOverflowY: getComputedStyle(panel).overflowY,
      sourceOverflowY: getComputedStyle(source).overflowY,
      rulesOverflowY: getComputedStyle(rules).overflowY,
      comparisonHeight: comparison?.getBoundingClientRect().height,
      lowerHeight: lower?.getBoundingClientRect().height,
      microscopeScrollHeight: microscope?.scrollHeight,
      rulesScrollHeight: rules.scrollHeight,
      minRuleHeight: Math.min(
        ...ruleButtons.map((button) => button.getBoundingClientRect().height),
      ),
      arrowWidth: filterArrow.getBoundingClientRect().width,
    };
  });

  expect(metrics.rootScrollHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.rootClientHeight + 1,
  );
  expect(metrics.panelScrollHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.panelClientHeight + 1,
  );
  expect(metrics.panelOverflowY).toBe("hidden");
  expect(metrics.sourceOverflowY).toBe("auto");
  expect(metrics.rulesOverflowY).toBe("visible");
  expect(metrics.minRuleHeight).toBeGreaterThanOrEqual(42);
  expect(metrics.arrowWidth).toBeGreaterThan(24);
});
