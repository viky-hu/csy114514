"use client";

import { useLayoutEffect, useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";

gsap.registerPlugin(useGSAP, SplitText);

export type LoginSplitLoadingTipPhase = "enter" | "hold" | "exit";

type LoginSplitLoadingTipProps = {
  active: boolean;
  className?: string;
  onExitComplete?: () => void;
  phase: LoginSplitLoadingTipPhase;
  text: string;
};

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function LoginSplitLoadingTip({
  active,
  className = "",
  onExitComplete,
  phase,
  text,
}: LoginSplitLoadingTipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const onExitCompleteRef = useRef(onExitComplete);
  const exitCompletionRef = useRef(false);
  const preparedTextRef = useRef<string | null>(null);
  const splitRef = useRef<ReturnType<typeof SplitText.create> | null>(null);
  const motionRef = useRef<gsap.core.Animation | null>(null);
  onExitCompleteRef.current = onExitComplete;
  const { contextSafe } = useGSAP({ scope: rootRef });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const clearMotion = () => {
      motionRef.current?.kill();
      motionRef.current = null;
    };

    const clearSplit = () => {
      splitRef.current?.revert();
      splitRef.current = null;
      preparedTextRef.current = null;
    };

    const prepareSplit = () => {
      if (preparedTextRef.current === text && splitRef.current) {
        return splitRef.current;
      }

      clearMotion();
      clearSplit();
      root.textContent = text;
      gsap.set(root, { autoAlpha: 0, y: 0 });

      if (!text || prefersReducedMotion()) {
        preparedTextRef.current = text;
        return null;
      }

      const split = SplitText.create(root, {
        aria: "auto",
        charsClass: "login-agent-loading-char",
        reduceWhiteSpace: false,
        smartWrap: true,
        tag: "span",
        type: "chars",
      });
      splitRef.current = split;
      preparedTextRef.current = text;
      gsap.set(split.chars, { autoAlpha: 0, y: 18 });

      return split;
    };

    if (!active || !text) {
      clearMotion();
      clearSplit();
      root.textContent = text;
      gsap.set(root, { autoAlpha: 0, y: 0 });
      exitCompletionRef.current = false;
      return;
    }

    if (phase === "hold") {
      prepareSplit();
      gsap.set(root, { autoAlpha: 0, y: 0 });
      exitCompletionRef.current = false;
      return;
    }

    if (phase === "enter") {
      const split = prepareSplit();
      clearMotion();
      exitCompletionRef.current = false;

      if (!split || prefersReducedMotion()) {
        gsap.set(root, { autoAlpha: 1, y: 0 });
        return;
      }

      const entranceStagger = Math.min(
        0.02,
        0.37 / Math.max(split.chars.length - 1, 1),
      );
      const timeline = gsap.timeline();
      motionRef.current = timeline;
      timeline
        .set(root, { autoAlpha: 1, y: 0 })
        .fromTo(
          split.chars,
          { autoAlpha: 0, y: 18 },
          {
            autoAlpha: 1,
            duration: 0.28,
            ease: "power3.out",
            force3D: false,
            stagger: entranceStagger,
            y: 0,
          },
          0,
        );
      return;
    }

    const split = prepareSplit();
    clearMotion();
    exitCompletionRef.current = false;
    let disposed = false;
    const notifyExitComplete = contextSafe(() => {
      if (disposed || exitCompletionRef.current) {
        return;
      }

      exitCompletionRef.current = true;
      onExitCompleteRef.current?.();
    });

    if (split) {
      gsap.set(split.chars, { autoAlpha: 1, y: 0 });
    }

    const fadeTween = gsap.to(root, {
      autoAlpha: 0,
      duration: prefersReducedMotion() ? 0 : 0.18,
      ease: "power1.out",
      overwrite: true,
      onComplete: notifyExitComplete,
      y: 0,
    });
    motionRef.current = fadeTween;

    return () => {
      disposed = true;
      fadeTween.kill();
    };
  }, [active, contextSafe, phase, text]);

  useLayoutEffect(() => {
    return () => {
      motionRef.current?.kill();
      splitRef.current?.revert();
    };
  }, []);

  return (
    <div
      aria-label={text}
      ref={rootRef}
      className={["login-agent-loading-text", className].filter(Boolean).join(" ")}
    />
  );
}
