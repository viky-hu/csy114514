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
  await expect(page.locator(".main-window")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".main-window")).toHaveAttribute(
    "data-main-window-stage",
    "settled",
    { timeout: 20_000 },
  );
}

async function readCollapseMetrics(page: Page) {
  return page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      ".main-sidebar-toggle-button",
    );
    const sidebar = document.querySelector<HTMLElement>("#main-line-sidebar");
    const content = document.querySelector<HTMLElement>(".main-content-region");
    const icon = document.querySelector<SVGGElement>(".main-sidebar-toggle-icon");

    if (!button || !sidebar || !content || !icon) {
      throw new Error("Main sidebar collapse controls are missing");
    }

    const buttonBox = button.getBoundingClientRect();
    const contentBox = content.getBoundingClientRect();

    return {
      buttonLeft: buttonBox.left,
      buttonExpanded: button.getAttribute("aria-expanded"),
      contentWidth: contentBox.width,
      controlsId: button.getAttribute("aria-controls"),
      iconTransform: getComputedStyle(icon).transform,
      sidebarHidden: sidebar.getAttribute("aria-hidden"),
      sidebarInert: sidebar.hasAttribute("inert"),
    };
  });
}

async function readGraphMetrics(
  page: Page,
  selectors: {
    companion: string;
    map: string;
    svg: string;
  },
) {
  return page.evaluate((currentSelectors) => {
    const companion = document.querySelector<HTMLElement>(
      currentSelectors.companion,
    );
    const map = document.querySelector<HTMLElement>(currentSelectors.map);
    const svg = document.querySelector<SVGSVGElement>(currentSelectors.svg);
    const text = svg?.querySelector<SVGTextElement>("text");

    if (!companion || !map || !svg || !text) {
      throw new Error("Graph metrics targets are missing");
    }

    const ctm = svg.getScreenCTM();

    if (!ctm) {
      throw new Error("Graph screen transform is missing");
    }

    return {
      companionWidth: companion.getBoundingClientRect().width,
      mapWidth: map.getBoundingClientRect().width,
      svgScale: ctm.a,
      textWidth: text.getBoundingClientRect().width,
    };
  }, selectors);
}

type GraphSelectors = {
  companion: string;
  map: string;
  svg: string;
};

type GraphFrame = Awaited<ReturnType<typeof readGraphMetrics>> & {
  contentLeft: number;
  graphFrozen: string | null;
};

async function captureGraphFrames(
  page: Page,
  selectors: GraphSelectors,
  duration = 700,
  toggleBeforeSampling = false,
) {
  return page.evaluate(
    async ({ currentSelectors, frameDuration, shouldToggle }) => {
      const companion = document.querySelector<HTMLElement>(
        currentSelectors.companion,
      );
      const map = document.querySelector<HTMLElement>(currentSelectors.map);
      const svg = document.querySelector<SVGSVGElement>(currentSelectors.svg);
      const text = svg?.querySelector<SVGTextElement>("text");
      const root = document.querySelector<HTMLElement>(".main-window");
      const content = document.querySelector<HTMLElement>(".main-content-region");
      const toggle = document.querySelector<HTMLButtonElement>(
        ".main-sidebar-toggle-button",
      );

      if (!companion || !map || !svg || !text || !root || !content || !toggle) {
        throw new Error("Graph frame sampling targets are missing");
      }

      const frames: Array<{
        companionWidth: number;
        contentLeft: number;
        elapsedMs: number;
        graphFrozen: string | null;
        mapWidth: number;
        svgScale: number;
        textWidth: number;
      }> = [];
      const startedAt = performance.now();

      if (shouldToggle) {
        toggle.click();
      }

      while (performance.now() - startedAt < frameDuration) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const ctm = svg.getScreenCTM();

        if (!ctm) {
          throw new Error("Graph screen transform is missing while sampling");
        }

        frames.push({
          companionWidth: companion.getBoundingClientRect().width,
          contentLeft: content.getBoundingClientRect().left,
          elapsedMs: performance.now() - startedAt,
          graphFrozen: root.getAttribute("data-sidebar-graph-frozen"),
          mapWidth: map.getBoundingClientRect().width,
          svgScale: ctm.a,
          textWidth: text.getBoundingClientRect().width,
        });
      }

      return frames;
    },
    {
      currentSelectors: selectors,
      frameDuration: duration,
      shouldToggle: toggleBeforeSampling,
    },
  );
}

function expectSvgScaleWithinHalfPixel(
  actualScale: number,
  expectedScale: number,
  viewBoxWidth: number,
) {
  expect(Math.abs(actualScale - expectedScale) * viewBoxWidth).toBeLessThanOrEqual(
    0.5,
  );
}

function expectGraphFramesToStayFrozenAndStable(
  baseline: Awaited<ReturnType<typeof readGraphMetrics>>,
  frames: GraphFrame[],
  releasesAfterMotion = false,
) {
  expect(frames.length).toBeGreaterThan(10);

  for (const frame of frames) {
    expect(frame.mapWidth).toBeCloseTo(baseline.mapWidth, 0);
    expectSvgScaleWithinHalfPixel(frame.svgScale, baseline.svgScale, 1000);
    expect(frame.textWidth).toBeCloseTo(baseline.textWidth, 0);

  }

  if (releasesAfterMotion) {
    const releaseIndex = frames.findIndex((frame) => frame.graphFrozen === "false");

    expect(releaseIndex).toBeGreaterThan(0);
    expect(frames.slice(0, releaseIndex).every((frame) => frame.graphFrozen === "true")).toBe(
      true,
    );

    const releasedContentLeft = frames[releaseIndex]!.contentLeft;
    for (const frame of frames.slice(releaseIndex)) {
      expect(frame.contentLeft).toBeCloseTo(releasedContentLeft, 0);
    }
    return;
  }

  expect(frames.every((frame) => frame.graphFrozen === "true")).toBe(true);
}

test("main sidebar collapse controller reflows the workspace and keeps its state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openMainWindow(page);

  const toggle = page.locator(".main-sidebar-toggle-button");
  const expanded = await readCollapseMetrics(page);

  expect(expanded.buttonExpanded).toBe("true");
  expect(expanded.controlsId).toBe("main-line-sidebar");
  expect(expanded.sidebarInert).toBe(false);

  await toggle.click();
  await expect(toggle).toHaveAccessibleName("展开主导航");
  await page.waitForTimeout(680);

  const collapsed = await readCollapseMetrics(page);
  expect(collapsed.buttonExpanded).toBe("false");
  expect(collapsed.sidebarHidden).toBe("true");
  expect(collapsed.sidebarInert).toBe(true);
  expect(collapsed.buttonLeft).toBeLessThan(expanded.buttonLeft);
  expect(collapsed.contentWidth).toBeGreaterThan(expanded.contentWidth);
  expect(collapsed.iconTransform).not.toBe(expanded.iconTransform);

  await toggle.click();
  await page.waitForTimeout(160);
  await toggle.click();
  await page.waitForTimeout(680);
  await expect(toggle).toHaveAccessibleName("展开主导航");

  await toggle.press("Enter");
  await expect(toggle).toHaveAccessibleName("收起主导航");
  await toggle.press("Space");
  await expect(toggle).toHaveAccessibleName("展开主导航");

  await page.getByRole("button", { name: "画像", exact: true }).click();
  await expect(page.getByRole("region", { name: "安全画像" })).toBeVisible();
  await expect(toggle).toHaveAccessibleName("展开主导航");
  await expect(page.locator("#main-line-sidebar")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
});

test("all main workspace modules keep a bounded layout while the sidebar changes width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openMainWindow(page);

  const toggle = page.locator(".main-sidebar-toggle-button");
  const navButtons = page.locator(".main-line-sidebar-button");

  for (let index = 0; index < 7; index += 1) {
    const navButton = navButtons.nth(index);

    await navButton.click();
    await expect(navButton).toHaveAttribute("aria-current", "page");
    await page.waitForTimeout(680);

    const expanded = await readCollapseMetrics(page);
    await toggle.click();
    await page.waitForTimeout(680);

    const collapsed = await readCollapseMetrics(page);
    const viewportMetrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(collapsed.contentWidth).toBeGreaterThan(expanded.contentWidth);
    expect(viewportMetrics.scrollWidth).toBeLessThanOrEqual(
      viewportMetrics.clientWidth + 1,
    );

    await toggle.click();
    await page.waitForTimeout(680);
    await expect(toggle).toHaveAccessibleName("收起主导航");
  }
});

test("overview and profile retain their expanded graph scale while companion panels grow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openMainWindow(page);

  const toggle = page.locator(".main-sidebar-toggle-button");
  const overviewSelectors = {
    companion: ".overview-side-stack",
    map: ".overview-map",
    svg: ".overview-r4-svg",
  };
  const overviewExpanded = await readGraphMetrics(page, overviewSelectors);

  await toggle.click();
  await page.waitForTimeout(680);

  const overviewCollapsed = await readGraphMetrics(page, overviewSelectors);
  expect(overviewCollapsed.mapWidth).toBeCloseTo(overviewExpanded.mapWidth, 0);
  expectSvgScaleWithinHalfPixel(
    overviewCollapsed.svgScale,
    overviewExpanded.svgScale,
    1000,
  );
  expect(overviewCollapsed.textWidth).toBeCloseTo(overviewExpanded.textWidth, 0);
  expect(overviewCollapsed.companionWidth).toBeGreaterThan(
    overviewExpanded.companionWidth,
  );

  await page
    .locator(".overview-agent-panel .overview-mini-command")
    .click();
  await expect(page.getByRole("region", { name: "安全画像" })).toBeVisible();

  const profileSelectors = {
    companion: ".security-profile-inspector",
    map: ".security-profile-map",
    svg: ".security-profile-svg",
  };
  const profileCollapsed = await readGraphMetrics(page, profileSelectors);

  await toggle.click();
  await page.waitForTimeout(680);

  const profileExpanded = await readGraphMetrics(page, profileSelectors);
  expect(profileExpanded.mapWidth).toBeCloseTo(profileCollapsed.mapWidth, 0);
  expectSvgScaleWithinHalfPixel(
    profileExpanded.svgScale,
    profileCollapsed.svgScale,
    1000,
  );
  expect(profileExpanded.textWidth).toBeCloseTo(profileCollapsed.textWidth, 0);

  await toggle.click();
  await page.waitForTimeout(680);

  const profileCollapsedAgain = await readGraphMetrics(page, profileSelectors);
  expect(profileCollapsedAgain.mapWidth).toBeCloseTo(profileExpanded.mapWidth, 0);
  expectSvgScaleWithinHalfPixel(
    profileCollapsedAgain.svgScale,
    profileExpanded.svgScale,
    1000,
  );
  expect(profileCollapsedAgain.companionWidth).toBeGreaterThan(
    profileExpanded.companionWidth,
  );
});

test("graph visual scale stays frozen throughout sidebar motion across responsive thresholds", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await openMainWindow(page);

  const toggle = page.locator(".main-sidebar-toggle-button");
  const overviewSelectors = {
    companion: ".overview-side-stack",
    map: ".overview-map",
    svg: ".overview-r4-svg",
  };
  const overviewExpanded = await readGraphMetrics(page, overviewSelectors);

  const overviewCollapseFrames = await captureGraphFrames(
    page,
    overviewSelectors,
    700,
    true,
  );
  expectGraphFramesToStayFrozenAndStable(
    overviewExpanded,
    overviewCollapseFrames,
  );

  const overviewCollapsed = await readGraphMetrics(page, overviewSelectors);
  expect(overviewCollapsed.companionWidth).toBeGreaterThan(
    overviewExpanded.companionWidth,
  );

  const overviewExpandFrames = await captureGraphFrames(
    page,
    overviewSelectors,
    700,
    true,
  );
  expectGraphFramesToStayFrozenAndStable(
    overviewExpanded,
    overviewExpandFrames,
    true,
  );
  await expect(page.locator(".main-window")).toHaveAttribute(
    "data-sidebar-graph-frozen",
    "false",
  );

  await toggle.click();
  await page.waitForTimeout(680);
  await page
    .locator(".overview-agent-panel .overview-mini-command")
    .click();
  await expect(page.getByRole("region", { name: "安全画像" })).toBeVisible();

  const profileSelectors = {
    companion: ".security-profile-inspector",
    map: ".security-profile-map",
    svg: ".security-profile-svg",
  };
  const profileCollapsed = await readGraphMetrics(page, profileSelectors);

  const profileExpandFrames = await captureGraphFrames(
    page,
    profileSelectors,
    700,
    true,
  );
  expectGraphFramesToStayFrozenAndStable(
    profileCollapsed,
    profileExpandFrames,
    true,
  );
  await expect(page.locator(".main-window")).toHaveAttribute(
    "data-sidebar-graph-frozen",
    "false",
  );

  await toggle.click();
  await page.waitForTimeout(160);
  const profileReverseFrames = await captureGraphFrames(
    page,
    profileSelectors,
    700,
    true,
  );
  expectGraphFramesToStayFrozenAndStable(
    profileCollapsed,
    profileReverseFrames,
    true,
  );
});

test.describe("main sidebar collapse reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("settles at the collapsed endpoint without waiting for motion", async ({
    page,
  }) => {
    await openMainWindow(page);

    const toggle = page.locator(".main-sidebar-toggle-button");
    await toggle.click();

    await expect(toggle).toHaveAccessibleName("展开主导航");
    await expect(page.locator("#main-line-sidebar")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
