# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: main-sidebar-collapse.spec.ts >> main sidebar collapse reduced motion >> settles at the collapsed endpoint without waiting for motion
- Location: e2e\main-sidebar-collapse.spec.ts:471:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.main-window')
Expected: visible
Timeout: 12000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 12000ms
  - waiting for locator('.main-window')

```

```yaml
- main:
  - 'status "正在接入 Agent：加载 RiskPattern 知识库: R1-R4…"'
- alert
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | async function openMainWindow(page: Page) {
  4   |   await page.route("**/api/**", (route) =>
  5   |     route.fulfill({
  6   |       body: JSON.stringify({
  7   |         error: {
  8   |           code: "BACKEND_UNAVAILABLE",
  9   |           message: "Backend unavailable in this test",
  10  |         },
  11  |       }),
  12  |       contentType: "application/json",
  13  |       status: 503,
  14  |     }),
  15  |   );
  16  | 
  17  |   await page.goto("/");
  18  |   const hitArea = page.locator(".login-placeholder-hitarea");
  19  |   const hitAreaBox = await hitArea.boundingBox();
  20  |   expect(hitAreaBox).not.toBeNull();
  21  | 
  22  |   await page.mouse.click(
  23  |     hitAreaBox!.x + hitAreaBox!.width / 2,
  24  |     hitAreaBox!.y + hitAreaBox!.height / 2,
  25  |   );
  26  |   await page.getByRole("button", { name: "进入平台" }).click();
  27  |   await expect(page.locator(".login-placeholder-page")).toHaveAttribute(
  28  |     "data-scroll-ready",
  29  |     "true",
  30  |   );
  31  |   await page.evaluate(() =>
  32  |     window.scrollTo({ top: window.innerHeight, behavior: "auto" }),
  33  |   );
  34  |   await page.getByRole("button", { name: "稍后再说" }).click();
> 35  |   await expect(page.locator(".main-window")).toBeVisible({ timeout: 12_000 });
      |                                              ^ Error: expect(locator).toBeVisible() failed
  36  |   await expect(page.locator(".main-window")).toHaveAttribute(
  37  |     "data-main-window-stage",
  38  |     "settled",
  39  |     { timeout: 12_000 },
  40  |   );
  41  | }
  42  | 
  43  | async function readCollapseMetrics(page: Page) {
  44  |   return page.evaluate(() => {
  45  |     const button = document.querySelector<HTMLButtonElement>(
  46  |       ".main-sidebar-toggle-button",
  47  |     );
  48  |     const sidebar = document.querySelector<HTMLElement>("#main-line-sidebar");
  49  |     const content = document.querySelector<HTMLElement>(".main-content-region");
  50  |     const icon = document.querySelector<SVGGElement>(".main-sidebar-toggle-icon");
  51  | 
  52  |     if (!button || !sidebar || !content || !icon) {
  53  |       throw new Error("Main sidebar collapse controls are missing");
  54  |     }
  55  | 
  56  |     const buttonBox = button.getBoundingClientRect();
  57  |     const contentBox = content.getBoundingClientRect();
  58  | 
  59  |     return {
  60  |       buttonLeft: buttonBox.left,
  61  |       buttonExpanded: button.getAttribute("aria-expanded"),
  62  |       contentWidth: contentBox.width,
  63  |       controlsId: button.getAttribute("aria-controls"),
  64  |       iconTransform: getComputedStyle(icon).transform,
  65  |       sidebarHidden: sidebar.getAttribute("aria-hidden"),
  66  |       sidebarInert: sidebar.hasAttribute("inert"),
  67  |     };
  68  |   });
  69  | }
  70  | 
  71  | async function readGraphMetrics(
  72  |   page: Page,
  73  |   selectors: {
  74  |     companion: string;
  75  |     map: string;
  76  |     svg: string;
  77  |   },
  78  | ) {
  79  |   return page.evaluate((currentSelectors) => {
  80  |     const companion = document.querySelector<HTMLElement>(
  81  |       currentSelectors.companion,
  82  |     );
  83  |     const map = document.querySelector<HTMLElement>(currentSelectors.map);
  84  |     const svg = document.querySelector<SVGSVGElement>(currentSelectors.svg);
  85  |     const text = svg?.querySelector<SVGTextElement>("text");
  86  | 
  87  |     if (!companion || !map || !svg || !text) {
  88  |       throw new Error("Graph metrics targets are missing");
  89  |     }
  90  | 
  91  |     const ctm = svg.getScreenCTM();
  92  | 
  93  |     if (!ctm) {
  94  |       throw new Error("Graph screen transform is missing");
  95  |     }
  96  | 
  97  |     return {
  98  |       companionWidth: companion.getBoundingClientRect().width,
  99  |       mapWidth: map.getBoundingClientRect().width,
  100 |       svgScale: ctm.a,
  101 |       textWidth: text.getBoundingClientRect().width,
  102 |     };
  103 |   }, selectors);
  104 | }
  105 | 
  106 | type GraphSelectors = {
  107 |   companion: string;
  108 |   map: string;
  109 |   svg: string;
  110 | };
  111 | 
  112 | type GraphFrame = Awaited<ReturnType<typeof readGraphMetrics>> & {
  113 |   contentLeft: number;
  114 |   graphFrozen: string | null;
  115 | };
  116 | 
  117 | async function captureGraphFrames(
  118 |   page: Page,
  119 |   selectors: GraphSelectors,
  120 |   duration = 700,
  121 |   toggleBeforeSampling = false,
  122 | ) {
  123 |   return page.evaluate(
  124 |     async ({ currentSelectors, frameDuration, shouldToggle }) => {
  125 |       const companion = document.querySelector<HTMLElement>(
  126 |         currentSelectors.companion,
  127 |       );
  128 |       const map = document.querySelector<HTMLElement>(currentSelectors.map);
  129 |       const svg = document.querySelector<SVGSVGElement>(currentSelectors.svg);
  130 |       const text = svg?.querySelector<SVGTextElement>("text");
  131 |       const root = document.querySelector<HTMLElement>(".main-window");
  132 |       const content = document.querySelector<HTMLElement>(".main-content-region");
  133 |       const toggle = document.querySelector<HTMLButtonElement>(
  134 |         ".main-sidebar-toggle-button",
  135 |       );
```