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
    page.locator('[data-defense-layer="D1"]'),
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
    const filterArrowBody = filterArrow?.querySelector<SVGPathElement>(
      "[data-d1-filter-arrow-body]",
    );
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
      !filterArrow ||
      !filterArrowBody
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
      arrowBodyCount: filterArrow.querySelectorAll(
        "[data-d1-filter-arrow-body]",
      ).length,
      arrowBodyFilter: filterArrowBody.getAttribute("filter"),
      arrowBodyPath: filterArrowBody.getAttribute("d"),
      arrowHasLegacyMarker: filterArrow.querySelector("marker") !== null,
      arrowHasLegacyMarkerEnd: filterArrow.querySelector("[marker-end]") !== null,
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
  expect(d1Metrics.arrowBodyCount).toBe(1);
  expect(d1Metrics.arrowBodyFilter).toBe("url(#d1-filter-arrow-shadow)");
  expect(d1Metrics.arrowBodyPath?.endsWith("Z")).toBeTruthy();
  expect(d1Metrics.arrowHasLegacyMarker).toBeFalsy();
  expect(d1Metrics.arrowHasLegacyMarkerEnd).toBeFalsy();
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
    page.locator('[data-defense-layer="D1"]'),
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
    const filterArrowBody = filterArrow?.querySelector<SVGPathElement>(
      "[data-d1-filter-arrow-body]",
    );
    if (!root || !panel || !source || !rules || !filterArrow || !filterArrowBody || ruleButtons.length !== 5) {
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
      arrowBodyCount: filterArrow.querySelectorAll(
        "[data-d1-filter-arrow-body]",
      ).length,
      arrowHasLegacyMarker: filterArrow.querySelector("marker") !== null,
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
  expect(metrics.arrowBodyCount).toBe(1);
  expect(metrics.arrowHasLegacyMarker).toBeFalsy();
  expect(metrics.arrowWidth).toBeGreaterThan(24);
});

test("D2 instruction isolation and the tool-call bridge follow the display sequence", async ({
  page,
}) => {
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();

  const next = page.locator(".security-defense-step-button-next");
  const content = page.locator(".security-defense-content");
  await next.click();
  await expect(page.locator('[data-defense-layer="D4"]')).toBeVisible();
  await expect(page.locator(".d2-instruction-isolation-panel")).toBeVisible();
  await expect(page.locator(".d2-prompt-boundary")).toBeVisible();
  await expect(page.locator(".d2-implicit-context")).toBeVisible();
  await expect(page.locator(".d2-source-viewer pre")).toHaveCSS("overflow-y", "auto");
  await expect
    .poll(() => page.locator('.d2-source-viewer [style*="color:"]').count())
    .toBeGreaterThan(2);

  await next.click();
  const bridge = page.locator('[data-defense-bridge="llm-tool-call-bridge"]');
  await expect(bridge).toBeVisible();
  await expect(page.locator(".llm-tool-call-bridge-panel")).toBeVisible();
  await expect(bridge.getByText("LLM 推理", { exact: true })).toBeVisible();
  await expect(bridge.getByText("返回 tool calls", { exact: true })).toBeVisible();

  const branches = [
    ["D5", "因果链检测", 3, "D5"],
    ["D6", "意图分类", 4, "D6"],
    ["D7", "记忆审计", 5, "D7"],
    ["D8", "会话监控", 6, "D8"],
    ["D2", "输出过滤", 7, "D2"],
    ["D3", "确认门控", 8, "D3"],
  ] as const;

  for (const [id, label, displayIndex, canonicalId] of branches) {
    const branchButton = id === "D3"
      ? page.locator(".llm-bridge-confirm-note")
      : page
          .locator(".llm-bridge-stages")
          .getByRole("button", { name: new RegExp(`${id} ${label}`) })
          .first();
    await branchButton.click();
    await expect(
      page.locator(`[data-defense-display-index="${displayIndex}"]`),
    ).toBeVisible();
    await expect(page.locator(`[data-defense-layer="${canonicalId}"]`)).toBeVisible();

    await content.focus();
    for (let index = displayIndex; index > 2; index -= 1) {
      await page.keyboard.press("ArrowLeft");
    }
    await expect(bridge).toBeVisible();
  }

  await content.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator('[data-defense-layer="D4"]')).toBeVisible();
  await expect(page.locator(".llm-tool-call-bridge-panel")).toHaveCount(0);
});

test("D2 reserves a taller flow track and anchors its lower split to the panel boundary", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();

  await page.getByRole("button", { name: "下一层" }).click();
  await expect(page.locator(".d2-instruction-isolation-panel")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".security-profile-page");
    const panel = document.querySelector<HTMLElement>(".d2-instruction-isolation-panel");
    const visual = document.querySelector<HTMLElement>(".d2-isolation-visual");
    const boundary = document.querySelector<HTMLElement>(".d2-prompt-boundary");
    const outcomes = document.querySelector<HTMLElement>(".d2-flow-outcomes");
    const lower = document.querySelector<HTMLElement>(".d2-detail-lower");
    const source = document.querySelector<HTMLElement>(".d2-source-viewer pre");
    const rules = document.querySelector<HTMLElement>(".d2-rule-viewer");
    const ruleButtons = Array.from(document.querySelectorAll<HTMLElement>(".d2-rule-viewer button"));
    if (!root || !panel || !visual || !boundary || !outcomes || !lower || !source || !rules || ruleButtons.length === 0) {
      throw new Error("D2 detail workspace is incomplete");
    }

    const panelRect = panel.getBoundingClientRect();
    const visualRect = visual.getBoundingClientRect();
    const boundaryRect = boundary.getBoundingClientRect();
    const outcomesRect = outcomes.getBoundingClientRect();
    const lowerRect = lower.getBoundingClientRect();
    return {
      pageOverflow: root.scrollHeight - root.clientHeight,
      panelOverflow: panel.scrollHeight - panel.clientHeight,
      sourceOverflowY: getComputedStyle(source).overflowY,
      rulesOverflowY: getComputedStyle(rules).overflowY,
      visualHeight: visualRect.height,
      boundaryTop: boundaryRect.top,
      boundaryBottom: boundaryRect.bottom,
      boundaryRight: boundaryRect.right,
      outcomesTop: outcomesRect.top,
      outcomesBottom: outcomesRect.bottom,
      outcomesRight: outcomesRect.right,
      boundaryZIndex: getComputedStyle(boundary).zIndex,
      outcomesZIndex: getComputedStyle(outcomes).zIndex,
      allowedBackground: getComputedStyle(document.querySelector<HTMLElement>(".d2-outcome.is-allowed")!).backgroundColor,
      blockedBackground: getComputedStyle(document.querySelector<HTMLElement>(".d2-outcome.is-blocked")!).backgroundColor,
      syntaxColorCount: new Set(Array.from(document.querySelectorAll<HTMLElement>('.d2-source-viewer [style*="color:"]')).map((node) => node.style.color)).size,
      lowerBottomInset: panelRect.bottom - lowerRect.bottom,
      minRuleHeight: Math.min(...ruleButtons.map((button) => button.getBoundingClientRect().height)),
    };
  });

  expect(metrics.pageOverflow).toBeLessThanOrEqual(1);
  expect(metrics.panelOverflow).toBeLessThanOrEqual(1);
  expect(metrics.sourceOverflowY).toBe("auto");
  expect(metrics.rulesOverflowY).toBe("hidden");
  expect(metrics.visualHeight).toBeGreaterThanOrEqual(196);
  expect(metrics.boundaryTop).toBeLessThan(metrics.outcomesTop);
  expect(metrics.boundaryBottom).toBeGreaterThan(metrics.outcomesBottom);
  expect(metrics.boundaryRight - metrics.outcomesRight).toBeGreaterThanOrEqual(6);
  expect(Number(metrics.outcomesZIndex)).toBeGreaterThan(Number(metrics.boundaryZIndex));
  expect(metrics.allowedBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(metrics.blockedBackground).not.toBe("rgba(0, 0, 0, 0)");
  expect(metrics.syntaxColorCount).toBeGreaterThan(2);
  expect(metrics.lowerBottomInset).toBeLessThanOrEqual(4);
  expect(metrics.minRuleHeight).toBeGreaterThanOrEqual(30);
});

test("D2 and bridge keep the fixed viewport at 900px", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();

  const next = page.locator(".security-defense-step-button-next");
  await next.click();
  await expect(page.locator(".d2-instruction-isolation-panel")).toBeVisible();

  const d2Metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".security-profile-page");
    const panel = document.querySelector<HTMLElement>(".d2-instruction-isolation-panel");
    const visual = document.querySelector<HTMLElement>(".d2-isolation-visual");
    const lower = document.querySelector<HTMLElement>(".d2-detail-lower");
    const source = document.querySelector<HTMLElement>(".d2-source-viewer pre");
    const rules = document.querySelector<HTMLElement>(".d2-rule-viewer");
    const ruleButtons = Array.from(document.querySelectorAll<HTMLElement>(".d2-rule-viewer button"));
    if (!root || !panel || !visual || !lower || !source || !rules || ruleButtons.length === 0) {
      throw new Error("D2 narrow viewport structure is missing");
    }

    const panelRect = panel.getBoundingClientRect();
    const visualRect = visual.getBoundingClientRect();
    const lowerRect = lower.getBoundingClientRect();
    return {
      pageOverflow: root.scrollHeight - root.clientHeight,
      panelOverflow: panel.scrollHeight - panel.clientHeight,
      sourceOverflowY: getComputedStyle(source).overflowY,
      rulesOverflowY: getComputedStyle(rules).overflowY,
      visualHeight: visualRect.height,
      lowerBottomInset: panelRect.bottom - lowerRect.bottom,
      minRuleHeight: Math.min(...ruleButtons.map((button) => button.getBoundingClientRect().height)),
    };
  });

  expect(d2Metrics.pageOverflow, JSON.stringify(d2Metrics)).toBeLessThanOrEqual(1);
  expect(d2Metrics.panelOverflow, JSON.stringify(d2Metrics)).toBeLessThanOrEqual(1);
  expect(d2Metrics.sourceOverflowY).toBe("auto");
  expect(d2Metrics.rulesOverflowY).toBe("hidden");
  expect(d2Metrics.visualHeight).toBeGreaterThanOrEqual(176);
  expect(d2Metrics.lowerBottomInset).toBeLessThanOrEqual(4);
  expect(d2Metrics.minRuleHeight).toBeGreaterThanOrEqual(27);

  await next.click();
  await expect(page.locator(".llm-tool-call-bridge-panel")).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".security-profile-page");
    const panel = document.querySelector<HTMLElement>(".llm-tool-call-bridge-panel");
    const source = document.querySelector<HTMLElement>(".bridge-source-viewer pre");
    const explanation = document.querySelector<HTMLElement>(".bridge-explanation");
    if (!root || !panel || !source || !explanation) {
      throw new Error("bridge narrow viewport structure is missing");
    }
    return {
      rootScrollHeight: root.scrollHeight,
      rootClientHeight: root.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      panelClientHeight: panel.clientHeight,
      panelOverflowY: getComputedStyle(panel).overflowY,
      sourceOverflowY: getComputedStyle(source).overflowY,
      explanationOverflowY: getComputedStyle(explanation).overflowY,
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
  expect(metrics.explanationOverflowY).toBe("hidden");
});
