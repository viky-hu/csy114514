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
  await expect(page.locator(".defense-source-viewer pre")).toHaveCSS("overflow-y", "auto");
  await expect
    .poll(() => page.locator('.defense-source-viewer [style*="color:"]').count())
    .toBeGreaterThan(2);

  await next.click();
  const bridge = page.locator('[data-defense-bridge="llm-tool-call-bridge"]');
  await expect(bridge).toBeVisible();
  await expect(page.locator(".llm-tool-call-bridge-panel")).toBeVisible();
  await expect(bridge.getByText("D2 指令交接", { exact: true })).toBeVisible();
  await expect(bridge.getByText("LLM 推理", { exact: true })).toBeVisible();
  await expect(bridge.getByText("返回 tool calls", { exact: true })).toHaveCount(0);
  await expect(bridge.getByText("email.send", { exact: true })).toBeVisible();
  await expect(bridge.getByText("call_email_017", { exact: true })).toBeVisible();
  await expect(bridge.getByText("待审", { exact: true })).toBeVisible();
  await expect(bridge.locator(".llm-bridge-check-stage")).toHaveCount(5);
  await expect(bridge.locator(".llm-bridge-blocked")).toHaveCount(5);
  await expect(bridge.locator(".llm-bridge-no-path")).toHaveCount(5);
  await expect(bridge.getByText("Sandbox 执行 tool call", { exact: true })).toBeVisible();
  await expect(bridge.getByText("D8 确认门控", { exact: true })).toBeVisible();

  const branches = [
    ["D3", "因果链检测", 3, "D5"],
    ["D4", "意图分类", 4, "D6"],
    ["D5", "记忆审计", 5, "D7"],
    ["D6", "会话监控", 6, "D8"],
    ["D7", "输出过滤", 7, "D2"],
    ["D8", "确认门控", 8, "D3"],
  ] as const;

  for (const [id, label, displayIndex, canonicalId] of branches) {
    const branchButton = id === "D8"
      ? bridge.locator(".llm-bridge-confirm")
      : bridge
          .locator(".llm-bridge-check-stage")
          .filter({ hasText: label })
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
    const source = document.querySelector<HTMLElement>(".defense-source-viewer pre");
    const rules = document.querySelector<HTMLElement>(".defense-rule-list");
    const ruleButtons = Array.from(document.querySelectorAll<HTMLElement>(".defense-rule-list button"));
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
      syntaxColorCount: new Set(Array.from(document.querySelectorAll<HTMLElement>('.defense-source-viewer [style*="color:"]')).map((node) => node.style.color)).size,
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

test("D2 and bridge keep the fixed viewport at 900px without horizontal overflow", async ({ page }) => {
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
    const source = document.querySelector<HTMLElement>(".defense-source-viewer pre");
    const rules = document.querySelector<HTMLElement>(".defense-rule-list");
    const ruleButtons = Array.from(document.querySelectorAll<HTMLElement>(".defense-rule-list button"));
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
    const canvas = document.querySelector<HTMLElement>(".llm-bridge-canvas");
    const canvasInner = document.querySelector<HTMLElement>(".llm-bridge-canvas-inner");
    const checks = document.querySelector<HTMLElement>(".llm-bridge-checks");
    if (!root || !panel || !canvas || !canvasInner || !checks) {
      throw new Error("bridge narrow viewport structure is missing");
    }
    return {
      rootScrollHeight: root.scrollHeight,
      rootClientHeight: root.clientHeight,
      panelScrollHeight: panel.scrollHeight,
      panelClientHeight: panel.clientHeight,
      panelOverflowY: getComputedStyle(panel).overflowY,
      canvasOverflowX: getComputedStyle(canvas).overflowX,
      canvasOverflowY: getComputedStyle(canvas).overflowY,
      canvasScrollWidth: canvas.scrollWidth,
      canvasClientWidth: canvas.clientWidth,
      canvasInnerMinWidth: getComputedStyle(canvasInner).minWidth,
      checksWidth: checks.getBoundingClientRect().width,
      checkCount: checks.querySelectorAll(".llm-bridge-check-stage").length,
    };
  });

  expect(metrics.rootScrollHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.rootClientHeight + 1,
  );
  expect(metrics.panelScrollHeight, JSON.stringify(metrics)).toBeLessThanOrEqual(
    metrics.panelClientHeight + 1,
  );
  expect(metrics.panelOverflowY).toBe("hidden");
  expect(metrics.canvasOverflowX).toBe("auto");
  expect(metrics.canvasOverflowY).toBe("hidden");
  expect(metrics.canvasScrollWidth).toBeLessThanOrEqual(metrics.canvasClientWidth + 1);
  expect(metrics.canvasInnerMinWidth).toBe('0px');
  expect(metrics.checksWidth).toBeLessThanOrEqual(metrics.canvasClientWidth + 1);
  expect(metrics.checkCount).toBe(5);
});

test("bridge canvas shows its final state under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();

  const next = page.getByRole("button", { name: "下一层" });
  await next.click();
  await next.click();

  const bridge = page.locator(".llm-tool-call-bridge-panel");
  await expect(bridge).toBeVisible();
  await expect(bridge.locator(".llm-bridge-handoff")).toBeVisible();
  await expect(bridge.locator(".llm-bridge-reasoning")).toBeVisible();
  await expect(bridge.locator(".llm-bridge-tool-call")).toBeVisible();
  await expect(bridge.locator(".llm-bridge-check-stage")).toHaveCount(5);
  await expect(bridge.locator(".llm-bridge-sandbox")).toBeVisible();

  const animationState = await bridge.evaluate((node) => {
    const animatedNodes = Array.from(
      node.querySelectorAll<HTMLElement>("[data-bridge-animate]"),
    );
    const routes = Array.from(
      node.querySelectorAll<SVGPathElement>(".llm-bridge-route"),
    );
    return {
      hiddenNodes: animatedNodes.filter((item) => getComputedStyle(item).opacity === "0").length,
      hiddenRoutes: routes.filter((item) => getComputedStyle(item).visibility === "hidden").length,
    };
  });

  expect(animationState.hiddenNodes).toBe(0);
  expect(animationState.hiddenRoutes).toBe(0);
});
test("bridge canvas keeps its left rail and measured per-call fan-out geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();
  await page.getByRole("button", { name: "下一层" }).click();
  await page.getByRole("button", { name: "下一层" }).click();

  const bridge = page.locator(".llm-tool-call-bridge-panel");
  await expect(bridge).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 900, height: 700 },
    { width: 560, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(bridge).toBeVisible();
    await page.waitForTimeout(500);

    const metrics = await bridge.evaluate((node) => {
      type Rect = { left: number; top: number; right: number; bottom: number };
      const toRect = (item: Element): Rect => {
        const value = item.getBoundingClientRect();
        return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
      };
      const overlaps = (a: Rect, b: Rect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const queryRect = (selector: string) => {
        const item = node.querySelector(selector);
        if (!item) throw new Error(`missing ${selector}`);
        return toRect(item);
      };
      const rowRects = Array.from(node.querySelectorAll(".llm-bridge-check-row"), toRect);
      const majorRects = [
        queryRect(".llm-bridge-handoff"),
        queryRect(".llm-bridge-reasoning"),
        queryRect(".llm-bridge-tool-call"),
        queryRect(".llm-bridge-checks"),
        queryRect(".llm-bridge-bottom"),
      ];
      const transitionBand = queryRect(".llm-bridge-connector-row");
      const longArrow = queryRect(".llm-bridge-stage-arrow-long");
      const stageRects = Array.from(node.querySelectorAll(".llm-bridge-check-stage"), toRect);
      const decisionRects = Array.from(node.querySelectorAll(".llm-bridge-decision"), toRect);
      const blockedRects = Array.from(node.querySelectorAll(".llm-bridge-blocked"), toRect);
      const stageRailRects = Array.from(node.querySelectorAll(".llm-bridge-stage-rail"), toRect);
      const perCallRect = queryRect(".llm-bridge-per-call-body");
      const reasoningCore = queryRect(".llm-bridge-reasoning-core");
      const reasoningSteps = Array.from(node.querySelectorAll<HTMLElement>(".llm-bridge-reasoning-step"), (item) => ({
        className: item.className,
        rect: toRect(item),
      }));
      const root = document.querySelector<HTMLElement>(".security-profile-page");
      const panel = node as HTMLElement;
      const canvas = node.querySelector<HTMLElement>(".llm-bridge-canvas");
      const canvasInner = node.querySelector<HTMLElement>(".llm-bridge-canvas-inner");
      if (!root || !canvas || !canvasInner) throw new Error("bridge geometry root is missing");
      const horizontalOverflow = [
        ["page", root],
        ["track", document.querySelector<HTMLElement>(".security-profile-page-track")],
        ["screen", document.querySelector<HTMLElement>(".security-defense-screen")],
        ["region", document.querySelector<HTMLElement>(".security-defense-region")],
        ["workspace", document.querySelector<HTMLElement>(".security-defense-workspace")],
        ["content", document.querySelector<HTMLElement>(".security-defense-content")],
        ["panel", panel],
        ["canvas", canvas],
      ].map(([name, item]) => {
        const element = item as HTMLElement | null;
        return {
          name,
          clientWidth: element?.clientWidth ?? 0,
          scrollWidth: element?.scrollWidth ?? 0,
        };
      });
      const innerRect = canvasInner.getBoundingClientRect();
      const pointFor = (selector: string) => {
        const item = node.querySelector<HTMLElement>(selector);
        if (!item) throw new Error(`missing ${selector}`);
        const rect = item.getBoundingClientRect();
        return { x: rect.left + rect.width / 2 - innerRect.left, y: rect.top + rect.height / 2 - innerRect.top };
      };
      const perCallOut = pointFor('[data-bridge-anchor="per-call-out"]');
      const checkInputs = ["D3", "D4", "D5", "D6", "D7"].map((id) =>
        pointFor(`[data-bridge-anchor="check-${id}-in"]`),
      );
      const branchRoutes = Array.from(
        node.querySelectorAll<SVGPathElement>(".llm-bridge-route:not(.llm-bridge-route-no)"),
        (route) => route.getAttribute("d") ?? "",
      );
      return {
        rowRects,
        majorRects,
        transitionBand,
        longArrow,
        stageRects,
        decisionRects,
        blockedRects,
        stageRailRects,
        perCallRect,
        reasoningCore,
        reasoningSteps,
        rootScrollHeight: root.scrollHeight,
        rootClientHeight: root.clientHeight,
        panelScrollHeight: panel.scrollHeight,
        panelClientHeight: panel.clientHeight,
        canvasOverflowX: getComputedStyle(canvas).overflowX,
        canvasOverflowY: getComputedStyle(canvas).overflowY,
        canvasInnerWidth: canvasInner.getBoundingClientRect().width,
        canvasClientWidth: canvas.clientWidth,
        canvasScrollWidth: canvas.scrollWidth,
        horizontalOverflow,
        canvasBottom: innerRect.bottom,
        perCallOut,
        checkInputs,
        branchRoutes,
        checkStageDecisionOverlap: stageRects.some((item, index) => overlaps(item, decisionRects[index]!)),
        checkDecisionBlockedOverlap: decisionRects.some((item, index) => overlaps(item, blockedRects[index]!)),
      };
    });

    expect(metrics.rowRects).toHaveLength(5);
    for (let index = 1; index < metrics.rowRects.length; index += 1) {
      expect(metrics.rowRects[index]!.top).toBeGreaterThan(metrics.rowRects[index - 1]!.top);
      expect(metrics.rowRects[index - 1]!.bottom).toBeLessThanOrEqual(metrics.rowRects[index]!.top + 0.5);
    }
    for (let index = 1; index < metrics.majorRects.length; index += 1) {
      expect(metrics.majorRects[index - 1]!.bottom).toBeLessThanOrEqual(metrics.majorRects[index]!.top + 0.5);
    }
    const transitionBandLimit = viewport.width <= 700 ? 30 : viewport.width <= 1100 ? 40 : 48;
    expect(metrics.transitionBand.bottom - metrics.transitionBand.top).toBeLessThanOrEqual(transitionBandLimit);
    expect(metrics.transitionBand.top - metrics.majorRects[2]!.bottom).toBeLessThanOrEqual(6);
    expect(metrics.majorRects[3]!.top - metrics.transitionBand.bottom).toBeLessThanOrEqual(6);
    expect(metrics.longArrow.top).toBeCloseTo(metrics.transitionBand.top, 0);
    expect(metrics.longArrow.bottom).toBeGreaterThanOrEqual(metrics.perCallRect.top - 6);
    expect(metrics.longArrow.bottom).toBeLessThanOrEqual(metrics.perCallRect.top + 8);
    for (let index = 0; index < 5; index += 1) {
      expect(metrics.stageRects[index]!.right).toBeLessThanOrEqual(metrics.decisionRects[index]!.left + 0.5);
      expect(metrics.decisionRects[index]!.right).toBeLessThanOrEqual(metrics.blockedRects[index]!.left + 0.5);
    }
    expect(metrics.stageRailRects).toHaveLength(4);
    expect(metrics.perCallRect.right).toBeLessThanOrEqual(metrics.stageRects[0]!.left + 0.5);
    const checksMidpoint = (metrics.stageRects[0]!.top + metrics.stageRects[4]!.bottom) / 2;
    const perCallMidpoint = (metrics.perCallRect.top + metrics.perCallRect.bottom) / 2;
    expect(Math.abs(perCallMidpoint - checksMidpoint)).toBeLessThanOrEqual(10);
    expect(metrics.canvasInnerWidth).toBeLessThanOrEqual(metrics.canvasClientWidth + 1);
    expect(metrics.canvasScrollWidth).toBeLessThanOrEqual(metrics.canvasClientWidth + 1);
    expect(Math.max(...metrics.majorRects.map((item) => item.bottom))).toBeLessThanOrEqual(metrics.canvasBottom + 0.5);
    expect(metrics.branchRoutes).toHaveLength(5);
    metrics.branchRoutes.forEach((route, index) => {
      const parts = route.match(/^M ([\d.]+) ([\d.]+) H ([\d.]+) V ([\d.]+) H ([\d.]+)$/);
      expect(parts, route).not.toBeNull();
      const [, startX, startY, trunkX, endY, endX] = parts!;
      expect(Number(startX)).toBeCloseTo(metrics.perCallOut.x, 0);
      expect(Number(startY)).toBeCloseTo(metrics.perCallOut.y, 0);
      expect(Number(endX)).toBeCloseTo(metrics.checkInputs[index]!.x, 0);
      expect(Number(endY)).toBeCloseTo(metrics.checkInputs[index]!.y, 0);
      expect(Number(trunkX)).toBeGreaterThan(Number(startX));
      expect(Number(trunkX)).toBeLessThan(Number(endX));
    });
    expect(metrics.checkStageDecisionOverlap).toBeFalsy();
    expect(metrics.checkDecisionBlockedOverlap).toBeFalsy();
    expect(metrics.rootScrollHeight).toBeLessThanOrEqual(metrics.rootClientHeight + 1);
    expect(metrics.panelScrollHeight).toBeLessThanOrEqual(metrics.panelClientHeight + 1);
    metrics.horizontalOverflow.forEach((item) => {
      expect(item.scrollWidth, JSON.stringify(item)).toBeLessThanOrEqual(item.clientWidth + 1);
    });
    expect(metrics.canvasOverflowY).toBe("hidden");
    expect(metrics.canvasOverflowX).toBe("auto");

    const step = (name: string) => metrics.reasoningSteps.find((item) => item.className.includes(name))!.rect;
    const understand = step("is-understand");
    const context = step("is-context");
    const tools = step("is-tools");
    const argumentsStep = step("is-arguments");
    expect(understand.right).toBeLessThanOrEqual(metrics.reasoningCore.left + 0.5);
    expect(tools.right).toBeLessThanOrEqual(metrics.reasoningCore.left + 0.5);
    expect(context.left).toBeGreaterThanOrEqual(metrics.reasoningCore.right - 0.5);
    expect(argumentsStep.left).toBeGreaterThanOrEqual(metrics.reasoningCore.right - 0.5);
    expect(understand.top).toBeLessThan(tools.top);
    expect(context.top).toBeLessThan(argumentsStep.top);
  }
});
test("bridge canvas compresses five checks without a laptop-width horizontal scrollbar", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 700 });
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();

  const next = page.locator(".security-defense-step-button-next");
  await next.click();
  await next.click();
  const bridge = page.locator(".llm-tool-call-bridge-panel");
  await expect(bridge).toBeVisible();

  const metrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".security-profile-page");
    const panel = document.querySelector<HTMLElement>(".llm-tool-call-bridge-panel");
    const canvas = document.querySelector<HTMLElement>(".llm-bridge-canvas");
    const checks = document.querySelector<HTMLElement>(".llm-bridge-checks");
    if (!root || !panel || !canvas || !checks) {
      throw new Error("bridge canvas is missing");
    }
    return {
      pageOverflow: root.scrollHeight - root.clientHeight,
      panelOverflow: panel.scrollHeight - panel.clientHeight,
      canvasOverflowX: getComputedStyle(canvas).overflowX,
      canvasOverflowY: getComputedStyle(canvas).overflowY,
      canvasScrollWidth: canvas.scrollWidth,
      canvasClientWidth: canvas.clientWidth,
      checksWidth: checks.getBoundingClientRect().width,
      checkCount: checks.querySelectorAll(".llm-bridge-check-stage").length,
    };
  });

  expect(metrics.pageOverflow, JSON.stringify(metrics)).toBeLessThanOrEqual(1);
  expect(metrics.panelOverflow, JSON.stringify(metrics)).toBeLessThanOrEqual(1);
  expect(metrics.canvasOverflowX).toBe("auto");
  expect(metrics.canvasOverflowY).toBe("hidden");
  expect(metrics.canvasScrollWidth).toBeLessThanOrEqual(metrics.canvasClientWidth + 1);
  expect(metrics.checksWidth).toBeLessThanOrEqual(metrics.canvasClientWidth + 1);
  expect(metrics.checkCount).toBe(5);
});
test("D3-D8 dedicated detail panels keep the shared lower workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();

  const next = page.getByRole("button", { name: /下一层/ });
  const panels = [
    [3, "d3-chain-visual"],
    [4, "d4-intent-visual"],
    [5, "d5-memory-visual"],
    [6, "d6-session-visual"],
    [7, "d7-output-visual"],
    [8, "d8-confirmation-visual"],
  ] as const;

  for (const [displayIndex, visualClass] of panels) {
    const layerSelector = `[data-defense-display-index="${displayIndex}"]`;
    while (await page.locator(layerSelector).count() === 0) {
      const currentIndex = await page.locator(".security-defense-placeholder").getAttribute("data-defense-display-index");
      await next.click();
      await expect(page.locator(".security-defense-placeholder")).not.toHaveAttribute("data-defense-display-index", currentIndex ?? "", { timeout: 10_000 });
    }
    const layer = page.locator(layerSelector);
    await expect(layer.locator(`.${visualClass}`)).toBeVisible();
    await expect(layer.locator(".defense-source-viewer pre")).toHaveCSS("overflow-y", "auto");
    await expect(layer.locator(".defense-rule-list")).toBeVisible();
    expect(await layer.locator(".defense-rule-list li").count()).toBeGreaterThan(0);
  }

  const showDisplayIndex = async (displayIndex: number) => {
    const current = () => page.locator(".security-defense-placeholder").getAttribute("data-defense-display-index");
    let currentIndex = Number(await current());
    while (currentIndex < displayIndex) {
      await next.click();
      await expect(page.locator(".security-defense-placeholder")).not.toHaveAttribute(
        "data-defense-display-index",
        String(currentIndex),
        { timeout: 10_000 },
      );
      currentIndex = Number(await current());
    }
    while (currentIndex > displayIndex) {
      await page.getByRole("button", { name: /上一层/ }).click();
      await expect(page.locator(".security-defense-placeholder")).not.toHaveAttribute(
        "data-defense-display-index",
        String(currentIndex),
        { timeout: 10_000 },
      );
      currentIndex = Number(await current());
    }
  };

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 900, height: 700 },
    { width: 560, height: 700 },
  ]) {
    await page.setViewportSize(viewport);

    for (const [displayIndex, visualClass] of panels) {
      await showDisplayIndex(displayIndex);
      const layer = page.locator(`[data-defense-display-index="${displayIndex}"]`);
      await expect(layer.locator(`.${visualClass}`)).toBeVisible();

      const metrics = await layer.evaluate((node) => {
        const panel = node.querySelector<HTMLElement>(".d3-d8-detail-panel");
        const visual = node.querySelector<HTMLElement>(".d3-d8-detail-visual");
        const lower = node.querySelector<HTMLElement>(".d3-d8-detail-lower");
        const source = node.querySelector<HTMLElement>(".defense-source-viewer pre");
        const explanation = node.querySelector<HTMLElement>(".defense-rule-list");
        const root = document.querySelector<HTMLElement>(".security-profile-page");
        if (!panel || !visual || !lower || !source || !explanation || !root) {
          throw new Error("D3-D8 geometry nodes are missing");
        }

        const rect = (item: HTMLElement) => {
          const value = item.getBoundingClientRect();
          return {
            left: value.left,
            right: value.right,
            top: value.top,
            bottom: value.bottom,
            width: value.width,
          };
        };
        const panelRect = rect(panel);
        const visualRect = rect(visual);
        const lowerRect = rect(lower);
        const panelStyle = getComputedStyle(panel);

        return {
          panel: panelRect,
          visual: visualRect,
          lower: lowerRect,
          pageOverflow: root.scrollHeight - root.clientHeight,
          panelOverflow: panel.scrollHeight - panel.clientHeight,
          panelPaddingLeft: Number.parseFloat(panelStyle.paddingLeft),
          panelPaddingRight: Number.parseFloat(panelStyle.paddingRight),
          visualLowerGap: lowerRect.top - visualRect.bottom,
          lowerBottomInset: panelRect.bottom - lowerRect.bottom,
          sourceOverflowY: getComputedStyle(source).overflowY,
          explanationOverflowY: getComputedStyle(explanation).overflowY,
        };
      });

      const context = JSON.stringify({ viewport, displayIndex, metrics });
      expect(metrics.pageOverflow, context).toBeLessThanOrEqual(1);
      expect(metrics.panelOverflow, context).toBeLessThanOrEqual(1);
      expect(metrics.visual.width, context).toBeGreaterThan(0);
      expect(Math.abs(metrics.visual.left - metrics.lower.left), context).toBeLessThanOrEqual(1);
      expect(Math.abs(metrics.visual.right - metrics.lower.right), context).toBeLessThanOrEqual(1);
      expect(metrics.visual.left - metrics.panel.left, context).toBeCloseTo(metrics.panelPaddingLeft, 0);
      expect(metrics.panel.right - metrics.visual.right, context).toBeCloseTo(metrics.panelPaddingRight, 0);
      expect(metrics.visualLowerGap, context).toBeLessThanOrEqual(18);
      expect(metrics.lowerBottomInset, context).toBeLessThanOrEqual(4);
      expect(metrics.sourceOverflowY).toBe("auto");
  expect(metrics.explanationOverflowY).toBe("hidden");
    }
  }

  const d8Layer = page.locator('[data-defense-display-index="8"]');
  const sourceHeader = d8Layer.locator(".defense-source-viewer > header");
  await expect(sourceHeader.locator(":scope > .d1-source-viewer-stage")).toContainText("源码快照");
  await expect(sourceHeader.locator(":scope > .defense-source-tabs")).toHaveCount(1);
  await expect(d8Layer.locator(".d8-terminal.is-pending strong")).toHaveCSS("font-size", "9px");
  await expect(d8Layer.locator(".d8-terminal.is-pending code")).toHaveCSS("font-size", "9px");

  const assertFlowState = async (expected: readonly string[]) => {
    const states = await d8Layer.locator(".d8-state-step").evaluateAll((nodes) => nodes.map((node) => {
      const classes = new Set(node.classList);
      return classes.has("is-blocked")
        ? "blocked"
        : classes.has("is-complete")
          ? "complete"
          : classes.has("is-current")
            ? "current"
            : "idle";
    }));
    expect(states).toEqual(expected);
  };

  await assertFlowState(["current", "idle", "idle", "idle", "idle"]);
  await d8Layer.getByRole("button", { name: "用户允许邮件发送", exact: true }).click();
  await assertFlowState(["complete", "complete", "complete", "complete", "complete"]);

  for (const label of ["用户拒绝邮件发送", "确认等待超时", "非交互模式拒绝"] as const) {
    await d8Layer.getByRole("button", { name: label, exact: true }).click();
    await assertFlowState(["complete", "complete", "complete", "blocked", "idle"]);
    await expect(d8Layer.locator(".d8-terminal")).toContainText("Sandbox 取消");
  }

  await d8Layer.getByRole("tab", { name: "sandbox/composite.py", exact: true }).click();
  await expect(d8Layer.locator(".defense-source-viewer")).toContainText("sandbox/composite.py");
  await d8Layer.getByRole("tab", { name: "confirmation/__init__.py", exact: true }).click();
  await expect(d8Layer.locator(".defense-source-viewer")).toContainText("confirmation/__init__.py");
  await d8Layer.getByRole("button", { name: "用户允许邮件发送", exact: true }).click();
  await expect(d8Layer.locator(".d8-terminal")).toContainText("Sandbox 执行");

  await page.setViewportSize({ width: 560, height: 700 });
  const narrowMetrics = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".security-profile-page");
    const panel = document.querySelector<HTMLElement>(".d8-confirmation-panel");
    const lower = document.querySelector<HTMLElement>(".d3-d8-detail-lower");
    const source = document.querySelector<HTMLElement>(".defense-source-viewer pre");
    const explanation = document.querySelector<HTMLElement>(".defense-rule-list");
    if (!root || !panel || !lower || !source || !explanation) throw new Error("D3-D8 narrow workspace is incomplete");
    return {
      pageOverflow: root.scrollHeight - root.clientHeight,
      panelOverflow: panel.scrollHeight - panel.clientHeight,
      lowerWidth: lower.getBoundingClientRect().width,
      sourceOverflowY: getComputedStyle(source).overflowY,
      explanationOverflowY: getComputedStyle(explanation).overflowY,
    };
  });

  expect(narrowMetrics.pageOverflow, JSON.stringify(narrowMetrics)).toBeLessThanOrEqual(1);
  expect(narrowMetrics.panelOverflow, JSON.stringify(narrowMetrics)).toBeLessThanOrEqual(1);
  expect(narrowMetrics.lowerWidth).toBeGreaterThan(0);
  expect(narrowMetrics.sourceOverflowY).toBe("auto");
  expect(narrowMetrics.explanationOverflowY).toBe("hidden");
});

test("D7 keeps a stable four-step visual frame for two-step rules", async ({ page }) => {
  await openMainWindow(page);
  await page.getByRole("button", { name: /安全画像/ }).click();
  await page.getByRole("button", { name: "进入防御机制可视化" }).click();

  const next = page.getByRole("button", { name: /下一层/ });
  while (await page.locator('[data-defense-display-index="7"]').count() === 0) {
    await next.click();
  }

  const layer = page.locator('[data-defense-display-index="7"]');
  const selectRule = async (index: number) => {
    const entry = layer.locator(".defense-rule-list li").nth(index);
    await expect(entry.locator(".d1-rule-index")).toHaveText(String(index + 1).padStart(2, "0"));
    await entry.locator("button").click();
  };
  const readGeometry = () => layer.evaluate((node) => {
    const panel = node.querySelector<HTMLElement>(".d3-d8-detail-panel");
    const visual = node.querySelector<HTMLElement>(".d3-d8-detail-visual");
    const lower = node.querySelector<HTMLElement>(".d3-d8-detail-lower");
    const source = node.querySelector<HTMLElement>(".defense-source-viewer pre");
    const explanation = node.querySelector<HTMLElement>(".defense-rule-list");
    const sequence = node.querySelector<HTMLElement>(".d7-audit-sequence");
    const steps = Array.from(node.querySelectorAll<HTMLElement>(".d7-audit-step"));
    if (!panel || !visual || !lower || !source || !explanation || !sequence || steps.length === 0) {
      throw new Error("D7 stability geometry nodes are missing");
    }

    const rect = (item: HTMLElement) => {
      const value = item.getBoundingClientRect();
      return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, height: value.height };
    };
    const stepRects = steps.map(rect);
    const stepTop = Math.min(...stepRects.map((item) => item.top));
    const stepBottom = Math.max(...stepRects.map((item) => item.bottom));
    const sequenceRect = rect(sequence);
    return {
      visual: rect(visual),
      lower: rect(lower),
      source: rect(source),
      explanation: rect(explanation),
      sequence: sequenceRect,
      stepCount: steps.length,
      stepCenter: (stepTop + stepBottom) / 2,
      sequenceCenter: (sequenceRect.top + sequenceRect.bottom) / 2,
      pageOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      panelOverflow: panel.scrollHeight - panel.clientHeight,
      sourceOverflowY: getComputedStyle(source).overflowY,
      explanationOverflowY: getComputedStyle(explanation).overflowY,
    };
  });

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 900, height: 700 },
    { width: 560, height: 700 },
  ]) {
    await page.setViewportSize(viewport);
    await selectRule(0);
    const baseline = await readGeometry();

    for (const index of [4, 5]) {
      await selectRule(index);
      const current = await readGeometry();
      const context = JSON.stringify({ viewport, index: index + 1, baseline, current });
      expect(current.stepCount, context).toBe(2);
      expect(Math.abs(current.visual.top - baseline.visual.top), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.visual.bottom - baseline.visual.bottom), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.lower.top - baseline.lower.top), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.lower.bottom - baseline.lower.bottom), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.source.top - baseline.source.top), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.source.bottom - baseline.source.bottom), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.explanation.top - baseline.explanation.top), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.explanation.bottom - baseline.explanation.bottom), context).toBeLessThanOrEqual(1);
      expect(Math.abs(current.stepCenter - current.sequenceCenter), context).toBeLessThanOrEqual(1);
      expect(current.pageOverflow, context).toBeLessThanOrEqual(1);
      expect(current.panelOverflow, context).toBeLessThanOrEqual(1);
      expect(current.sourceOverflowY).toBe("auto");
      expect(current.explanationOverflowY).toBe("hidden");
    }
  }
});
