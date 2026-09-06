"use client";

import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";

gsap.registerPlugin(useGSAP);

type D1FilterTransferArrowProps = {
  isVisible: boolean;
};

const D1_FILTER_ARROW_PATH =
  "M18 24C10 24 6 29 6 36C6 43 10 48 18 48H108V58C108 62 112 64 115 62L171 40C175 38 175 34 171 32L115 10C112 8 108 10 108 14V24H18Z";

export function D1FilterTransferArrow({
  isVisible,
}: D1FilterTransferArrowProps) {
  const arrowRef = useRef<SVGSVGElement>(null);

  useGSAP(
    () => {
      const arrow = arrowRef.current;
      if (!arrow) return;

      const media = gsap.matchMedia();
      media.add(
        { reduceMotion: "(prefers-reduced-motion: reduce)" },
        (context) => {
          const reduceMotion = Boolean(context.conditions?.reduceMotion);
          gsap.set(arrow, {
            force3D: true,
            transformOrigin: "50% 55%",
            transformPerspective: 720,
          });

          if (!isVisible) {
            gsap.set(arrow, {
              autoAlpha: 0,
              rotationX: 12,
              rotationY: -4,
              rotationZ: -2,
              scale: 0.86,
              y: 10,
            });
            return;
          }

          if (reduceMotion) {
            gsap.set(arrow, {
              autoAlpha: 1,
              rotationX: -2,
              rotationY: 0,
              rotationZ: 0,
              scale: 1,
              y: -4,
            });
            return;
          }

          const timeline = gsap.timeline({
            defaults: { overwrite: "auto" },
          });

          timeline
            .set(arrow, {
              autoAlpha: 0,
              rotationX: 14,
              rotationY: -5,
              rotationZ: -2,
              scale: 0.84,
              y: 12,
            })
            .to(arrow, {
              autoAlpha: 1,
              duration: 0.58,
              ease: "back.out(1.45)",
              rotationX: -4,
              rotationY: 1.25,
              rotationZ: 0,
              scale: 1,
              y: -4,
            })
            .to(arrow, {
              autoAlpha: 0.96,
              duration: 2.4,
              ease: "sine.inOut",
              repeat: -1,
              rotationX: -1.5,
              rotationY: -1.25,
              y: -7,
              yoyo: true,
            });

          return () => timeline.kill();
        },
      );

      return () => media.revert();
    },
    {
      dependencies: [isVisible],
      revertOnUpdate: true,
      scope: arrowRef,
    },
  );

  return (
    <svg
      ref={arrowRef}
      className="d1-filter-arrow"
      viewBox="0 0 180 72"
      aria-hidden="true"
      focusable="false"
      role="presentation"
    >
      <defs>
        <linearGradient
          id="d1-filter-arrow-liquid"
          x1="90"
          y1="0"
          x2="90"
          y2="72"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#f5f8ff" />
          <stop offset="0.22" stopColor="#c8d5ff" />
          <stop offset="0.5" stopColor="#8fa4ff" />
          <stop offset="0.78" stopColor="#5d78ff" />
          <stop offset="1" stopColor="#3152f4" />
        </linearGradient>
        <filter
          id="d1-filter-arrow-shadow"
          x="-18"
          y="-16"
          width="216"
          height="112"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="4.5"
            floodColor="#3152f4"
            floodOpacity="0.18"
          />
          <feDropShadow
            dx="0"
            dy="2"
            stdDeviation="1.2"
            floodColor="#ffffff"
            floodOpacity="0.48"
          />
        </filter>
      </defs>
      <path
        className="d1-filter-arrow-body"
        data-d1-filter-arrow-body
        d={D1_FILTER_ARROW_PATH}
        fill="url(#d1-filter-arrow-liquid)"
        stroke="#4b69dd"
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#d1-filter-arrow-shadow)"
      />
    </svg>
  );
}
