"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { LINE_DRAW_EASE } from "../shared/animation";
import { MainLineSidebar, type MainLineSidebarItem } from "./MainLineSidebar";

gsap.registerPlugin(useGSAP);

type RectAttrs = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type MainLayout = {
  cmX: number;
  cmY: number;
  fullHeight: number;
  fullWidth: number;
  insetX: number;
  lineHeight: number;
  lineBottom: number;
  lineTop: number;
  mainSurface: RectAttrs;
  separator: RectAttrs;
  sidebarLeft: number;
  sidebarTop: number;
  sidebarWidth: number;
  topSurface: RectAttrs;
  transitionCenter: RectAttrs;
  transitionFinal: RectAttrs;
  transitionFull: RectAttrs;
};

const LOGICAL_SCREEN_WIDTH = 34;
const LOGICAL_SCREEN_HEIGHT = 19;
const MAIN_NAV_ITEMS: MainLineSidebarItem[] = [
  { key: "dashboard", label: "总览", english: "Dashboard" },
  { key: "profile", label: "安全画像", english: "Profile" },
  { key: "anatomy", label: "攻击图谱", english: "Anatomy" },
  { key: "run", label: "测评运行", english: "Run" },
  { key: "report", label: "测评报告", english: "Report" },
  { key: "agent", label: "初始接口", english: "Agent" },
  { key: "setting", label: "设置", english: "Setting" },
];

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
  const sidebarWidth = Math.min(Math.max(snap(7 * cmX), 260), sidebarMaxWidth);

  return {
    cmX,
    cmY,
    fullHeight,
    fullWidth,
    insetX,
    lineHeight,
    lineBottom,
    lineTop,
    sidebarLeft,
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

export function MainWindow() {
  const [activeNavKey, setActiveNavKey] = useState(MAIN_NAV_ITEMS[0].key);
  const rootRef = useRef<HTMLElement>(null);
  const topSurfaceRef = useRef<SVGRectElement>(null);
  const mainSurfaceRef = useRef<SVGRectElement>(null);
  const separatorRef = useRef<SVGRectElement>(null);
  const transitionBlueRef = useRef<SVGRectElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      const topSurface = topSurfaceRef.current;
      const mainSurface = mainSurfaceRef.current;
      const separator = separatorRef.current;
      const transitionBlue = transitionBlueRef.current;

      if (!root || !topSurface || !mainSurface || !separator || !transitionBlue) {
        return;
      }

      const sidebar = root.querySelector<HTMLElement>(".main-line-sidebar");
      const sidebarItems = gsap.utils.toArray<HTMLElement>(
        ".main-line-sidebar-item",
        root,
      );
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      let introTimeline: gsap.core.Timeline | null = null;
      let hasSettled = false;

      const renderSurfaceLayout = (layout: MainLayout) => {
        setRectAttrs(topSurface, layout.topSurface);
        setRectAttrs(mainSurface, layout.mainSurface);
        setPxVar(root, "--main-cm-x", layout.cmX);
        setPxVar(root, "--main-cm-y", layout.cmY);
        setPxVar(root, "--main-separator-y", layout.lineTop);
        setPxVar(root, "--main-separator-height", layout.lineHeight);
        setPxVar(root, "--main-sidebar-left", layout.sidebarLeft);
        setPxVar(root, "--main-sidebar-top", layout.sidebarTop);
        setPxVar(root, "--main-sidebar-width", layout.sidebarWidth);
      };

      const renderSettledLayout = (layout = getMainLayout()) => {
        renderSurfaceLayout(layout);
        setRectAttrs(separator, layout.separator);
        setRectAttrs(transitionBlue, layout.transitionFinal);
        gsap.set(separator, { autoAlpha: 1 });
        gsap.set(transitionBlue, { autoAlpha: 0 });
        gsap.set(sidebar, { autoAlpha: 1, x: 0 });
        gsap.set(sidebarItems, { autoAlpha: 1, x: 0, y: 0 });
        root.setAttribute("data-main-window-stage", "settled");
      };

      const renderInitialLayout = (layout = getMainLayout()) => {
        renderSurfaceLayout(layout);
        setRectAttrs(separator, layout.separator);
        setRectAttrs(transitionBlue, layout.transitionFull);
        gsap.set(separator, { autoAlpha: 0 });
        gsap.set(transitionBlue, { autoAlpha: 1 });
        gsap.set(sidebar, { autoAlpha: 0, x: -18 });
        gsap.set(sidebarItems, { autoAlpha: 0, x: -12, y: 4 });
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
          .set(separator, { autoAlpha: 1 }, 1.4)
          .set(transitionBlue, { autoAlpha: 0 }, 1.4)
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
      };

      const handleResize = () => {
        if (hasSettled || prefersReducedMotion) {
          renderSettledLayout();
          return;
        }

        playIntro();
      };

      playIntro();
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
        introTimeline?.kill();
        gsap.killTweensOf([
          transitionBlue,
          separator,
          topSurface,
          mainSurface,
          sidebar,
          ...sidebarItems,
        ]);
      };
    },
    { scope: rootRef },
  );

  return (
    <main ref={rootRef} className="main-window" data-main-window-stage="intro">
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
      </svg>
      <MainLineSidebar
        activeKey={activeNavKey}
        items={MAIN_NAV_ITEMS}
        onSelect={(item) => setActiveNavKey(item.key)}
      />
    </main>
  );
}
