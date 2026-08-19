import { expect, test, type Page } from "@playwright/test";

const OPEN_TIMEOUT = 2_500;

type PageDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  missingResources: string[];
};

function attachPageDiagnostics(page: Page): PageDiagnostics {
  const diagnostics: PageDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    missingResources: [],
  };

  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      message.text() !== "Failed to load resource: the server responded with a status of 404 (Not Found)"
    ) {
      diagnostics.consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() !== 404) {
      return;
    }

    const pathname = new URL(response.url()).pathname;

    if (pathname !== "/favicon.ico") {
      diagnostics.missingResources.push(response.url());
    }
  });

  return diagnostics;
}

async function assertPanelOpened(page: Page, diagnostics: PageDiagnostics) {
  const root = page.locator(".login-placeholder-page");

  await expect(root).toHaveAttribute("data-panel-stage", "open", {
    timeout: OPEN_TIMEOUT,
  });
  await expect(page.locator(".login-panel-shell")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const band = document.querySelector<SVGRectElement>(".login-hover-band");
    const panel = document.querySelector<HTMLElement>(".login-panel-shell");

    if (!band || !panel) {
      throw new Error("Login band or panel is missing");
    }

    return {
      bandWidth: Number(band.getAttribute("width")),
      panelWidth: panel.getBoundingClientRect().width,
    };
  });

  expect(geometry.bandWidth).toBeGreaterThan(122);
  expect(Math.abs(geometry.bandWidth - geometry.panelWidth)).toBeLessThanOrEqual(1);
  expect(diagnostics.consoleErrors).toEqual([]);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.missingResources).toEqual([]);
}

async function getLoginTargetPoint(page: Page) {
  const cta = page.locator(".login-placeholder-hitarea");

  await expect(page.locator(".login-placeholder-page")).toHaveAttribute(
    "data-panel-stage",
    "idle",
  );

  const box = await cta.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(20);
  expect(box!.height).toBeGreaterThan(20);

  return {
    x: box!.x + box!.width / 2,
    y: box!.y + box!.height / 2,
  };
}

test.describe.configure({ mode: "serial" });

test("50 high-risk account-login openings always settle at the panel width", async ({
  page,
}) => {
  const diagnostics = attachPageDiagnostics(page);

  for (let iteration = 0; iteration < 50; iteration += 1) {
    await page.setViewportSize({
      width: iteration % 2 === 0 ? 1440 : 1366,
      height: iteration % 3 === 0 ? 900 : 768,
    });
    await page.goto("/");

    const { x, y } = await getLoginTargetPoint(page);

    await page.mouse.move(Math.max(x - 240, 12), Math.max(y - 100, 12));
    await page.mouse.move(x, y);

    if (iteration % 5 === 0) {
      await page.waitForTimeout(1_030);
    }

    if (iteration % 5 === 1) {
      await page.mouse.dblclick(x, y, { delay: 5 });
    } else {
      await page.mouse.click(x, y);
    }

    if (iteration % 5 === 2) {
      await page.mouse.move(Math.min(x + 260, 1420), Math.max(y - 120, 12), {
        steps: 4,
      });
      await page.locator(".login-placeholder-page").dispatchEvent("pointerleave");
    }

    if (iteration % 5 === 3) {
      await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    }

    if (iteration % 5 === 4) {
      await page.setViewportSize({ width: 1400, height: 820 });
    }

    await assertPanelOpened(page, diagnostics);
  }
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("opens directly at the final panel width", async ({ page }) => {
    const diagnostics = attachPageDiagnostics(page);

    await page.goto("/");
    const { x, y } = await getLoginTargetPoint(page);
    await page.mouse.click(x, y);

    await assertPanelOpened(page, diagnostics);
  });
});
