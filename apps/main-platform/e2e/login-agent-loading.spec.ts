import { expect, type Page, test } from "@playwright/test";

import { getLoadingTips } from "../app/windows/shared/loading-tips";

async function openAgentEntry(page: Page) {
  const root = page.locator(".login-placeholder-page");
  const hitArea = page.locator(".login-placeholder-hitarea");

  await expect(root).toHaveAttribute("data-panel-stage", "idle");
  const box = await hitArea.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(20);
  expect(box!.height).toBeGreaterThan(20);
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(root).toHaveAttribute("data-panel-stage", "open");
  await page.getByRole("button", { name: "进入平台" }).click();
  await expect(root).toHaveAttribute("data-scroll-ready", "true");

  await page.evaluate(() => window.scrollTo({ top: window.innerHeight, behavior: "auto" }));
  await expect(root).toHaveAttribute("data-agent-draft-ready", "true");
  await expect(page.getByRole("button", { name: "稍后再说" })).toBeVisible();
}

type LoadingTextSample = {
  charCount: number;
  fontFamily: string;
  fontSize: string;
  height: number;
  lineHeight: string;
  rootOpacity: number;
  text: string;
};

async function sampleLoadingText(page: Page): Promise<LoadingTextSample> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".login-agent-loading-text");
    if (!root) {
      throw new Error("Missing login loading text");
    }

    const style = window.getComputedStyle(root);
    const rect = root.getBoundingClientRect();

    return {
      charCount: document.querySelectorAll(".login-agent-loading-char").length,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      height: Math.round(rect.height),
      lineHeight: style.lineHeight,
      rootOpacity: Number(style.opacity),
      text: root.textContent ?? "",
    };
  });
}

function expectedSplitCharCount(text: string) {
  return [...text].filter((character) => character !== "\n").length;
}

test("later entry runs the local blue-screen loading without a backend", async ({ page }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("Failed to load resource:")
    ) {
      consoleErrors.push(message.text());
    }
  });
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
  await openAgentEntry(page);

  const root = page.locator(".login-placeholder-page");
  const loadingText = page.locator(".login-agent-loading-text");

  await page.getByRole("button", { name: "稍后再说" }).click();
  await expect(root).toHaveAttribute("data-agent-entry-stage", "loading");
  await expect(page.locator(".login-agent-loading-overlay")).toHaveAttribute(
    "aria-hidden",
    "false",
  );
  await expect(loadingText).not.toHaveText("");

  const firstTip = await loadingText.textContent();
  expect(getLoadingTips("boot").some((tip) => tip.text === firstTip)).toBe(true);

  await page.waitForTimeout(800);
  expect(await loadingText.textContent()).toBe(firstTip);
  expect(await page.locator(".login-agent-loading-char").count()).toBeGreaterThanOrEqual(
    [...(firstTip ?? "")].length,
  );

  await expect
    .poll(() => loadingText.textContent(), { timeout: 5_000 })
    .not.toBe(firstTip);
  await expect
    .poll(() => page.locator(".login-placeholder-page").count(), {
      timeout: 12_000,
    })
    .toBe(0);
  await expect(page.locator(".main-window")).toBeVisible({
    timeout: 2_000,
  });

  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("loading tip keeps split text mounted while visible and while fading out", async ({ page }) => {
  await page.goto("/");
  await openAgentEntry(page);

  await page.getByRole("button", { name: "稍后再说" }).click();
  await expect(page.locator(".login-placeholder-page")).toHaveAttribute(
    "data-agent-entry-stage",
    "loading",
  );

  const samples: LoadingTextSample[] = [];
  let firstVisibleText = "";

  for (let index = 0; index < 240; index += 1) {
    const sample = await sampleLoadingText(page);
    samples.push(sample);

    if (!firstVisibleText && sample.text && sample.rootOpacity > 0.01) {
      firstVisibleText = sample.text;
    }

    if (firstVisibleText && sample.text && sample.text !== firstVisibleText) {
      break;
    }

    await page.waitForTimeout(25);
  }

  expect(firstVisibleText).not.toBe("");
  const visibleSamples = samples.filter(
    (sample) => sample.text === firstVisibleText && sample.rootOpacity > 0.01,
  );
  expect(visibleSamples.length).toBeGreaterThan(5);

  const referenceSample = visibleSamples[0]!;
  const expectedCharCount = expectedSplitCharCount(firstVisibleText);
  let reachedFullOpacity = false;
  let capturedFadeOut = false;

  for (const sample of visibleSamples) {
    expect(sample.charCount).toBeGreaterThanOrEqual(expectedCharCount);
    expect(sample.fontFamily).toBe(referenceSample.fontFamily);
    expect(sample.fontSize).toBe(referenceSample.fontSize);
    expect(sample.lineHeight).toBe(referenceSample.lineHeight);
    expect(Math.abs(sample.height - referenceSample.height)).toBeLessThanOrEqual(1);

    if (sample.rootOpacity >= 0.98) {
      reachedFullOpacity = true;
    }

    if (reachedFullOpacity && sample.rootOpacity < 0.98) {
      capturedFadeOut = true;
    }
  }

  expect(reachedFullOpacity).toBe(true);
  expect(capturedFadeOut).toBe(true);
});

test("later entry is idempotent while the local loading session is active", async ({ page }) => {
  await page.goto("/");
  await openAgentEntry(page);

  const root = page.locator(".login-placeholder-page");
  const laterButton = page.getByRole("button", { name: "稍后再说" });

  await laterButton.click();
  await expect(root).toHaveAttribute("data-agent-entry-stage", "loading");
  await expect(laterButton).toBeDisabled();

  await page.waitForTimeout(400);
  await expect(root).toHaveAttribute("data-agent-entry-stage", "loading");
});

test("short login viewport keeps Agent preview rows separated and scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 786, height: 546 });
  await page.goto("/");
  await openAgentEntry(page);

  const preview = page.locator(".login-agent-draft-preview");
  await expect(preview).toBeVisible();

  const metrics = await page.evaluate(() => {
    const riskList = document.querySelector<HTMLElement>(".login-agent-risk-list");
    const checkList = document.querySelector<HTMLElement>(".login-agent-check-list");

    if (!riskList || !checkList) {
      throw new Error("Missing Agent preview lists");
    }

    const rowHeights = (list: HTMLElement) =>
      Array.from(list.children).map((row) => Math.round(row.getBoundingClientRect().height));
    const scrollContainer = riskList.parentElement;
    const riskRows = Array.from(riskList.children);
    const checkRows = Array.from(checkList.children);
    const lastRiskRow = riskRows.at(-1);
    const firstCheckRow = checkRows.at(0);

    if (!lastRiskRow || !firstCheckRow) {
      throw new Error("Missing Agent preview row content");
    }

    return {
      checkTop: Math.round(firstCheckRow.getBoundingClientRect().top),
      riskBottom: Math.round(lastRiskRow.getBoundingClientRect().bottom),
      riskHeights: rowHeights(riskList),
      checkHeights: rowHeights(checkList),
      scrollHeight: scrollContainer?.scrollHeight ?? 0,
      clientHeight: scrollContainer?.clientHeight ?? 0,
    };
  });

  expect(metrics.riskHeights.every((height) => height >= 44)).toBe(true);
  expect(metrics.checkHeights.every((height) => height >= 44)).toBe(true);
  expect(metrics.riskBottom).toBeLessThanOrEqual(metrics.checkTop);
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
});
