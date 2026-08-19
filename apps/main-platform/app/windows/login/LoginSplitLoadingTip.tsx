"use client";

import { useRef } from "react";
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
  onExitCompleteRef.current = onExitComplete;

  useGSAP(
    (_, contextSafe) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      gsap.set(root, { autoAlpha: 1 });

      if (!active || !text) {
        return;
      }

      const notifyExitComplete = contextSafe
        ? contextSafe(() => onExitCompleteRef.current?.())
        : () => onExitCompleteRef.current?.();

      if (phase === "exit") {
        const fadeTween = gsap.to(root, {
          autoAlpha: 0,
          duration: prefersReducedMotion() ? 0 : 0.18,
          ease: "power1.out",
          overwrite: true,
          onComplete: notifyExitComplete,
        });

        return () => fadeTween.kill();
      }

      if (phase === "hold" || prefersReducedMotion()) {
        return;
      }

      const split = SplitText.create(root, {
        aria: "auto",
        charsClass: "login-agent-loading-char",
        reduceWhiteSpace: false,
        smartWrap: true,
        tag: "span",
        type: "chars",
      });

      const timeline = gsap.timeline();
      timeline.fromTo(
        split.chars,
        { autoAlpha: 0, y: 18 },
        {
          autoAlpha: 1,
          duration: 0.28,
          ease: "power3.out",
          force3D: true,
          stagger: 0.02,
          y: 0,
        },
      );

      return () => {
        timeline.kill();
        split.revert();
      };
    },
    { dependencies: [active, phase, text], revertOnUpdate: true, scope: rootRef },
  );

  return (
    <div
      ref={rootRef}
      className={["login-agent-loading-text", className].filter(Boolean).join(" ")}
    >
      {text}
    </div>
  );
}
