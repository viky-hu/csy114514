"use client";

import { useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import {
  DEFAULT_DEFENSE_LAYER_INDEX,
  DEFENSE_LAYERS,
  DEFENSE_WHEEL_LAYERS,
  getDefenseCanonicalIndexFromWheelIndex,
  getDefenseLayer,
  getDefenseWheelIndex,
} from "./defense-visualization-data";
import { DefenseFlow } from "./DefenseFlow";
import { DefenseOptionWheel } from "./DefenseOptionWheel";

type DefenseVisualizationStageProps = {
  isVisible: boolean;
  onReturn: () => void;
};

export function DefenseVisualizationStage({
  isVisible,
  onReturn,
}: DefenseVisualizationStageProps) {
  const stageRef = useRef<HTMLElement>(null);
  const placeholderRef = useRef<HTMLDivElement>(null);
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
      const placeholders = gsap.utils.toArray<HTMLElement>(
        ".security-defense-placeholder",
        placeholderRoot,
      );

      gsap.killTweensOf(placeholders);
      gsap.set(placeholders, { autoAlpha: 0, y: 10 });
      const activePlaceholder = placeholders[selectedIndex];
      if (!activePlaceholder) {
        return;
      }

      if (reducedMotion || !isVisible) {
        gsap.set(activePlaceholder, { autoAlpha: isVisible ? 1 : 0, y: 0 });
        return;
      }

      gsap.to(activePlaceholder, {
        autoAlpha: 1,
        duration: 0.48,
        ease: "power2.out",
        y: 0,
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
  const selectedWheelIndex = getDefenseWheelIndex(selectedIndex);

  return (
    <section
      ref={stageRef}
      className={`security-defense-screen${isVisible ? " is-revealed" : ""}`}
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
        <DefenseFlow selectedIndex={selectedIndex} isVisible={isVisible} />
        <div className="security-defense-workspace">
          <aside className="security-defense-wheel-column" aria-label="防御层菜单">
            <DefenseOptionWheel
              blur={1.35}
              curve={1}
              fade={0.22}
              fontSize={1.98}
              inset={8}
              items={DEFENSE_WHEEL_LAYERS}
              defaultSelected={getDefenseWheelIndex(DEFAULT_DEFENSE_LAYER_INDEX)}
              minOpacity={0.06}
              selectedIndex={selectedWheelIndex}
              reducedMotion={false}
              spacing={2.2}
              loop
              onChange={(wheelIndex) =>
                setSelectedIndex(
                  getDefenseCanonicalIndexFromWheelIndex(wheelIndex),
                )
              }
            />
          </aside>
          <section
            ref={placeholderRef}
            className="security-defense-content"
            aria-label={`${activeLayer.id} ${activeLayer.label}占位内容`}
          >
            {DEFENSE_LAYERS.map((layer, index) => (
              <div
                key={layer.id}
                className="security-defense-placeholder"
                data-defense-layer={layer.id}
                aria-hidden={selectedIndex !== index}
              >
                <span className="security-defense-placeholder-code">
                  {layer.id}
                </span>
                <strong>{layer.label}</strong>
                <span className="security-defense-placeholder-note">
                  防御层详情占位
                </span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </section>
  );
}
