"use client";

import { useCallback, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { LINE_DRAW_EASE } from "../shared/animation";
import { DEFAULT_AGENT_ID } from "../shared/agent-config";
import { AgentInterfaceWorkspace } from "./agent/AgentInterfaceWorkspace";
import { AttackGraphWorkspace } from "./anatomy/AnatomyGraph";
import { MainLineSidebar, type MainLineSidebarItem } from "./MainLineSidebar";
import { MainSidebarToggleButton } from "./MainSidebarToggleButton";
import { OverviewDashboard } from "./overview/OverviewDashboard";
import { securityProfileFixtureViewModel } from "./profile/profile-fixtures";
import { SecurityProfileGraph } from "./profile/SecurityProfileGraph";
import { AccountSettingsWorkspace, type AccountIdentity } from "./settings/AccountSettingsWorkspace";
import {
  EvaluationReportWorkspace,
  EvaluationRunWorkspace,
  EvaluationWorkspaceProvider,
} from "./evaluation";
import { clearEvaluationWorkspaceSession } from "./evaluation/evaluation-session";
import type { SidebarContentMetrics } from "./shared/useFrozenGraphInlineSize";

gsap.registerPlugin(useGSAP);

type RectAttrs = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type MainLayout = {
  brandX: number;
  brandY: number;
  cmX: number;
  cmY: number;
  contentCollapsedLeft: number;
  contentCollapsedInlineSize: number;
  fullHeight: number;
  fullWidth: number;
  insetX: number;
  lineHeight: number;
  lineBottom: number;
  lineTop: number;
  contentBottom: number;
  contentLeft: number;
  contentOpenInlineSize: number;
  contentRight: number;
  contentTop: number;
  mainSurface: RectAttrs;
  separator: RectAttrs;
  sidebarLeft: number;
  sidebarToggleCollapsedLeft: number;
  sidebarTop: number;
  sidebarWidth: number;
  topSurface: RectAttrs;
  transitionCenter: RectAttrs;
  transitionFinal: RectAttrs;
  transitionFull: RectAttrs;
};

const LOGICAL_SCREEN_WIDTH = 34;
const LOGICAL_SCREEN_HEIGHT = 19;
const SIDEBAR_WIDTH_UNITS = 5.65;
const SIDEBAR_WIDTH_MIN = 224;
const SIDEBAR_WIDTH_MAX = 252;
const SIDEBAR_TO_CONTENT_GAP_UNITS = 0.3;
const SIDEBAR_TOGGLE_SIZE = 44;
type MainNavKey =
  | "agent"
  | "anatomy"
  | "dashboard"
  | "profile"
  | "report"
  | "run"
  | "setting";

type MainWindowNavItem = MainLineSidebarItem & {
  key: MainNavKey;
};

const MAIN_NAV_ITEMS: MainWindowNavItem[] = [
  { key: "dashboard", label: "总览", english: "默认视图" },
  { key: "profile", label: "安全画像", english: "能力边界" },
  { key: "anatomy", label: "攻击图谱", english: "风险路径" },
  { key: "run", label: "测评运行", english: "执行流程" },
  { key: "report", label: "测评报告", english: "证据结论" },
  { key: "agent", label: "初始接口", english: "接口接入" },
  { key: "setting", label: "设置", english: "账号中心" },
];

const MAIN_MODULE_PLACEHOLDERS: Record<
  Exclude<MainNavKey, "dashboard">,
  { description: string; english: string; label: string }
> = {
  agent: {
    description: "智能体清单接入与示例对象确认将在此区域展开。",
    english: "接口接入",
    label: "初始接口",
  },
  anatomy: {
    description: "攻击图谱工作台将在此区域承接 R4 风险路径的展开分析。",
    english: "风险路径",
    label: "攻击图谱",
  },
  profile: {
    description: "安全画像将在此区域呈现工具权限、记忆资产与数据源边界。",
    english: "能力边界",
    label: "安全画像",
  },
  report: {
    description: "测评报告将在此区域复盘风险结论、发现项与证据。",
    english: "证据结论",
    label: "测评报告",
  },
  run: {
    description: "测评运行将在此区域展示用例编排与执行时间线。",
    english: "执行流程",
    label: "测评运行",
  },
  setting: {
    description: "管理个人身份、访问密码与当前账号会话。",
    english: "账号中心",
    label: "设置",
  },
};

function createSnapper(devicePixelRatio: number) {
  return (value: number) => Math.round(value * devicePixelRatio) / devicePixelRatio;
}

function getMainLayout(): MainLayout {
  const fullWidth = window.innerWidth;
  const fullHeight = window.innerHeight;
  const devicePixelRatio = window.devicePixelRatio || 1;
  const snap = createSnapper(devicePixelRatio);
  const cmX = fullWidth / LOGICAL_SCREEN_WIDTH;
  const cmY = fullHeight / LOGICAL_SCREEN_HEIGHT;
  const lineHeight = snap(3 / devicePixelRatio);
  const y1 = snap(2 * cmY);
  const y2 = snap(fullHeight / 2);
  const insetX = snap(2 * cmX);
  const lineTop = snap(y1 - lineHeight / 2);
  const lineBottom = snap(lineTop + lineHeight);
  const centerLineTop = snap(y2 - lineHeight / 2);
  const finalWidth = Math.max(snap(fullWidth - insetX * 2), lineHeight);
  const sidebarLeft = snap(1.25 * cmX);
  const sidebarTop = snap(lineBottom + 1.25 * cmY);
  const sidebarMaxWidth = Math.max(snap(fullWidth - insetX * 2), 220);
  const sidebarWidth = Math.min(
    Math.max(snap(SIDEBAR_WIDTH_UNITS * cmX), SIDEBAR_WIDTH_MIN),
    Math.min(sidebarMaxWidth, SIDEBAR_WIDTH_MAX),
  );
  const contentLeft = snap(
    sidebarLeft + sidebarWidth + SIDEBAR_TO_CONTENT_GAP_UNITS * cmX,
  );
  const sidebarToggleCollapsedLeft = snap(Math.max(16, cmX * 0.52));
  const contentCollapsedLeft = snap(
    sidebarToggleCollapsedLeft +
      SIDEBAR_TOGGLE_SIZE +
      Math.max(16, cmX * 0.55),
  );
  const contentTop = snap(lineBottom + 0.72 * cmY);
  const contentRight = snap(1.78 * cmX);
  const contentBottom = snap(1.1 * cmY);
  const contentOpenInlineSize = snap(
    Math.max(fullWidth - contentLeft - contentRight, 0),
  );
  const contentCollapsedInlineSize = snap(
    Math.max(fullWidth - contentCollapsedLeft - contentRight, 0),
  );

  return {
    brandX: insetX,
    brandY: snap(lineTop - 0.55 * cmY),
    cmX,
    cmY,
    contentCollapsedLeft,
    contentCollapsedInlineSize,
    contentBottom,
    contentLeft,
    contentOpenInlineSize,
    contentRight,
    contentTop,
    fullHeight,
    fullWidth,
    insetX,
    lineHeight,
    lineBottom,
    lineTop,
    sidebarLeft,
    sidebarToggleCollapsedLeft,
    sidebarTop,
    sidebarWidth,
    topSurface: {
      x: 0,
      y: 0,
      width: fullWidth,
      height: Math.max(lineTop, 0),
    },
    separator: {
      x: insetX,
      y: lineTop,
      width: finalWidth,
      height: lineHeight,
    },
    mainSurface: {
      x: 0,
      y: lineBottom,
      width: fullWidth,
      height: Math.max(fullHeight - lineBottom, 0),
    },
    transitionFull: {
      x: 0,
      y: 0,
      width: fullWidth,
      height: fullHeight,
    },
    transitionCenter: {
      x: 0,
      y: centerLineTop,
      width: fullWidth,
      height: lineHeight,
    },
    transitionFinal: {
      x: insetX,
      y: lineTop,
      width: finalWidth,
      height: lineHeight,
    },
  };
}

function setRectAttrs(rect: SVGRectElement, attrs: RectAttrs) {
  gsap.set(rect, {
    attr: attrs,
  });
}

function setPxVar(element: HTMLElement, name: string, value: number) {
  element.style.setProperty(name, `${value}px`);
}

function restoreContentPageShell(pageShell: HTMLDivElement | null) {
  if (!pageShell) {
    return;
  }
  gsap.set(pageShell, {
    autoAlpha: 1,
    pointerEvents: "auto",
    y: 0,
  });
}

function MainModulePlaceholder({
  activeNavKey,
}: {
  activeNavKey: Exclude<MainNavKey, "dashboard">;
}) {
  const placeholder = MAIN_MODULE_PLACEHOLDERS[activeNavKey];

  return (
    <section className="main-module-placeholder" aria-label={placeholder.label}>
      <span>{placeholder.english}</span>
      <h1>{placeholder.label}</h1>
      <p>{placeholder.description}</p>
    </section>
  );
}

function MainWindowContent({
  activeNavKey,
  activeAgentId,
  accountIdentity,
  isSidebarGraphFrozen,
  onAgentSaved,
  onLogout,
  onNavigate,
  sidebarContentMetrics,
}: {
  activeAgentId: string;
  activeNavKey: MainNavKey;
  accountIdentity?: AccountIdentity | null;
  isSidebarGraphFrozen: boolean;
  onAgentSaved: (agentId: string) => void;
  onLogout: () => void;
  onNavigate: (key: MainNavKey) => void;
  sidebarContentMetrics: SidebarContentMetrics;
}) {
  if (activeNavKey === "dashboard") {
    return (
      <OverviewDashboard
        activeAgentId={activeAgentId}
        isGraphFrozen={isSidebarGraphFrozen}
        onNavigate={onNavigate}
        sidebarContentMetrics={sidebarContentMetrics}
      />
    );
  }

  if (activeNavKey === "profile") {
    return (
      <SecurityProfileGraph
        isGraphFrozen={isSidebarGraphFrozen}
        sidebarContentMetrics={sidebarContentMetrics}
        viewModel={securityProfileFixtureViewModel}
      />
    );
  }

  if (activeNavKey === "anatomy") {
    return <AttackGraphWorkspace agentId={activeAgentId} onNavigate={onNavigate} />;
  }

  if (activeNavKey === "run") {
    return <EvaluationRunWorkspace onNavigate={onNavigate} />;
  }

  if (activeNavKey === "report") {
    return <EvaluationReportWorkspace onNavigate={onNavigate} />;
  }

  if (activeNavKey === "agent") {
    return (
      <AgentInterfaceWorkspace
        activeAgentId={activeAgentId}
        onAgentSaved={onAgentSaved}
      />
    );
  }

  if (activeNavKey === "setting") {
    return <AccountSettingsWorkspace fallbackIdentity={accountIdentity} onLogout={onLogout} />;
  }

  return <MainModulePlaceholder activeNavKey={activeNavKey} />;
}

export function MainWindow({
  accountIdentity = null,
  initialAgentId = DEFAULT_AGENT_ID,
  mockMode = false,
  onLogout = () => undefined,
}: {
  initialAgentId?: string;
  accountIdentity?: AccountIdentity | null;
  mockMode?: boolean;
  onLogout?: () => void;
}) {
  const [activeAgentId, setActiveAgentId] = useState(initialAgentId);
  const [activeNavKey, setActiveNavKey] = useState<MainNavKey>("dashboard");
  const [renderedNavKey, setRenderedNavKey] = useState<MainNavKey>("dashboard");
  const [restartToken, setRestartToken] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarGraphFrozen, setIsSidebarGraphFrozen] = useState(false);
  const [sidebarContentMetrics, setSidebarContentMetrics] =
    useState<SidebarContentMetrics>({
      collapsedInlineSize: 0,
      openInlineSize: 0,
    });
  const rootRef = useRef<HTMLElement>(null);
  const contentPageRef = useRef<HTMLDivElement>(null);
  const contentSwapTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const sidebarCollapseTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const isSidebarCollapsedRef = useRef(false);
  const isSidebarGraphFrozenRef = useRef(false);
  const navigationTargetRef = useRef<MainNavKey | null>(null);
  const topSurfaceRef = useRef<SVGRectElement>(null);
  const mainSurfaceRef = useRef<SVGRectElement>(null);
  const separatorRef = useRef<SVGRectElement>(null);
  const transitionBlueRef = useRef<SVGRectElement>(null);
  const brandRef = useRef<SVGTextElement>(null);

  isSidebarCollapsedRef.current = isSidebarCollapsed;
  isSidebarGraphFrozenRef.current = isSidebarGraphFrozen;

  const setSidebarGraphFrozen = useCallback((nextIsFrozen: boolean) => {
    isSidebarGraphFrozenRef.current = nextIsFrozen;
    rootRef.current?.setAttribute(
      "data-sidebar-graph-frozen",
      String(nextIsFrozen),
    );
    setIsSidebarGraphFrozen(nextIsFrozen);
  }, []);

  const handleSidebarToggle = useCallback(() => {
    const nextIsCollapsed = !isSidebarCollapsedRef.current;
    isSidebarCollapsedRef.current = nextIsCollapsed;
    if (nextIsCollapsed) {
      setSidebarGraphFrozen(true);
    }
    rootRef.current?.setAttribute(
      "data-sidebar-collapsed",
      String(nextIsCollapsed),
    );
    setIsSidebarCollapsed(nextIsCollapsed);

    const collapseTimeline = sidebarCollapseTimelineRef.current;

    if (!collapseTimeline) {
      if (!nextIsCollapsed) {
        setSidebarGraphFrozen(false);
      }
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      collapseTimeline.pause(nextIsCollapsed ? 1 : 0);
      if (!nextIsCollapsed) {
        setSidebarGraphFrozen(false);
      }
      return;
    }

    if (nextIsCollapsed) {
      sidebarCollapseTimelineRef.current?.play();
      return;
    }

    sidebarCollapseTimelineRef.current?.reverse();
  }, [setSidebarGraphFrozen]);

  const handleMainNavSelect = useCallback(
    (nextNavKey: MainNavKey) => {
      if (nextNavKey === activeNavKey) {
        return;
      }

      const pageShell = contentPageRef.current;
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      contentSwapTimelineRef.current?.kill();
      navigationTargetRef.current = nextNavKey;
      restoreContentPageShell(pageShell);
      setActiveNavKey(nextNavKey);

      if (!pageShell || prefersReducedMotion) {
        navigationTargetRef.current = null;
        setRenderedNavKey(nextNavKey);
        return;
      }

      contentSwapTimelineRef.current = gsap.timeline({
        onComplete: () => {
          const targetNavKey = navigationTargetRef.current ?? nextNavKey;
          if (targetNavKey !== nextNavKey) {
            return;
          }
          setRenderedNavKey(targetNavKey);
          navigationTargetRef.current = null;
          contentSwapTimelineRef.current = null;
        },
        onInterrupt: () => {
          restoreContentPageShell(pageShell);
          if (navigationTargetRef.current === nextNavKey) {
            navigationTargetRef.current = null;
          }
          contentSwapTimelineRef.current = null;
        },
      });

      contentSwapTimelineRef.current
        .set(pageShell, { pointerEvents: "none" })
        .to(pageShell, {
          autoAlpha: 0,
          duration: 0.22,
          ease: "power2.in",
          y: 8,
        });
    },
    [activeNavKey],
  );

  const handleAgentSaved = useCallback((agentId: string) => {
    clearEvaluationWorkspaceSession();
    setActiveAgentId(agentId);
    setActiveNavKey("dashboard");
    setRenderedNavKey("dashboard");
    setRestartToken((value) => value + 1);
  }, []);

  useGSAP(
    () => {
      const root = rootRef.current;
      const topSurface = topSurfaceRef.current;
      const mainSurface = mainSurfaceRef.current;
      const separator = separatorRef.current;
      const transitionBlue = transitionBlueRef.current;
      const brand = brandRef.current;

      if (!root || !topSurface || !mainSurface || !separator || !transitionBlue || !brand) {
        return;
      }

      const sidebar = root.querySelector<HTMLElement>(".main-line-sidebar");
      const contentRegion = root.querySelector<HTMLElement>(".main-content-region");
      const sidebarToggleButton = root.querySelector<HTMLElement>(
        ".main-sidebar-toggle-button",
      );
      const sidebarToggleIcon = root.querySelector<SVGGElement>(
        ".main-sidebar-toggle-icon",
      );
      const sidebarItems = gsap.utils.toArray<HTMLElement>(
        ".main-line-sidebar-item",
        root,
      );
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!sidebar || !contentRegion || !sidebarToggleButton || !sidebarToggleIcon) {
        return;
      }

      let introTimeline: gsap.core.Timeline | null = null;
      let hasSettled = false;

      const renderSurfaceLayout = (layout: MainLayout) => {
        setRectAttrs(topSurface, layout.topSurface);
        setRectAttrs(mainSurface, layout.mainSurface);
        gsap.set(brand, { attr: { x: layout.brandX, y: layout.brandY } });
        setPxVar(root, "--main-cm-x", layout.cmX);
        setPxVar(root, "--main-cm-y", layout.cmY);
        setPxVar(root, "--main-separator-y", layout.lineTop);
        setPxVar(root, "--main-separator-height", layout.lineHeight);
        setPxVar(root, "--main-sidebar-left", layout.sidebarLeft);
        setPxVar(root, "--main-sidebar-top", layout.sidebarTop);
        setPxVar(root, "--main-sidebar-width", layout.sidebarWidth);
        setPxVar(root, "--main-sidebar-toggle-left", layout.sidebarLeft);
        setPxVar(root, "--main-content-bottom", layout.contentBottom);
        setPxVar(root, "--main-content-left", layout.contentLeft);
        setPxVar(
          root,
          "--main-content-open-inline-size",
          layout.contentOpenInlineSize,
        );
        setPxVar(
          root,
          "--main-content-collapsed-inline-size",
          layout.contentCollapsedInlineSize,
        );
        setPxVar(root, "--main-content-right", layout.contentRight);
        setPxVar(root, "--main-content-top", layout.contentTop);
        setSidebarContentMetrics({
          collapsedInlineSize: layout.contentCollapsedInlineSize,
          openInlineSize: layout.contentOpenInlineSize,
        });
      };

      const createSidebarCollapseTimeline = (layout: MainLayout) => {
        const timeline = gsap.timeline({
          onReverseComplete: () => {
            if (!isSidebarCollapsedRef.current) {
              setSidebarGraphFrozen(false);
            }
          },
          paused: true,
          defaults: {
            duration: 0.6,
            ease: "power3.inOut",
          },
        });

        timeline
          .addLabel("collapse", 0)
          .to(
            sidebar,
            {
              autoAlpha: 0,
              duration: 0.48,
              x: -layout.sidebarWidth - Math.max(18, layout.cmX * 0.36),
            },
            "collapse",
          )
          .to(
            sidebarItems,
            {
              autoAlpha: 0,
              duration: 0.3,
              stagger: 0.025,
              x: -10,
              y: 4,
            },
            "collapse",
          )
          .to(
            root,
            {
              "--main-content-left": `${layout.contentCollapsedLeft}px`,
            },
            "collapse",
          )
          .to(
            sidebarToggleButton,
            {
              x: layout.sidebarToggleCollapsedLeft - layout.sidebarLeft,
            },
            "collapse",
          )
          .to(
            sidebarToggleIcon,
            {
              rotation: 180,
              svgOrigin: "22 22",
            },
            "collapse",
          );

        return timeline;
      };

      const renderSettledLayout = (layout = getMainLayout()) => {
        sidebarCollapseTimelineRef.current?.kill();
        renderSurfaceLayout(layout);
        setRectAttrs(separator, layout.separator);
        setRectAttrs(transitionBlue, layout.transitionFinal);
        gsap.set(separator, { autoAlpha: 1 });
        gsap.set(transitionBlue, { autoAlpha: 0 });
        gsap.set(brand, { autoAlpha: 1, y: 0 });
        gsap.set(sidebar, { autoAlpha: 1, x: 0 });
        gsap.set(sidebarItems, { autoAlpha: 1, x: 0, y: 0 });
        gsap.set(sidebarToggleButton, { autoAlpha: 1, x: 0 });
        gsap.set(sidebarToggleIcon, {
          rotation: 0,
          svgOrigin: "22 22",
        });
        gsap.set(contentRegion, { autoAlpha: 1, y: 0 });
        sidebarCollapseTimelineRef.current = createSidebarCollapseTimeline(layout);
        sidebarCollapseTimelineRef.current.pause(
          isSidebarCollapsedRef.current ? 1 : 0,
        );
        root.setAttribute("data-main-window-stage", "settled");
      };

      const renderInitialLayout = (layout = getMainLayout()) => {
        sidebarCollapseTimelineRef.current?.kill();
        sidebarCollapseTimelineRef.current = null;
        renderSurfaceLayout(layout);
        setRectAttrs(separator, layout.separator);
        setRectAttrs(transitionBlue, layout.transitionFull);
        gsap.set(separator, { autoAlpha: 0 });
        gsap.set(transitionBlue, { autoAlpha: 1 });
        gsap.set(brand, { autoAlpha: 0, y: 6 });
        gsap.set(sidebar, { autoAlpha: 0, x: -18 });
        gsap.set(sidebarItems, { autoAlpha: 0, x: -12, y: 4 });
        gsap.set(sidebarToggleButton, { autoAlpha: 0, x: 0 });
        gsap.set(sidebarToggleIcon, {
          rotation: 0,
          svgOrigin: "22 22",
        });
        gsap.set(contentRegion, { autoAlpha: 0, y: 16 });
        root.setAttribute("data-main-window-stage", "intro");
      };

      const playIntro = () => {
        introTimeline?.kill();
        const layout = getMainLayout();

        if (prefersReducedMotion) {
          hasSettled = true;
          renderSettledLayout(layout);
          return;
        }

        hasSettled = false;
        renderInitialLayout(layout);

        introTimeline = gsap.timeline({
          onComplete: () => {
            hasSettled = true;
            renderSettledLayout(getMainLayout());
            introTimeline = null;
          },
          onInterrupt: () => {
            hasSettled = true;
            renderSettledLayout(getMainLayout());
            introTimeline = null;
          },
        });

        introTimeline
          .to(
            transitionBlue,
            {
              attr: layout.transitionCenter,
              duration: 0.4,
              ease: LINE_DRAW_EASE,
            },
            0.2,
          )
          .to(
            transitionBlue,
            {
              attr: layout.transitionFinal,
              duration: 0.4,
              ease: LINE_DRAW_EASE,
            },
            1,
          )
          .addLabel("brandReveal", 1.12)
          .to(
            brand,
            {
              autoAlpha: 1,
              duration: 0.36,
              ease: "power2.out",
              y: 0,
            },
            "brandReveal",
          )
          .set(separator, { autoAlpha: 1 }, 1.4)
          .set(transitionBlue, { autoAlpha: 0 }, 1.4)
          .to(
            sidebarToggleButton,
            {
              autoAlpha: 1,
              duration: 0.36,
              ease: "power2.out",
            },
            1.2,
          )
          .to(
            contentRegion,
            {
              autoAlpha: 1,
              duration: 0.5,
              ease: LINE_DRAW_EASE,
              y: 0,
            },
            1.34,
          );

        if (!isSidebarCollapsedRef.current) {
          introTimeline
            .to(
              sidebar,
              {
                autoAlpha: 1,
                duration: 0.45,
                ease: LINE_DRAW_EASE,
                x: 0,
              },
              1.18,
            )
            .to(
              sidebarItems,
              {
                autoAlpha: 1,
                duration: 0.42,
                ease: "power3.out",
                stagger: 0.045,
                x: 0,
                y: 0,
              },
              1.2,
            );
        }
      };

      const handleResize = () => {
        if (hasSettled || prefersReducedMotion) {
          renderSettledLayout();
          if (!isSidebarCollapsedRef.current) {
            setSidebarGraphFrozen(false);
          }
          return;
        }

        playIntro();
      };

      playIntro();
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        introTimeline?.kill();
        sidebarCollapseTimelineRef.current?.kill();
        sidebarCollapseTimelineRef.current = null;
        contentSwapTimelineRef.current?.kill();
        gsap.killTweensOf([
          transitionBlue,
          brand,
          separator,
          topSurface,
          mainSurface,
          sidebar,
          sidebarToggleButton,
          sidebarToggleIcon,
          contentRegion,
          ...sidebarItems,
        ]);
      };
    },
    { dependencies: [restartToken, setSidebarGraphFrozen], scope: rootRef },
  );

  useGSAP(
    () => {
      const pageShell = contentPageRef.current;

      if (!pageShell) {
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;

      if (prefersReducedMotion) {
        gsap.set(pageShell, {
          autoAlpha: 1,
          pointerEvents: "auto",
          y: 0,
        });
        return;
      }

      const timeline = gsap.timeline({
        defaults: { ease: LINE_DRAW_EASE },
        onComplete: () => {
          restoreContentPageShell(pageShell);
        },
        onInterrupt: () => {
          restoreContentPageShell(pageShell);
        },
      });

      timeline
        .fromTo(
          pageShell,
          {
            autoAlpha: 0,
            y: 10,
          },
          {
            autoAlpha: 1,
            duration: 0.38,
            y: 0,
          },
        )
        .set(pageShell, { pointerEvents: "auto" });

      return () => {
        timeline.kill();
        restoreContentPageShell(pageShell);
      };
    },
    { dependencies: [renderedNavKey], scope: rootRef },
  );

  return (
    <main
      ref={rootRef}
      className="main-window"
      data-main-window-stage="intro"
      data-sidebar-collapsed={isSidebarCollapsed}
      data-sidebar-graph-frozen={isSidebarGraphFrozen}
      aria-label="AgentProof Agent 安全评估平台"
    >
      <svg className="main-window-svg" aria-hidden="true" focusable="false">
        <rect ref={topSurfaceRef} className="main-window-surface" x={0} y={0} width={0} height={0} />
        <rect ref={mainSurfaceRef} className="main-window-surface" x={0} y={0} width={0} height={0} />
        <rect
          ref={separatorRef}
          className="main-window-separator"
          x={0}
          y={0}
          width={0}
          height={0}
          shapeRendering="crispEdges"
        />
        <rect
          ref={transitionBlueRef}
          className="main-window-transition-blue"
          x={0}
          y={0}
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
        />
        <text ref={brandRef} className="main-window-brand-word">
          AgentProof
        </text>
      </svg>
      <MainLineSidebar
        activeKey={activeNavKey}
        id="main-line-sidebar"
        isCollapsed={isSidebarCollapsed}
        items={MAIN_NAV_ITEMS}
        onSelect={(item) => handleMainNavSelect(item.key as MainNavKey)}
      />
      <MainSidebarToggleButton
        controlsId="main-line-sidebar"
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
      />
      <EvaluationWorkspaceProvider
        key={activeAgentId}
        activeAgentId={activeAgentId}
        mockMode={mockMode}
        onNavigate={handleMainNavSelect}
      >
        <section className="main-content-region">
          <div
            key={renderedNavKey}
            ref={contentPageRef}
            className="main-content-page-shell"
          >
            <MainWindowContent
              activeAgentId={activeAgentId}
              activeNavKey={renderedNavKey}
              accountIdentity={accountIdentity}
              isSidebarGraphFrozen={isSidebarGraphFrozen}
              onAgentSaved={handleAgentSaved}
              onLogout={onLogout}
              onNavigate={handleMainNavSelect}
              sidebarContentMetrics={sidebarContentMetrics}
            />
          </div>
        </section>
      </EvaluationWorkspaceProvider>
    </main>
  );
}
