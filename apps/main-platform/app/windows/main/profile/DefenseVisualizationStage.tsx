"use client";

import { useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  DEFAULT_DEFENSE_LAYER_INDEX,
  DEFENSE_DISPLAY_LAYERS,
  getDefenseCanonicalIndexFromDisplayIndex,
  getDefenseDisplayIndexFromCanonicalIndex,
  getDefenseLayer,
} from "./defense-visualization-data";
import { DefenseFlow } from "./DefenseFlow";
import { D1InputFilterPanel } from "./D1InputFilterPanel";

type DefenseVisualizationStageProps = {
  isVisible: boolean;
  onReturn: () => void;
};

export function DefenseVisualizationStage({
  isVisible,
  onReturn,
}: DefenseVisualizationStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const placeholderRef = useRef<HTMLElement>(null);
  const navigationDirectionRef = useRef<1 | -1>(1);
  const [selectedIndex, setSelectedIndex] = useState(
    DEFAULT_DEFENSE_LAYER_INDEX,
  );

  useGSAP(
    () => {
      const placeholderRoot = placeholderRef.current;
      if (!placeholderRoot) {
        return;
      }

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const activePlaceholder = placeholderRoot.querySelector<HTMLElement>(
        ".security-defense-placeholder",
      );
      if (!activePlaceholder) return;

      gsap.killTweensOf(activePlaceholder);
      gsap.set(activePlaceholder, {
        autoAlpha: 0,
        x: navigationDirectionRef.current * 16,
      });

      if (reducedMotion || !isVisible) {
        gsap.set(activePlaceholder, { autoAlpha: isVisible ? 1 : 0, x: 0 });
        return;
      }

      gsap.to(activePlaceholder, {
        autoAlpha: 1,
        duration: 0.22,
        ease: "power2.out",
        x: 0,
        overwrite: "auto",
      });
    },
    {
      dependencies: [isVisible, selectedIndex],
      scope: stageRef,
      revertOnUpdate: false,
    },
  );

  const activeLayer = getDefenseLayer(selectedIndex);
  const selectedDisplayIndex =
    getDefenseDisplayIndexFromCanonicalIndex(selectedIndex);
  const selectedDisplayLayer = DEFENSE_DISPLAY_LAYERS[selectedDisplayIndex]!;
  const canGoPrevious = selectedDisplayIndex > 0;
  const canGoNext = selectedDisplayIndex < DEFENSE_DISPLAY_LAYERS.length - 1;
  const moveToDisplayIndex = (displayIndex: number) => {
    const boundedIndex = Math.min(
      Math.max(displayIndex, 0),
      DEFENSE_DISPLAY_LAYERS.length - 1,
    );
    if (boundedIndex === selectedDisplayIndex) return;
    navigationDirectionRef.current =
      boundedIndex > selectedDisplayIndex ? 1 : -1;
    setSelectedIndex(getDefenseCanonicalIndexFromDisplayIndex(boundedIndex));
  };

  return (
    <section
      ref={stageRef}
      className={`security-profile-defense-screen security-defense-screen${
        isVisible ? " is-revealed" : ""
      }`}
      aria-label="防御机制可视化"
      aria-hidden={!isVisible}
    >
      <div className="security-defense-region">
        <button
          className="security-defense-return"
          type="button"
          aria-label="返回安全画像"
          title="返回安全画像"
          onClick={onReturn}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <DefenseFlow
          selectedDisplayIndex={selectedDisplayIndex}
          isVisible={isVisible}
        />
        <div className="security-defense-workspace">
          <button
            className="security-defense-step-button security-defense-step-button-previous"
            type="button"
            aria-label={`上一层：${
              selectedDisplayIndex > 0
                ? `${DEFENSE_DISPLAY_LAYERS[selectedDisplayIndex - 1]!.displayId} ${DEFENSE_DISPLAY_LAYERS[selectedDisplayIndex - 1]!.label}`
                : "无"
            }`}
            disabled={!canGoPrevious}
            onClick={() => moveToDisplayIndex(selectedDisplayIndex - 1)}
          >
            <ChevronLeft size={30} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <section
            ref={placeholderRef}
            className="security-defense-content"
            tabIndex={0}
            aria-label={`${selectedDisplayLayer.displayId} ${selectedDisplayLayer.label}详情`}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === "ArrowLeft" && canGoPrevious) {
                event.preventDefault();
                moveToDisplayIndex(selectedDisplayIndex - 1);
              }
              if (event.key === "ArrowRight" && canGoNext) {
                event.preventDefault();
                moveToDisplayIndex(selectedDisplayIndex + 1);
              }
            }}
          >
            <div
              key={activeLayer.id}
              className={`security-defense-placeholder${activeLayer.id === "D1" ? " is-d1" : ""}`}
              data-defense-layer={activeLayer.id}
            >
              {activeLayer.id === "D1" ? (
                <D1InputFilterPanel
                  isVisible={isVisible && activeLayer.id === "D1"}
                />
              ) : (
                <>
                  <span className="security-defense-placeholder-code">
                    {selectedDisplayLayer.displayId}
                  </span>
                  <strong>{selectedDisplayLayer.label}</strong>
                  <span className="security-defense-placeholder-note">防御层详情占位</span>
                </>
              )}
            </div>
          </section>
          <button
            className="security-defense-step-button security-defense-step-button-next"
            type="button"
            aria-label={`下一层：${
              selectedDisplayIndex < DEFENSE_DISPLAY_LAYERS.length - 1
                ? `${DEFENSE_DISPLAY_LAYERS[selectedDisplayIndex + 1]!.displayId} ${DEFENSE_DISPLAY_LAYERS[selectedDisplayIndex + 1]!.label}`
                : "无"
            }`}
            disabled={!canGoNext}
            onClick={() => moveToDisplayIndex(selectedDisplayIndex + 1)}
          >
            <ChevronRight size={30} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
