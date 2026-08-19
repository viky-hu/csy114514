"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Mouse, X } from "lucide-react";
import { LINE_DRAW_EASE } from "../shared/animation";
import {
  CORPMATE_AGENT_DRAFT,
  DEFAULT_AGENT_ID,
  buildAgentManifest,
  type AgentDraftState,
} from "../shared/agent-config";
import { AgentConnectDraft } from "./AgentConnectDraft";
import { createLoginBandMotionController } from "./login-band-motion-controller";
import { LoginForm } from "./LoginForm";

gsap.registerPlugin(useGSAP, ScrollTrigger);

type PanelStage = "idle" | "opening" | "open" | "closing";
type AgentEntryStage = "idle" | "loading" | "done";

const SYSTEM_TITLE_PRIMARY = "Agent 安全评估平台";
const SYSTEM_TITLE_SECONDARY = "可解释攻击链路可视化系统";
const BRAND_WORD = "AegisTrace";
const CTA_LOGIN_PRIMARY = "账号";
const CTA_LOGIN_SECONDARY = "登录";
const CTA_AUTHENTICATED_PRIMARY = "已登录";
const CTA_AUTHENTICATED_SECONDARY = "";
const AGENT_ENTRY_PROMPT = "请接入你的测评对象Agent";
const INFO_COPY_LINES = [
  "把 Agent 结构、攻击路径、评估过程与证据报告组织成",
  "可观察、可解释、可复现、可修复的安全认知过程，",
  "让黑盒测试结果转化为能够指导修复的分析结论。",
] as const;
const MICRO_COPY = "OBSERVABLE / EXPLAINABLE / REPRODUCIBLE / FIXABLE";
const LOADING_LABEL = "Loading...";
const LOADING_BOXES = [1, 2, 3, 4] as const;

interface LoginIntroWindowProps {
  onAgentEntryComplete?: (agentId: string) => void;
  onSignIn: (isAdmin: boolean, account: string, nodeType?: string) => void;
}

export function LoginIntroWindow({ onAgentEntryComplete, onSignIn }: LoginIntroWindowProps) {
  const [panelStage, setPanelStage] = useState<PanelStage>("idle");
  const [agentEntryStage, setAgentEntryStage] = useState<AgentEntryStage>("idle");
  const [agentDraft, setAgentDraft] =
    useState<AgentDraftState>(CORPMATE_AGENT_DRAFT);
  const [agentSaveError, setAgentSaveError] = useState<string | null>(null);
  const [isAgentSaving, setIsAgentSaving] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isScrollReady, setIsScrollReady] = useState(false);
  const ctaPrimaryLabel = isAuthenticated ? CTA_AUTHENTICATED_PRIMARY : CTA_LOGIN_PRIMARY;
  const ctaSecondaryLabel = isAuthenticated
    ? CTA_AUTHENTICATED_SECONDARY
    : CTA_LOGIN_SECONDARY;

  const panelStageRef = useRef<PanelStage>("idle");
  const agentEntryStageRef = useRef<AgentEntryStage>("idle");
  const isAuthenticatedRef = useRef(false);
  const isScrollReadyRef = useRef(false);
  const pendingAuthenticatedCloseRef = useRef(false);
  const requestAuthenticatedCloseRef = useRef<() => void>(() => undefined);
  const beginAgentLoadingRef = useRef<(agentId?: string) => void>(() => undefined);
  const completedAgentIdRef = useRef(DEFAULT_AGENT_ID);
  const syncCtaLayoutRef = useRef<() => void>(() => undefined);
  const pageRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const scrollHintRef = useRef<HTMLDivElement>(null);
  const baseSceneRef = useRef<SVGGElement>(null);
  const invertedSceneRef = useRef<SVGGElement>(null);
  const panelDimRef = useRef<HTMLDivElement>(null);
  const panelShellRef = useRef<HTMLDivElement>(null);
  const panelCloseRef = useRef<HTMLButtonElement>(null);
  const panelFormWrapRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<SVGRectElement>(null);
  const bandClipRef = useRef<SVGRectElement>(null);
  const topRuleRef = useRef<SVGLineElement>(null);
  const topRuleInvertedRef = useRef<SVGLineElement>(null);
  const brandRef = useRef<SVGTextElement>(null);
  const invertedBrandRef = useRef<SVGTextElement>(null);
  const titlePrimaryRef = useRef<SVGTextElement>(null);
  const titleSecondaryRef = useRef<SVGTextElement>(null);
  const invertedTitlePrimaryRef = useRef<SVGTextElement>(null);
  const invertedTitleSecondaryRef = useRef<SVGTextElement>(null);
  const infoLineOneRef = useRef<SVGTextElement>(null);
  const infoLineTwoRef = useRef<SVGTextElement>(null);
  const infoLineThreeRef = useRef<SVGTextElement>(null);
  const invertedInfoLineOneRef = useRef<SVGTextElement>(null);
  const invertedInfoLineTwoRef = useRef<SVGTextElement>(null);
  const invertedInfoLineThreeRef = useRef<SVGTextElement>(null);
  const microCopyRef = useRef<SVGTextElement>(null);
  const invertedMicroCopyRef = useRef<SVGTextElement>(null);
  const ctaLeftBracketRef = useRef<SVGTextElement>(null);
  const ctaPrimaryRef = useRef<SVGTextElement>(null);
  const ctaSecondaryRef = useRef<SVGTextElement>(null);
  const ctaRightBracketRef = useRef<SVGTextElement>(null);
  const invertedCtaLeftBracketRef = useRef<SVGTextElement>(null);
  const invertedCtaPrimaryRef = useRef<SVGTextElement>(null);
  const invertedCtaSecondaryRef = useRef<SVGTextElement>(null);
  const invertedCtaRightBracketRef = useRef<SVGTextElement>(null);
  const agentPromptRef = useRef<SVGTextElement>(null);
  const invertedAgentPromptRef = useRef<SVGTextElement>(null);
  const agentDraftLayerRef = useRef<HTMLDivElement>(null);
  const loadingOverlayRef = useRef<HTMLDivElement>(null);
  const loadingTextRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<number | null>(null);
  const loadingTimerRef = useRef<number | null>(null);
  const lastXRef = useRef<number | null>(null);
  const pointerXRef = useRef<number | null>(null);
  const pointerInsideRef = useRef(false);

  const handleMockSignIn = (isAdmin: boolean, account: string, nodeType?: string) => {
    onSignIn(isAdmin, account, nodeType);
    requestAuthenticatedCloseRef.current();
  };

  const getAgentErrorMessage = (value: unknown, fallback: string) => {
    if (!value || typeof value !== "object") {
      return fallback;
    }
    const error = (value as { error?: { message?: unknown } }).error;
    return typeof error?.message === "string" ? error.message : fallback;
  };

  const saveAgentManifest = async () => {
    if (isAgentSaving || agentEntryStageRef.current !== "idle") {
      return;
    }

    const manifest = buildAgentManifest(agentDraft);
    setIsAgentSaving(true);
    setAgentSaveError(null);

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      });
      const body = (await response.json()) as unknown;

      if (!response.ok) {
        throw new Error(getAgentErrorMessage(body, "Agent 接入失败"));
      }

      beginAgentLoadingRef.current(manifest.agent_id);
    } catch (error) {
      setAgentSaveError(error instanceof Error ? error.message : "Agent 接入失败");
    } finally {
      setIsAgentSaving(false);
    }
  };

  useLayoutEffect(() => {
    const frame = window.requestAnimationFrame(() => syncCtaLayoutRef.current());

    return () => window.cancelAnimationFrame(frame);
  }, [isAuthenticated]);

  useGSAP(
    (_, contextSafe) => {
      const page = pageRef.current;
      const cta = ctaRef.current;
      const scrollHint = scrollHintRef.current;
      const baseScene = baseSceneRef.current;
      const invertedScene = invertedSceneRef.current;
      const panelDim = panelDimRef.current;
      const panelShell = panelShellRef.current;
      const panelClose = panelCloseRef.current;
      const panelFormWrap = panelFormWrapRef.current;
      const agentDraftLayer = agentDraftLayerRef.current;
      const loadingOverlay = loadingOverlayRef.current;
      const loadingText = loadingTextRef.current;
      const band = bandRef.current;
      const bandClip = bandClipRef.current;
      const topRule = topRuleRef.current;
      const topRuleInverted = topRuleInvertedRef.current;

      const titleNodes = [
        [titlePrimaryRef.current, titleSecondaryRef.current],
        [invertedTitlePrimaryRef.current, invertedTitleSecondaryRef.current],
      ];
      const infoNodes = [
        [infoLineOneRef.current, infoLineTwoRef.current, infoLineThreeRef.current],
        [
          invertedInfoLineOneRef.current,
          invertedInfoLineTwoRef.current,
          invertedInfoLineThreeRef.current,
        ],
      ];
      const brandNodes = [brandRef.current, invertedBrandRef.current];
      const microNodes = [microCopyRef.current, invertedMicroCopyRef.current];
      const ctaNodes = [
        [
          ctaLeftBracketRef.current,
          ctaPrimaryRef.current,
          ctaSecondaryRef.current,
          ctaRightBracketRef.current,
        ],
        [
          invertedCtaLeftBracketRef.current,
          invertedCtaPrimaryRef.current,
          invertedCtaSecondaryRef.current,
          invertedCtaRightBracketRef.current,
        ],
      ];
      const agentPromptNodes = [agentPromptRef.current, invertedAgentPromptRef.current];

      if (
        !page ||
        !cta ||
        !scrollHint ||
        !baseScene ||
        !invertedScene ||
        !panelDim ||
        !panelShell ||
        !panelClose ||
        !panelFormWrap ||
        !agentDraftLayer ||
        !loadingOverlay ||
        !loadingText ||
        !band ||
        !bandClip ||
        !topRule ||
        !topRuleInverted
      ) {
        return;
      }

      const withContextSafe = <T extends (...args: never[]) => void>(callback: T) =>
        contextSafe ? contextSafe(callback) : callback;

      const setStage = (stage: PanelStage) => {
        panelStageRef.current = stage;
        setPanelStage(stage);
        syncPointerModeAttribute();
      };

      const setAgentEntryStageValue = (stage: AgentEntryStage) => {
        agentEntryStageRef.current = stage;
        setAgentEntryStage(stage);
        page.setAttribute("data-agent-entry-stage", stage);
        syncPointerModeAttribute();
      };

      const devicePixelRatio = window.devicePixelRatio || 1;
      const lineWidth = 1 / devicePixelRatio;
      const snapToDevicePixel = (value: number) =>
        Math.round(value * devicePixelRatio) / devicePixelRatio;
      const clamp = (value: number, min: number, max: number) =>
        Math.min(Math.max(value, min), max);
      const clampX = (value: number) => clamp(value, 0, window.innerWidth);
      const getTopProgressThreshold = () => 1 / Math.max(window.innerHeight, 1);
      const panelWidthInPx = 11 * (96 / 2.54);
      const getExpandedWidth = () =>
        snapToDevicePixel(Math.min(Math.max(window.innerWidth * 0.074, 72), 122));
      const getPanelWidth = () =>
        snapToDevicePixel(Math.min(window.innerWidth, panelWidthInPx));
      const getPanelCenterX = () =>
        snapToDevicePixel(window.innerWidth - getPanelWidth() / 2);
      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const initialX = snapToDevicePixel(window.innerWidth * 0.5);
      const visualState = {
        centerX: initialX,
        width: lineWidth,
      };
      let closeTimeline: gsap.core.Timeline | null = null;
      let loadingTimeline: gsap.core.Timeline | null = null;
      let loadingTextTimeline: gsap.core.Timeline | null = null;
      let scrollTrigger: ScrollTrigger | null = null;
      let openingFallbackTimer: number | null = null;
      const scrollSceneNodes = [baseScene, invertedScene];
      const agentPromptLayers = gsap.utils.toArray<SVGGElement>(
        ".login-agent-prompt-layer",
        page,
      );
      const loadingChars = gsap.utils.toArray<HTMLSpanElement>(
        ".login-agent-loading-char",
        loadingText,
      );
      const scrollState = {
        anchorX: initialX,
        entryLeft: snapToDevicePixel(initialX - lineWidth / 2),
        entryRight: snapToDevicePixel(initialX + lineWidth / 2),
        progress: 0,
        locked: false,
      };

      const isAtScrollTop = (progress = scrollState.progress) =>
        progress <= getTopProgressThreshold();
      const isTopPointerMode = () =>
        agentEntryStageRef.current === "idle" &&
        panelStageRef.current === "idle" &&
        (!isScrollReadyRef.current || isAtScrollTop());

      const syncPointerModeAttribute = () => {
        page.setAttribute("data-pointer-mode", isTopPointerMode() ? "top" : "scroll");
      };

      const renderBand = () => {
        const width = snapToDevicePixel(visualState.width);
        const x = snapToDevicePixel(clampX(visualState.centerX) - width / 2);

        page.style.setProperty("--login-panel-left", `${x}px`);
        page.style.setProperty("--login-panel-width", `${width}px`);
        page.style.setProperty(
          "--login-panel-right",
          `${Math.max(window.innerWidth - x - width, 0)}px`,
        );
        page.style.setProperty("--login-panel-height", `${window.innerHeight}px`);

        band.setAttribute("x", String(x));
        band.setAttribute("y", "0");
        band.setAttribute("width", String(width));
        band.setAttribute("height", String(window.innerHeight));

        bandClip.setAttribute("x", String(x));
        bandClip.setAttribute("y", "0");
        bandClip.setAttribute("width", String(width));
        bandClip.setAttribute("height", String(window.innerHeight * 2));
      };
      const bandMotion = createLoginBandMotionController({
        visualState,
        render: renderBand,
        createTween: (target, vars) => gsap.to(target, vars as gsap.TweenVars),
      });

      const updateAgentEntryVisibility = (progress: number) => {
        const draftFade = clamp((progress - 0.72) / 0.24, 0, 1);

        page.style.setProperty("--login-agent-draft-opacity", String(draftFade));
        page.style.setProperty(
          "--login-agent-draft-y",
          `${snapToDevicePixel((1 - draftFade) * 18)}px`,
        );
        page.setAttribute("data-agent-draft-visible", draftFade > 0 ? "true" : "false");
        page.setAttribute("data-agent-draft-ready", draftFade >= 0.98 ? "true" : "false");
      };

      const renderLockedAgentEntryPage = () => {
        scrollState.progress = 1;
        scrollState.locked = true;
        bandMotion.setImmediate("scroll", {
          centerX: snapToDevicePixel(window.innerWidth * 0.5),
          width: snapToDevicePixel(window.innerWidth),
        });
        gsap.set(scrollSceneNodes, {
          y: snapToDevicePixel(-window.innerHeight),
        });
        gsap.set(scrollHint, {
          autoAlpha: 0,
          y: 8,
        });
        page.style.setProperty("--login-agent-draft-opacity", "1");
        page.style.setProperty("--login-agent-draft-y", "0px");
        page.setAttribute("data-agent-draft-visible", "true");
        page.setAttribute("data-agent-draft-ready", "false");
        syncPointerModeAttribute();
      };

      const lockScrollModeInteractions = () => {
        clearIdleTimer();
        clearCloseTimeline();
        syncPointerModeAttribute();
      };

      const resetScrollScene = () => {
        scrollState.progress = 0;
        scrollState.locked = false;
        scrollState.anchorX = getTrackedPointerX();
        scrollState.entryLeft = snapToDevicePixel(scrollState.anchorX - lineWidth / 2);
        scrollState.entryRight = snapToDevicePixel(scrollState.anchorX + lineWidth / 2);
        gsap.set(scrollSceneNodes, { y: 0 });
        gsap.set(scrollHint, { autoAlpha: isScrollReadyRef.current ? 1 : 0, y: 0 });
        updateAgentEntryVisibility(0);
        syncPointerModeAttribute();
      };

      const syncTopEntryState = () => {
        const entryLeft = snapToDevicePixel(scrollState.entryLeft);
        const entryRight = snapToDevicePixel(scrollState.entryRight);
        const entryWidth = Math.max(snapToDevicePixel(entryRight - entryLeft), lineWidth);

        scrollState.anchorX = getTrackedPointerX();
        bandMotion.setImmediate("idle", {
          centerX: snapToDevicePixel(entryLeft + entryWidth / 2),
          width: entryWidth,
        });
      };

      const captureScrollEntryState = () => {
        syncVisualStateFromRenderedBand();

        const renderedX = Number(band.getAttribute("x"));
        const renderedWidth = Number(band.getAttribute("width"));
        const entryLeft = Number.isFinite(renderedX)
          ? renderedX
          : visualState.centerX - visualState.width / 2;
        const entryWidth = Number.isFinite(renderedWidth)
          ? Math.max(renderedWidth, lineWidth)
          : Math.max(visualState.width, lineWidth);

        scrollState.anchorX = getTrackedPointerX();
        scrollState.entryLeft = snapToDevicePixel(entryLeft);
        scrollState.entryRight = snapToDevicePixel(entryLeft + entryWidth);
      };

      const renderScrollProgress = (progress: number) => {
        const nextProgress = clamp(progress, 0, 1);
        const isAtTop = isAtScrollTop(nextProgress);

        if (!isScrollReadyRef.current) {
          return;
        }

        scrollState.progress = nextProgress;

        if (isAtTop) {
          const wasLocked = scrollState.locked;
          scrollState.locked = false;
          syncPointerModeAttribute();

          gsap.set(scrollSceneNodes, {
            y: 0,
          });
          gsap.set(scrollHint, {
            autoAlpha: 1,
            y: 0,
          });
          updateAgentEntryVisibility(0);

          if (wasLocked) {
            clearIdleTimer();
            clearCloseTimeline();
            syncTopEntryState();
          }

          return;
        }

        if (!scrollState.locked) {
          lockScrollModeInteractions();
          captureScrollEntryState();
          scrollState.locked = true;
        }

        const leftEdge = snapToDevicePixel(
          gsap.utils.interpolate(scrollState.entryLeft, 0, nextProgress),
        );
        const rightEdge = snapToDevicePixel(
          gsap.utils.interpolate(scrollState.entryRight, window.innerWidth, nextProgress),
        );
        const width = Math.max(snapToDevicePixel(rightEdge - leftEdge), lineWidth);

        scrollState.progress = nextProgress;
        bandMotion.setImmediate("scroll", {
          centerX: snapToDevicePixel(leftEdge + width / 2),
          width,
        });

        gsap.set(scrollSceneNodes, {
          y: snapToDevicePixel(-window.innerHeight * nextProgress),
        });
        gsap.set(scrollHint, {
          autoAlpha: nextProgress > 0.035 ? 0 : 1,
          y: nextProgress > 0.035 ? 8 : 0,
        });
        updateAgentEntryVisibility(nextProgress);
        syncPointerModeAttribute();
      };

      const destroyScrollTrigger = () => {
        scrollTrigger?.kill();
        scrollTrigger = null;
      };

      const createScrollTrigger = () => {
        destroyScrollTrigger();
        scrollTrigger = ScrollTrigger.create({
          id: "login-auth-scroll-band",
          trigger: page,
          start: "top top",
          end: () => `+=${window.innerHeight}`,
          onUpdate: (self) => renderScrollProgress(self.progress),
          onRefresh: (self) => renderScrollProgress(self.progress),
        });
        ScrollTrigger.refresh();
      };

      const enableAuthenticatedScroll = () => {
        isAuthenticatedRef.current = true;
        isScrollReadyRef.current = true;
        setIsAuthenticated(true);
        setIsScrollReady(true);
        page.setAttribute("data-authenticated", "true");
        page.setAttribute("data-scroll-ready", "true");
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        resetScrollScene();
        renderBand();
        window.requestAnimationFrame(createScrollTrigger);
      };

      const syncVisualStateFromRenderedBand = (
        owner: "idle" | "closing" = "idle",
      ) => {
        const renderedX = Number(band.getAttribute("x"));
        const renderedWidth = Number(band.getAttribute("width"));

        if (!Number.isFinite(renderedX) || !Number.isFinite(renderedWidth)) {
          return;
        }

        bandMotion.setImmediate(owner, {
          centerX: snapToDevicePixel(renderedX + renderedWidth / 2),
          width: snapToDevicePixel(renderedWidth),
        });
      };

      const renderStaticLayout = () => {
        const cm = window.innerWidth / 19;
        const horizontalInset = snapToDevicePixel(cm);
        const titleX = snapToDevicePixel(cm * 1.5);
        const brandX = snapToDevicePixel(titleX - clamp(window.innerWidth * 0.012, 14, 24));
        const ruleY = snapToDevicePixel(cm * 1.5);
        const brandY = snapToDevicePixel(ruleY - clamp(window.innerWidth * 0.022, 24, 42));
        const centerY = snapToDevicePixel(window.innerHeight * 0.5);
        const titleBaselineGap = 136;
        const copyLowerOffset = snapToDevicePixel(cm * 0.5);
        const microLowerOffset = snapToDevicePixel(cm * 0.08);
        const infoStartY = snapToDevicePixel(
          centerY + titleBaselineGap / 2 + clamp(window.innerWidth * 0.07, 96, 138) + copyLowerOffset,
        );
        const infoLineGap = snapToDevicePixel(clamp(window.innerWidth * 0.014, 22, 30));
        const microY = snapToDevicePixel(
          infoStartY + infoLineGap * 2 + clamp(window.innerWidth * 0.03, 36, 56) + microLowerOffset,
        );
        const ctaGap = clamp(window.innerWidth * 0.0085, 8, 14);
        const ctaRightInset = clamp(window.innerWidth * 0.036, 28, 58);
        const ctaBottomInset = clamp(window.innerWidth * 0.032, 24, 54);
        const ctaLineGap = snapToDevicePixel(
          (window.innerWidth <= 720 ? 36 : 46) * 1.18,
        );
        const ctaCenterY = snapToDevicePixel(
          window.innerHeight - ctaBottomInset - ctaLineGap * 0.5,
        );
        const agentPromptX = snapToDevicePixel(window.innerWidth * (3 / 34));
        const agentPromptY = snapToDevicePixel(
          window.innerHeight + window.innerHeight * (3 / 19),
        );

        for (const line of [topRule, topRuleInverted]) {
          line.setAttribute("x1", String(horizontalInset));
          line.setAttribute(
            "x2",
            String(snapToDevicePixel(window.innerWidth - horizontalInset)),
          );
          line.setAttribute("y1", String(ruleY));
          line.setAttribute("y2", String(ruleY));
        }

        for (const brand of brandNodes) {
          if (!brand) {
            continue;
          }

          brand.setAttribute("x", String(brandX));
          brand.setAttribute("y", String(brandY));
        }

        for (const [primary, secondary] of titleNodes) {
          if (!primary || !secondary) {
            continue;
          }

          primary.setAttribute("x", String(titleX));
          primary.setAttribute(
            "y",
            String(snapToDevicePixel(centerY - titleBaselineGap / 2 - 20)),
          );
          secondary.setAttribute("x", String(titleX));
          secondary.setAttribute(
            "y",
            String(snapToDevicePixel(centerY + titleBaselineGap / 2 - 20)),
          );
        }

        for (const lines of infoNodes) {
          const [lineOne, lineTwo, lineThree] = lines;
          if (!lineOne || !lineTwo || !lineThree) {
            continue;
          }

          lineOne.setAttribute("x", String(titleX));
          lineOne.setAttribute("y", String(infoStartY));
          lineTwo.setAttribute("x", String(titleX));
          lineTwo.setAttribute("y", String(snapToDevicePixel(infoStartY + infoLineGap)));
          lineThree.setAttribute("x", String(titleX));
          lineThree.setAttribute(
            "y",
            String(snapToDevicePixel(infoStartY + infoLineGap * 2)),
          );
        }

        for (const micro of microNodes) {
          if (!micro) {
            continue;
          }

          micro.setAttribute("x", String(titleX));
          micro.setAttribute("y", String(microY));
        }

        for (const prompt of agentPromptNodes) {
          if (!prompt) {
            continue;
          }

          prompt.setAttribute("x", String(agentPromptX));
          prompt.setAttribute("y", String(agentPromptY));
        }

        for (const [leftBracket, primary, secondary, rightBracket] of ctaNodes) {
          if (!leftBracket || !primary || !secondary || !rightBracket) {
            continue;
          }

          primary.setAttribute("x", "0");
          const hasSecondaryLine = (secondary.textContent ?? "").trim().length > 0;
          const primaryY = hasSecondaryLine ? ctaCenterY - ctaLineGap / 2 : ctaCenterY;
          const secondaryY = hasSecondaryLine ? ctaCenterY + ctaLineGap / 2 : ctaCenterY;

          primary.setAttribute("y", String(snapToDevicePixel(primaryY)));
          secondary.setAttribute("x", "0");
          secondary.setAttribute("y", String(snapToDevicePixel(secondaryY)));

          const primaryWidth = primary.getComputedTextLength();
          const secondaryWidth = secondary.getComputedTextLength();
          const textBlockWidth = Math.max(primaryWidth, secondaryWidth);

          leftBracket.setAttribute("x", "0");
          rightBracket.setAttribute("x", "0");
          const bracketWidth = Math.max(
            leftBracket.getComputedTextLength(),
            rightBracket.getComputedTextLength(),
          );
          const totalWidth = bracketWidth * 2 + ctaGap * 2 + textBlockWidth;
          const leftEdge = snapToDevicePixel(
            window.innerWidth - ctaRightInset - totalWidth,
          );
          const textCenterX = snapToDevicePixel(
            leftEdge + bracketWidth + ctaGap + textBlockWidth / 2,
          );
          const leftBracketX = snapToDevicePixel(leftEdge + bracketWidth / 2);
          const rightBracketX = snapToDevicePixel(
            window.innerWidth - ctaRightInset - bracketWidth / 2,
          );

          leftBracket.setAttribute("x", String(leftBracketX));
          leftBracket.setAttribute("y", String(ctaCenterY));
          primary.setAttribute("x", String(textCenterX));
          secondary.setAttribute("x", String(textCenterX));
          rightBracket.setAttribute("x", String(rightBracketX));
          rightBracket.setAttribute("y", String(ctaCenterY));
        }

        const ctaBounds = {
          left: Number(ctaLeftBracketRef.current?.getBBox().x ?? 0),
          top: Math.min(
            Number(ctaPrimaryRef.current?.getBBox().y ?? 0),
            Number(ctaLeftBracketRef.current?.getBBox().y ?? 0),
          ),
          right:
            Number(ctaRightBracketRef.current?.getBBox().x ?? 0) +
            Number(ctaRightBracketRef.current?.getBBox().width ?? 0),
          bottom: Math.max(
            Number(ctaSecondaryRef.current?.getBBox().y ?? 0) +
              Number(ctaSecondaryRef.current?.getBBox().height ?? 0),
            Number(ctaLeftBracketRef.current?.getBBox().y ?? 0) +
              Number(ctaLeftBracketRef.current?.getBBox().height ?? 0),
          ),
        };

        cta.style.left = `${snapToDevicePixel(ctaBounds.left - 12)}px`;
        cta.style.top = `${snapToDevicePixel(ctaBounds.top - 10)}px`;
        cta.style.width = `${snapToDevicePixel(ctaBounds.right - ctaBounds.left + 24)}px`;
        cta.style.height = `${snapToDevicePixel(ctaBounds.bottom - ctaBounds.top + 20)}px`;
      };

      const clearCloseTimeline = () => {
        closeTimeline?.kill();
        closeTimeline = null;
      };

      const clearLoadingTimeline = () => {
        loadingTimeline?.kill();
        loadingTimeline = null;
      };

      const clearLoadingTextTimeline = () => {
        loadingTextTimeline?.kill();
        loadingTextTimeline = null;
      };

      const clearLoadingTimer = () => {
        if (loadingTimerRef.current !== null) {
          window.clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
      };

      const clearIdleTimer = () => {
        if (idleTimerRef.current !== null) {
          window.clearTimeout(idleTimerRef.current);
          idleTimerRef.current = null;
        }
      };

      const lockAgentEntryScroll = () => {
        window.scrollTo({ top: window.innerHeight, left: 0, behavior: "auto" });
        document.documentElement.classList.add("login-agent-entry-lock");
      };

      const unlockAgentEntryScroll = () => {
        document.documentElement.classList.remove("login-agent-entry-lock");
      };

      const isScrollKey = (key: string) =>
        [
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "End",
          "Home",
          "PageDown",
          "PageUp",
          " ",
        ].includes(key);

      const preventLockedScroll = (event: Event) => {
        if (agentEntryStageRef.current === "idle") {
          return;
        }

        if (event.cancelable) {
          event.preventDefault();
        }
      };

      const preventLockedScrollKey = (event: KeyboardEvent) => {
        if (agentEntryStageRef.current === "idle" || !isScrollKey(event.key)) {
          return;
        }

        event.preventDefault();
      };

      const collapseAtCurrentX = () => {
        if (!isTopPointerMode()) {
          clearIdleTimer();
          return;
        }

        bandMotion.collapseToLine({
          centerX: visualState.centerX,
          width: lineWidth,
          duration: prefersReducedMotion ? 0 : 0.32,
          ease: "power3.out",
        });
      };

      const armIdleCollapse = () => {
        clearIdleTimer();
        idleTimerRef.current = window.setTimeout(collapseAtCurrentX, 1000);
      };

      const rememberPointerX = (value: number) => {
        const nextX = snapToDevicePixel(clampX(value));
        pointerInsideRef.current = true;
        pointerXRef.current = nextX;
        return nextX;
      };

      const getTrackedPointerX = () =>
        snapToDevicePixel(
          clampX(pointerInsideRef.current ? (pointerXRef.current ?? visualState.centerX) : visualState.centerX),
        );

      const focusLoginInput = () => {
        window.requestAnimationFrame(() => {
          const input = document.getElementById("sv-account") as HTMLInputElement | null;
          input?.focus();
        });
      };

      const clearOpeningFallback = () => {
        if (openingFallbackTimer !== null) {
          window.clearTimeout(openingFallbackTimer);
          openingFallbackTimer = null;
        }
      };

      gsap.set(panelDim, { autoAlpha: 0 });
      gsap.set(panelShell, { autoAlpha: 0 });
      gsap.set(panelClose, { autoAlpha: 0, y: -6 });
      gsap.set(panelFormWrap, { autoAlpha: 0, y: 18 });
      gsap.set(loadingOverlay, { autoAlpha: 0, y: 12, scale: 0.98 });
      gsap.set(loadingChars, { y: 0 });

      const openTimeline = gsap.timeline({
        paused: true,
        onStart: () => {
          clearIdleTimer();
          setStage("opening");
        },
        onComplete: () => {
          clearOpeningFallback();
          setStage("open");
          focusLoginInput();
        },
      });

      openTimeline
        .to(
          panelDim,
          {
            autoAlpha: 1,
            duration: prefersReducedMotion ? 0 : 0.18,
            ease: "power1.out",
          },
          prefersReducedMotion ? 0 : 0.04,
        )
        .to(
          panelShell,
          {
            autoAlpha: 1,
            duration: prefersReducedMotion ? 0 : 0.01,
          },
          prefersReducedMotion ? 0 : 0.1,
        )
        .to(
          panelClose,
          {
            autoAlpha: 1,
            y: 0,
            duration: prefersReducedMotion ? 0 : 0.22,
            ease: "power2.out",
          },
          prefersReducedMotion ? 0 : 0.2,
        )
        .to(
          panelFormWrap,
          {
            autoAlpha: 1,
            y: 0,
            duration: prefersReducedMotion ? 0 : 0.28,
            ease: "power2.out",
          },
          prefersReducedMotion ? 0 : 0.2,
        );

      const settleOpeningAtPanel = () => {
        if (panelStageRef.current !== "opening") {
          return;
        }

        clearOpeningFallback();
        bandMotion.setImmediate("open", {
          centerX: getPanelCenterX(),
          width: getPanelWidth(),
        });
        openTimeline.progress(1);
      };

      const resetClosedPanelVisuals = () => {
        clearOpeningFallback();
        openTimeline.pause(0);
        gsap.set(panelDim, { autoAlpha: 0 });
        gsap.set(panelShell, { autoAlpha: 0 });
        gsap.set(panelClose, { autoAlpha: 0, y: -6 });
        gsap.set(panelFormWrap, { autoAlpha: 0, y: 18 });
      };

      const ctaLeftBrackets = [
        ctaLeftBracketRef.current,
        invertedCtaLeftBracketRef.current,
      ].filter(Boolean) as SVGTextElement[];
      const ctaRightBrackets = [
        ctaRightBracketRef.current,
        invertedCtaRightBracketRef.current,
      ].filter(Boolean) as SVGTextElement[];

      const hoverCtaIn = withContextSafe(() => {
        if (panelStageRef.current !== "idle") {
          return;
        }

        gsap.to(ctaLeftBrackets, {
          x: -5,
          duration: 0.18,
          ease: "power2.out",
          overwrite: true,
        });
        gsap.to(ctaRightBrackets, {
          x: 5,
          duration: 0.18,
          ease: "power2.out",
          overwrite: true,
        });
      });

      const hoverCtaOut = withContextSafe(() => {
        gsap.to([...ctaLeftBrackets, ...ctaRightBrackets], {
          x: 0,
          duration: 0.16,
          ease: "power2.out",
          overwrite: true,
        });
      });

      const openPanel = withContextSafe(() => {
        if (panelStageRef.current !== "idle" || isAuthenticatedRef.current) {
          return;
        }

        hoverCtaOut();
        clearIdleTimer();
        clearOpeningFallback();
        clearCloseTimeline();
        setStage("opening");
        openTimeline.invalidate().play(0);
        bandMotion.openToPanel({
          centerX: getPanelCenterX(),
          width: getPanelWidth(),
          duration: prefersReducedMotion ? 0 : 0.48,
          ease: LINE_DRAW_EASE,
        });

        if (!prefersReducedMotion) {
          openingFallbackTimer = window.setTimeout(settleOpeningAtPanel, 800);
        }
      });

      const closePanel = withContextSafe(() => {
        if (panelStageRef.current === "idle" || panelStageRef.current === "closing") {
          return;
        }

        clearIdleTimer();
        clearOpeningFallback();
        clearCloseTimeline();
        setStage("closing");
        syncVisualStateFromRenderedBand("closing");

        closeTimeline = gsap.timeline({
          onComplete: () => {
            const restingX = getTrackedPointerX();
            lastXRef.current = restingX;
            bandMotion.setImmediate("idle", {
              centerX: restingX,
              width: lineWidth,
            });
            resetClosedPanelVisuals();
            closeTimeline = null;
            if (pendingAuthenticatedCloseRef.current) {
              pendingAuthenticatedCloseRef.current = false;
              enableAuthenticatedScroll();
            }
            setStage("idle");
          },
        });

        closeTimeline
          .to(
            panelClose,
            {
              autoAlpha: 0,
              y: -6,
              duration: prefersReducedMotion ? 0 : 0.14,
              ease: "power2.in",
            },
            0,
          )
          .to(
            panelFormWrap,
            {
              autoAlpha: 0,
              y: 18,
              duration: prefersReducedMotion ? 0 : 0.16,
              ease: "power2.in",
            },
            0,
          )
          .to(
            panelDim,
            {
              autoAlpha: 0,
              duration: prefersReducedMotion ? 0 : 0.16,
              ease: "power1.in",
            },
            0.04,
          )
          .to(
            panelShell,
            {
              autoAlpha: 0,
              duration: prefersReducedMotion ? 0 : 0.01,
            },
            prefersReducedMotion ? 0 : 0.14,
          )
          .to(
            {},
            {
              duration: prefersReducedMotion ? 0 : 0.34,
              onStart: () => {
                bandMotion.closeToLine({
                  centerX: getTrackedPointerX(),
                  width: lineWidth,
                  duration: prefersReducedMotion ? 0 : 0.34,
                  ease: LINE_DRAW_EASE,
                });
              },
            },
            prefersReducedMotion ? 0 : 0.12,
          );
      });

      const followPointer = (event: PointerEvent) => {
        const nextX = rememberPointerX(event.clientX);

        if (!isTopPointerMode()) {
          clearIdleTimer();
          return;
        }

        clearCloseTimeline();
        lastXRef.current = nextX;
        bandMotion.followPointer({
          centerX: nextX,
          width: getExpandedWidth(),
          duration: prefersReducedMotion ? 0 : 0.42,
          ease: "power3.out",
        });
        armIdleCollapse();
      };

      const leavePage = () => {
        pointerInsideRef.current = false;

        if (!isTopPointerMode()) {
          clearIdleTimer();
          return;
        }

        clearIdleTimer();
        collapseAtCurrentX();
      };

      const syncOnResize = () => {
        renderStaticLayout();

        if (agentEntryStageRef.current !== "idle") {
          renderLockedAgentEntryPage();
          return;
        }

        if (isScrollReadyRef.current) {
          scrollState.anchorX = snapToDevicePixel(clampX(scrollState.anchorX));
          renderScrollProgress(scrollState.progress);
          ScrollTrigger.refresh();
          return;
        }

        if (panelStageRef.current === "idle") {
          if (lastXRef.current !== null) {
            const nextX = snapToDevicePixel(clampX(lastXRef.current));
            lastXRef.current = nextX;
            bandMotion.setImmediate("idle", {
              centerX: nextX,
              width: visualState.width,
            });
          } else {
            bandMotion.setImmediate("idle", visualState);
          }

          return;
        }

        if (panelStageRef.current === "opening") {
          settleOpeningAtPanel();
          return;
        }

        if (panelStageRef.current === "open") {
          bandMotion.setImmediate("open", {
            centerX: getPanelCenterX(),
            width: getPanelWidth(),
          });
          return;
        }

        bandMotion.closeToLine({
          centerX: getTrackedPointerX(),
          width: lineWidth,
          duration: prefersReducedMotion ? 0 : 0.18,
          ease: LINE_DRAW_EASE,
        });
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key !== "Escape") {
          return;
        }

        if (panelStageRef.current === "idle") {
          return;
        }

        event.preventDefault();
        closePanel();
      };

      const startLoadingTextWave = () => {
        clearLoadingTextTimeline();

        if (prefersReducedMotion) {
          gsap.set(loadingChars, { y: 0 });
          return;
        }

        loadingTextTimeline = gsap.timeline({ repeat: -1, repeatDelay: 0.26 });
        loadingTextTimeline
          .to(loadingChars, {
            y: -9,
            duration: 0.28,
            ease: "sine.out",
            stagger: 0.055,
          })
          .to(
            loadingChars,
            {
              y: 0,
              duration: 0.34,
              ease: "sine.inOut",
              stagger: 0.055,
            },
            "<0.16",
          );
      };

      const finishAgentLoading = () => {
        if (agentEntryStageRef.current !== "loading") {
          return;
        }

        clearLoadingTimer();
        clearLoadingTimeline();
        renderLockedAgentEntryPage();
        loadingTimeline = gsap.timeline({
          onComplete: () => {
            clearLoadingTextTimeline();
            setAgentEntryStageValue("done");
            renderLockedAgentEntryPage();
            loadingTimeline = null;
            onAgentEntryComplete?.(completedAgentIdRef.current);
          },
        });

        loadingTimeline.to(loadingOverlay, {
          autoAlpha: 0,
          y: -12,
          duration: prefersReducedMotion ? 0 : 0.42,
          ease: "power2.inOut",
        });
      };

      const beginAgentLoading = withContextSafe((agentId = DEFAULT_AGENT_ID) => {
        if (agentEntryStageRef.current !== "idle") {
          return;
        }

        completedAgentIdRef.current = agentId;
        clearIdleTimer();
        clearOpeningFallback();
        clearCloseTimeline();
        clearLoadingTimer();
        clearLoadingTimeline();
        clearLoadingTextTimeline();
        renderScrollProgress(1);
        destroyScrollTrigger();
        lockAgentEntryScroll();
        setAgentEntryStageValue("loading");
        renderLockedAgentEntryPage();
        startLoadingTextWave();

        loadingTimerRef.current = window.setTimeout(finishAgentLoading, 5000);

        loadingTimeline = gsap.timeline();
        loadingTimeline
          .to(
            [agentDraftLayer, ...agentPromptLayers],
            {
              autoAlpha: 0,
              y: -14,
              duration: prefersReducedMotion ? 0 : 0.45,
              ease: "power2.inOut",
              stagger: prefersReducedMotion ? 0 : 0.025,
            },
            0,
          )
          .to(
            loadingOverlay,
            {
              autoAlpha: 1,
              y: 0,
              scale: 1,
              duration: prefersReducedMotion ? 0 : 0.35,
              ease: "power2.out",
            },
            prefersReducedMotion ? 0 : 0.22,
          );
      });

      requestAuthenticatedCloseRef.current = withContextSafe(() => {
        if (isAuthenticatedRef.current && isScrollReadyRef.current) {
          return;
        }

        isAuthenticatedRef.current = true;
        pendingAuthenticatedCloseRef.current = true;
        setIsAuthenticated(true);
        page.setAttribute("data-authenticated", "true");

        if (panelStageRef.current === "idle") {
          pendingAuthenticatedCloseRef.current = false;
          enableAuthenticatedScroll();
          return;
        }

        closePanel();
      });
      beginAgentLoadingRef.current = beginAgentLoading;

      page.addEventListener("pointerenter", followPointer);
      page.addEventListener("pointerleave", leavePage);
      page.addEventListener("pointercancel", leavePage);
      window.addEventListener("blur", leavePage);
      window.addEventListener("pointermove", followPointer);
      window.addEventListener("resize", syncOnResize);
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keydown", preventLockedScrollKey);
      window.addEventListener("wheel", preventLockedScroll, { passive: false });
      window.addEventListener("touchmove", preventLockedScroll, { passive: false });
      cta.addEventListener("pointerenter", hoverCtaIn);
      cta.addEventListener("pointerleave", hoverCtaOut);
      cta.addEventListener("focus", hoverCtaIn);
      cta.addEventListener("blur", hoverCtaOut);
      cta.addEventListener("click", openPanel);
      panelClose.addEventListener("click", closePanel);

      syncCtaLayoutRef.current = () => {
        renderStaticLayout();
        renderBand();
      };

      lastXRef.current = initialX;
      pointerXRef.current = initialX;
      setStage("idle");
      setAgentEntryStageValue("idle");
      setIsAuthenticated(false);
      setIsScrollReady(false);
      resetScrollScene();
      syncPointerModeAttribute();
      renderStaticLayout();
      renderBand();

      return () => {
        requestAuthenticatedCloseRef.current = () => undefined;
        beginAgentLoadingRef.current = () => undefined;
        syncCtaLayoutRef.current = () => undefined;
        clearIdleTimer();
        clearOpeningFallback();
        clearLoadingTimer();
        page.removeEventListener("pointerenter", followPointer);
        page.removeEventListener("pointerleave", leavePage);
        page.removeEventListener("pointercancel", leavePage);
        window.removeEventListener("blur", leavePage);
        window.removeEventListener("pointermove", followPointer);
        window.removeEventListener("resize", syncOnResize);
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keydown", preventLockedScrollKey);
        window.removeEventListener("wheel", preventLockedScroll);
        window.removeEventListener("touchmove", preventLockedScroll);
        cta.removeEventListener("pointerenter", hoverCtaIn);
        cta.removeEventListener("pointerleave", hoverCtaOut);
        cta.removeEventListener("focus", hoverCtaIn);
        cta.removeEventListener("blur", hoverCtaOut);
        cta.removeEventListener("click", openPanel);
        panelClose.removeEventListener("click", closePanel);
        clearCloseTimeline();
        clearLoadingTimeline();
        clearLoadingTextTimeline();
        destroyScrollTrigger();
        unlockAgentEntryScroll();
        openTimeline.kill();
        bandMotion.destroy();
        gsap.killTweensOf(scrollSceneNodes);
        gsap.killTweensOf(scrollHint);
        gsap.killTweensOf([...ctaLeftBrackets, ...ctaRightBrackets]);
        gsap.killTweensOf([agentDraftLayer, ...agentPromptLayers, loadingOverlay, ...loadingChars]);
      };
    },
    { scope: pageRef },
  );

  return (
    <main
      ref={pageRef}
      className="login-placeholder-page"
      data-panel-stage={panelStage}
      data-authenticated={isAuthenticated ? "true" : "false"}
      data-scroll-ready={isScrollReady ? "true" : "false"}
      data-agent-entry-stage={agentEntryStage}
    >
      <svg className="login-hover-band-svg" aria-hidden="true">
        <defs>
          <clipPath id="login-band-text-clip" clipPathUnits="userSpaceOnUse">
            <rect
              ref={bandClipRef}
              x={0}
              y={0}
              width={1}
              height="100%"
              shapeRendering="crispEdges"
            />
          </clipPath>
        </defs>

        <g ref={baseSceneRef} className="login-scroll-scene">
          <line
            ref={topRuleRef}
            className="login-placeholder-top-rule"
            x1={0}
            x2={0}
            y1={0}
            y2={0}
          />

          <g className="login-brand-mark">
            <text ref={brandRef} className="login-brand-mark-word">
              {BRAND_WORD}
            </text>
          </g>

          <g className="login-system-title">
            <text ref={titlePrimaryRef} className="login-system-title-line">
              {SYSTEM_TITLE_PRIMARY}
            </text>
            <text ref={titleSecondaryRef} className="login-system-title-line">
              {SYSTEM_TITLE_SECONDARY}
            </text>
          </g>

          <g className="login-support-copy">
            <text ref={infoLineOneRef} className="login-support-copy-line">
              {INFO_COPY_LINES[0]}
            </text>
            <text ref={infoLineTwoRef} className="login-support-copy-line">
              {INFO_COPY_LINES[1]}
            </text>
            <text ref={infoLineThreeRef} className="login-support-copy-line">
              {INFO_COPY_LINES[2]}
            </text>
          </g>

          <g className="login-micro-copy">
            <text ref={microCopyRef} className="login-micro-copy-line">
              {MICRO_COPY}
            </text>
          </g>

          <g className="login-cta-title">
            <text ref={ctaLeftBracketRef} className="login-cta-bracket">
              [
            </text>
            <text ref={ctaPrimaryRef} className="login-cta-line">
              {ctaPrimaryLabel}
            </text>
            <text ref={ctaSecondaryRef} className="login-cta-line">
              {ctaSecondaryLabel}
            </text>
            <text ref={ctaRightBracketRef} className="login-cta-bracket">
              ]
            </text>
          </g>

          <g className="login-agent-prompt-layer">
            <text ref={agentPromptRef} className="login-agent-entry-prompt">
              {AGENT_ENTRY_PROMPT}
            </text>
          </g>

        </g>

        <rect
          ref={bandRef}
          className="login-hover-band"
          x={0}
          y={0}
          width={1}
          height="100%"
          shapeRendering="crispEdges"
        />

        <g ref={invertedSceneRef} className="login-scroll-scene">
          <line
            ref={topRuleInvertedRef}
            className="login-placeholder-top-rule is-inverted"
            clipPath="url(#login-band-text-clip)"
            x1={0}
            x2={0}
            y1={0}
            y2={0}
          />

          <g className="login-brand-mark is-inverted" clipPath="url(#login-band-text-clip)">
            <text ref={invertedBrandRef} className="login-brand-mark-word">
              {BRAND_WORD}
            </text>
          </g>

          <g className="login-system-title is-inverted" clipPath="url(#login-band-text-clip)">
            <text ref={invertedTitlePrimaryRef} className="login-system-title-line">
              {SYSTEM_TITLE_PRIMARY}
            </text>
            <text ref={invertedTitleSecondaryRef} className="login-system-title-line">
              {SYSTEM_TITLE_SECONDARY}
            </text>
          </g>

          <g className="login-support-copy is-inverted" clipPath="url(#login-band-text-clip)">
            <text ref={invertedInfoLineOneRef} className="login-support-copy-line">
              {INFO_COPY_LINES[0]}
            </text>
            <text ref={invertedInfoLineTwoRef} className="login-support-copy-line">
              {INFO_COPY_LINES[1]}
            </text>
            <text ref={invertedInfoLineThreeRef} className="login-support-copy-line">
              {INFO_COPY_LINES[2]}
            </text>
          </g>

          <g className="login-micro-copy is-inverted" clipPath="url(#login-band-text-clip)">
            <text ref={invertedMicroCopyRef} className="login-micro-copy-line">
              {MICRO_COPY}
            </text>
          </g>

          <g className="login-cta-title is-inverted" clipPath="url(#login-band-text-clip)">
            <text ref={invertedCtaLeftBracketRef} className="login-cta-bracket">
              [
            </text>
            <text ref={invertedCtaPrimaryRef} className="login-cta-line">
              {ctaPrimaryLabel}
            </text>
            <text ref={invertedCtaSecondaryRef} className="login-cta-line">
              {ctaSecondaryLabel}
            </text>
            <text ref={invertedCtaRightBracketRef} className="login-cta-bracket">
              ]
            </text>
          </g>

          <g className="login-agent-prompt-layer is-inverted" clipPath="url(#login-band-text-clip)">
            <text ref={invertedAgentPromptRef} className="login-agent-entry-prompt">
              {AGENT_ENTRY_PROMPT}
            </text>
          </g>
        </g>
      </svg>

      <div ref={agentDraftLayerRef} className="login-agent-draft-layer">
        <div className="login-agent-action-strip" aria-label="Agent 接入操作">
          <button
            type="button"
            className="login-agent-bracket-button"
            disabled={agentEntryStage !== "idle" || isAgentSaving}
            onClick={() => void saveAgentManifest()}
          >
            <span className="login-agent-bracket" aria-hidden="true">
              [
            </span>
            <span>确认接入</span>
            <span className="login-agent-bracket" aria-hidden="true">
              ]
            </span>
          </button>
          <button
            type="button"
            className="login-agent-bracket-button is-secondary"
            disabled={agentEntryStage !== "idle" || isAgentSaving}
            onClick={() => beginAgentLoadingRef.current(DEFAULT_AGENT_ID)}
          >
            <span className="login-agent-bracket" aria-hidden="true">
              [
            </span>
            <span>稍后再说</span>
            <span className="login-agent-bracket" aria-hidden="true">
              ]
            </span>
          </button>
        </div>
        <AgentConnectDraft
          draft={agentDraft}
          footer={
            agentSaveError ? (
              <p className="login-agent-field-error" role="alert">
                {agentSaveError}
              </p>
            ) : null
          }
          onDraftChange={setAgentDraft}
        />
      </div>

      <div
        ref={loadingOverlayRef}
        className="login-agent-loading-overlay"
        role="status"
        aria-live="polite"
        aria-label="正在接入 Agent"
        aria-hidden={agentEntryStage === "idle" || agentEntryStage === "done"}
      >
        <div className="login-agent-loading-stack">
          <div className="login-agent-loader-figure" aria-hidden="true">
            <div className="login-agent-tower-loader">
              {LOADING_BOXES.map((box) => (
                <div
                  key={box}
                  className={`login-agent-loader-box login-agent-loader-box-${box}`}
                >
                  <div className="login-agent-loader-side-left" />
                  <div className="login-agent-loader-side-right" />
                  <div className="login-agent-loader-side-top" />
                </div>
              ))}
            </div>
          </div>
          <div ref={loadingTextRef} className="login-agent-loading-text" aria-hidden="true">
            {LOADING_LABEL.split("").map((char, index) => (
              <span
                key={`${char}-${index}`}
                className={`login-agent-loading-char${char === "." ? " is-dot" : ""}`}
              >
                {char}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div ref={panelDimRef} className="login-panel-dim" aria-hidden="true" />

      <div ref={panelShellRef} className="login-panel-shell" aria-hidden={panelStage === "idle"}>
        <button ref={panelCloseRef} type="button" className="login-panel-close">
          <span>关闭</span>
          <X aria-hidden="true" strokeWidth={1.9} />
        </button>
        <div className="svg-text-content login-panel-text">
          <div ref={panelFormWrapRef} className="login-panel-form-wrap">
            <LoginForm onSignIn={handleMockSignIn} />
          </div>
        </div>
      </div>

      <button
        ref={ctaRef}
        type="button"
        className="login-placeholder-hitarea"
        aria-label={isAuthenticated ? "已登录" : "账号登录"}
      />

      <div ref={scrollHintRef} className="login-scroll-hint" aria-hidden="true">
        <Mouse className="login-scroll-hint-icon" strokeWidth={1.45} />
      </div>
    </main>
  );
}
