import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import test from "node:test";

const mainWindowSource = readFileSync(
  new URL("./MainWindow.tsx", import.meta.url),
  "utf8",
);

const mainSidebarSource = readFileSync(
  new URL("./MainLineSidebar.tsx", import.meta.url),
  "utf8",
);

const mainStyles = readFileSync(
  new URL("../../styles/window-3-main.css", import.meta.url),
  "utf8",
);

const loginStyles = readFileSync(
  new URL("../../styles/window-1-login.css", import.meta.url),
  "utf8",
);

const loginSource = readFileSync(
  new URL("../login/LoginIntroWindow.tsx", import.meta.url),
  "utf8",
);

const layoutSource = readFileSync(
  new URL("../../layout.tsx", import.meta.url),
  "utf8",
);

test("main workspace keeps the sidebar boundary tight against the menu body", () => {
  assert.match(mainWindowSource, /SIDEBAR_WIDTH_UNITS = 5\.65/);
  assert.match(mainWindowSource, /SIDEBAR_WIDTH_MIN = 224/);
  assert.match(mainWindowSource, /SIDEBAR_WIDTH_MAX = 252/);
  assert.doesNotMatch(mainWindowSource, /snap\(7 \* cmX\)/);
  assert.doesNotMatch(mainWindowSource, /Math\.max\(snap\(7 \* cmX\), 260\)/);
  assert.match(
    mainWindowSource,
    /sidebarLeft \+ sidebarWidth \+ SIDEBAR_TO_CONTENT_GAP_UNITS \* cmX/,
  );
  assert.doesNotMatch(mainWindowSource, /sidebarLeft \+ sidebarWidth \+ 0\.42 \* cmX/);
});

test("main workspace CSS fallback mirrors the tighter sidebar boundary", () => {
  assert.match(
    mainStyles,
    /--main-sidebar-width:\s*clamp\(224px,\s*16vw,\s*252px\);/,
  );
  assert.match(
    mainStyles,
    /--main-content-left:\s*clamp\(292px,\s*21\.2vw,\s*342px\);/,
  );
  assert.doesNotMatch(mainStyles, /--main-sidebar-width:\s*clamp\(260px,\s*20\.6vw,\s*300px\);/);
  assert.doesNotMatch(mainStyles, /--main-content-left:\s*clamp\(310px,\s*25\.7vw,\s*480px\);/);
});

test("main workspace fades content pages out before replacing them", () => {
  assert.match(mainWindowSource, /renderedNavKey/);
  assert.match(mainWindowSource, /contentPageRef/);
  assert.match(mainWindowSource, /contentSwapTimelineRef/);
  assert.match(mainWindowSource, /handleMainNavSelect/);
  assert.match(mainWindowSource, /main-content-page-shell/);
  assert.match(mainWindowSource, /setRenderedNavKey\(nextNavKey\)/);
  assert.match(mainWindowSource, /duration: 0\.22/);
  assert.match(mainWindowSource, /duration: 0\.38/);
  assert.doesNotMatch(
    mainWindowSource,
    /dependencies: \[activeNavKey, renderedNavKey\]/,
  );
  assert.match(mainStyles, /\.main-content-page-shell/);
});

test("main workspace restores the content region and page shell after interrupted motion", () => {
  assert.match(mainWindowSource, /onInterrupt:\s*\(\)\s*=>\s*\{\s*hasSettled = true;/);
  assert.match(mainWindowSource, /onInterrupt:\s*\(\)\s*=>\s*\{\s*restoreContentPageShell\(pageShell\);/);
  assert.match(mainWindowSource, /return \(\) => \{\s*timeline\.kill\(\);\s*restoreContentPageShell\(pageShell\);/);
  assert.match(
    mainStyles,
    /\.main-content-region\s*\{[^}]*opacity:\s*1;[^}]*visibility:\s*visible;[^}]*transform:\s*translate3d\(0,\s*0,\s*0\);/s,
  );
  assert.match(
    mainStyles,
    /\.main-content-page-shell\s*\{[^}]*pointer-events:\s*auto;/s,
  );
});

test("main workspace keeps the target page attached to both navigation directions", () => {
  assert.match(
    mainWindowSource,
    /const navigationTargetRef = useRef<MainNavKey \| null>\(null\);/,
  );
  assert.match(
    mainWindowSource,
    /navigationTargetRef\.current = nextNavKey;/,
  );
  assert.match(
    mainWindowSource,
    /const targetNavKey = navigationTargetRef\.current \?\? nextNavKey;/,
  );
  assert.match(
    mainWindowSource,
    /setRenderedNavKey\(targetNavKey\);/,
  );
});

test("visible application branding is unified as AgentProof", () => {
  assert.match(loginSource, /const BRAND_WORD = "AgentProof";/);
  assert.match(layoutSource, /title: "AgentProof \| Agent 安全评估平台"/);
  assert.match(
    mainWindowSource,
    /<text[\s\S]*?className="main-window-brand-word"[\s\S]*?>\s*AgentProof\s*<\/text>/,
  );
  assert.match(
    mainWindowSource,
    /aria-label="AgentProof Agent 安全评估平台"/,
  );
  assert.doesNotMatch(
    `${loginSource}\n${layoutSource}\n${mainWindowSource}`,
    /AegisTrace/,
  );
});

test("main workspace aligns and reveals the AgentProof SVG wordmark with the intro line", () => {
  assert.match(mainWindowSource, /brandX:\s*insetX/);
  assert.match(mainWindowSource, /brandY:\s*snap\(lineTop - 0\.55 \* cmY\)/);
  assert.match(mainWindowSource, /const brand = brandRef\.current;/);
  assert.match(
    mainWindowSource,
    /gsap\.set\(brand,\s*\{\s*autoAlpha:\s*0,\s*y:\s*6\s*\}\)/,
  );
  assert.match(
    mainWindowSource,
    /gsap\.set\(brand,\s*\{\s*autoAlpha:\s*1,\s*y:\s*0\s*\}\)/,
  );
  assert.match(mainWindowSource, /\.addLabel\("brandReveal",\s*1\.12\)/);
  assert.match(
    mainWindowSource,
    /\.to\(\s*brand,\s*\{\s*autoAlpha:\s*1,\s*duration:\s*0\.36,\s*ease:\s*"power2\.out",\s*y:\s*0,?\s*\},\s*"brandReveal",?\s*\)/,
  );
  assert.match(
    mainWindowSource,
    /gsap\.killTweensOf\(\[[\s\S]*?brand,[\s\S]*?\]\)/,
  );
});

test("main workspace wordmark styling has stable desktop and mobile dimensions", () => {
  assert.match(loginStyles, /--w1-brand:\s*#3152f4;/i);
  assert.match(mainStyles, /--main-blue:\s*#3152f4;/i);
  assert.match(
    mainStyles,
    /\.main-window-brand-word\s*\{[^}]*fill:\s*var\(--main-blue\);[^}]*font-size:\s*30px;[^}]*font-weight:\s*700;[^}]*letter-spacing:\s*0;[^}]*opacity:\s*0;[^}]*visibility:\s*hidden;/s,
  );
  assert.match(
    mainStyles,
    /@media \(max-width:\s*720px\)[\s\S]*?\.main-window-brand-word\s*\{[^}]*font-size:\s*22px;/s,
  );
});

test("main Agent interface keeps its narrow-container preview rows content-sized", () => {
  assert.match(
    mainStyles,
    /@container main-content \(max-width:\s*980px\)[\s\S]*?\.agent-interface-page \.login-agent-draft-preview\s*\{\s*grid-template-rows:\s*repeat\(5, auto\);/s,
  );
  assert.doesNotMatch(
    mainStyles,
    /@container main-content \(max-width:\s*980px\)[\s\S]*?\.agent-interface-page \.login-agent-draft-preview\s*\{[^}]*minmax\(0, 1fr\)/s,
  );
});

test("main workspace owns a standalone reversible sidebar collapse controller", () => {
  assert.match(
    mainWindowSource,
    /import \{ MainSidebarToggleButton \} from "\.\/MainSidebarToggleButton";/,
  );
  assert.match(
    mainWindowSource,
    /const \[isSidebarCollapsed, setIsSidebarCollapsed\] = useState\(false\);/,
  );
  assert.match(
    mainWindowSource,
    /const sidebarCollapseTimelineRef = useRef<gsap\.core\.Timeline \| null>\(null\);/,
  );
  assert.match(mainWindowSource, /contentCollapsedLeft:/);
  assert.match(mainWindowSource, /sidebarToggleCollapsedLeft:/);
  assert.match(mainWindowSource, /--main-content-left/);
  assert.match(mainWindowSource, /sidebarCollapseTimelineRef\.current\?\.play\(\)/);
  assert.match(mainWindowSource, /sidebarCollapseTimelineRef\.current\?\.reverse\(\)/);
  assert.match(mainWindowSource, /duration: 0\.6/);
  assert.match(mainWindowSource, /ease: "power3\.inOut"/);
  assert.match(mainWindowSource, /svgOrigin: "22 22"/);
  assert.doesNotMatch(mainWindowSource, /transformOrigin: "50% 50%"/);
  assert.match(mainWindowSource, /id="main-line-sidebar"/);
  assert.match(mainWindowSource, /isCollapsed=\{isSidebarCollapsed\}/);
  assert.match(mainWindowSource, /<MainSidebarToggleButton[\s\S]*?controlsId="main-line-sidebar"/);
  assert.match(mainWindowSource, /data-sidebar-collapsed=\{isSidebarCollapsed\}/);
  assert.match(mainSidebarSource, /isCollapsed\?: boolean;/);
  assert.match(mainSidebarSource, /id\?: string;/);
  assert.match(mainSidebarSource, /inert=\{isCollapsed \? true : undefined\}/);
});

test("main workspace keeps graph layout frozen for the full reversible sidebar timeline", () => {
  assert.match(
    mainWindowSource,
    /const \[isSidebarGraphFrozen, setIsSidebarGraphFrozen\] = useState\(false\);/,
  );
  assert.match(mainWindowSource, /data-sidebar-graph-frozen/);
  assert.match(mainWindowSource, /if \(nextIsCollapsed\) \{\s*setSidebarGraphFrozen\(true\);/);
  assert.match(
    mainWindowSource,
    /onReverseComplete:\s*\(\) => \{\s*if \(!isSidebarCollapsedRef\.current\) \{\s*setSidebarGraphFrozen\(false\);/,
  );
  assert.match(
    mainWindowSource,
    /<OverviewDashboard[\s\S]*?isGraphFrozen=\{isSidebarGraphFrozen\}/,
  );
  assert.match(
    mainWindowSource,
    /<SecurityProfileGraph[\s\S]*?isGraphFrozen=\{isSidebarGraphFrozen\}/,
  );
  assert.match(mainStyles, /data-sidebar-graph-frozen="true"/);
  assert.doesNotMatch(
    mainStyles,
    /data-sidebar-collapsed="true"\] \.overview-dashboard/,
  );
});

test("main workspace collapse controller is an overlay and reflows dashboard by container size", () => {
  assert.match(
    mainStyles,
    /\.main-sidebar-toggle-button\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*4;[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*will-change:\s*transform, opacity;/s,
  );
  assert.match(mainStyles, /\.main-sidebar-toggle-icon/);
  assert.doesNotMatch(mainStyles, /\.main-sidebar-toggle-coil/);
  assert.doesNotMatch(
    mainStyles,
    /\.main-sidebar-toggle-icon\s*\{[^}]*transform-box:\s*fill-box;/s,
  );
  assert.match(mainStyles, /@media \(max-width:\s*720px\)[\s\S]*?\.main-sidebar-toggle-button\s*\{\s*display:\s*none;/s);
  assert.match(mainStyles, /@container overview-dashboard \(max-width:\s*980px\)/);
  assert.doesNotMatch(mainStyles, /@media \(max-width:\s*1180px\)/);
});
