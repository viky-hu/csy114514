import assert from "node:assert/strict";
import test from "node:test";

import { createLoginBandMotionController } from "./login-band-motion-controller.ts";

class FakeTween {
  killed = false;

  constructor(target, vars) {
    this.target = target;
    this.vars = vars;
  }

  kill() {
    this.killed = true;
  }

  completeEvenIfKilled() {
    if (typeof this.vars.centerX === "number") {
      this.target.centerX = this.vars.centerX;
    }

    if (typeof this.vars.width === "number") {
      this.target.width = this.vars.width;
    }

    this.vars.onUpdate?.();
    this.vars.onComplete?.();
  }
}

test("opening invalidates a stale pointer completion and locks later pointer motion", () => {
  const visualState = { centerX: 480, width: 1 };
  const renders = [];
  const tweens = [];
  const controller = createLoginBandMotionController({
    visualState,
    render: () => renders.push({ ...visualState }),
    createTween: (target, vars) => {
      const tween = new FakeTween(target, vars);
      tweens.push(tween);
      return tween;
    },
  });

  controller.followPointer({
    centerX: 320,
    width: 96,
    duration: 0.42,
    ease: "power3.out",
  });
  controller.openToPanel({
    centerX: 1240,
    width: 416,
    duration: 0.48,
    ease: "power3.inOut",
  });

  assert.equal(tweens[0].killed, true);
  assert.equal(controller.owner, "opening");
  assert.equal(
    controller.followPointer({
      centerX: 220,
      width: 72,
      duration: 0.42,
      ease: "power3.out",
    }),
    false,
  );

  tweens[0].completeEvenIfKilled();
  assert.equal(controller.owner, "opening");

  tweens[1].completeEvenIfKilled();

  assert.equal(controller.owner, "open");
  assert.deepEqual(visualState, { centerX: 1240, width: 416 });
  assert.deepEqual(renders.at(-1), { centerX: 1240, width: 416 });
});

test("a newer transition cannot be cleared by an earlier tween completion", () => {
  const visualState = { centerX: 500, width: 1 };
  const tweens = [];
  const controller = createLoginBandMotionController({
    visualState,
    render: () => undefined,
    createTween: (target, vars) => {
      const tween = new FakeTween(target, vars);
      tweens.push(tween);
      return tween;
    },
  });

  controller.followPointer({
    centerX: 420,
    width: 104,
    duration: 0.42,
    ease: "power3.out",
  });
  controller.collapseToLine({
    centerX: 420,
    width: 1,
    duration: 0.32,
    ease: "power3.out",
  });

  tweens[0].completeEvenIfKilled();

  assert.equal(tweens[1].killed, false);
  assert.equal(controller.owner, "pointer");

  tweens[1].completeEvenIfKilled();
  assert.deepEqual(visualState, { centerX: 420, width: 1 });
});

test("immediate scroll state takes ownership from panel motion", () => {
  const visualState = { centerX: 500, width: 1 };
  const tweens = [];
  const controller = createLoginBandMotionController({
    visualState,
    render: () => undefined,
    createTween: (target, vars) => {
      const tween = new FakeTween(target, vars);
      tweens.push(tween);
      return tween;
    },
  });

  controller.openToPanel({
    centerX: 1240,
    width: 416,
    duration: 0.48,
    ease: "power3.inOut",
  });
  controller.setImmediate("scroll", { centerX: 720, width: 1440 });

  tweens[0].completeEvenIfKilled();

  assert.equal(tweens[0].killed, true);
  assert.equal(controller.owner, "scroll");
  assert.deepEqual(visualState, { centerX: 720, width: 1440 });
});
