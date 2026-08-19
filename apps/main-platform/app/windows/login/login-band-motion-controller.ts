export type LoginBandMotionOwner =
  | "idle"
  | "pointer"
  | "opening"
  | "open"
  | "closing"
  | "scroll";

export type LoginBandVisualState = {
  centerX: number;
  width: number;
};

export type LoginBandTweenVars = {
  centerX?: number;
  width?: number;
  duration: number;
  ease: unknown;
  overwrite?: true;
  onUpdate?: () => void;
  onComplete?: () => void;
};

type LoginBandTween = {
  kill: () => void;
};

type LoginBandMotionControllerOptions = {
  visualState: LoginBandVisualState;
  render: () => void;
  createTween: (
    target: LoginBandVisualState,
    vars: LoginBandTweenVars,
  ) => LoginBandTween;
};

type LoginBandMotionTarget = LoginBandVisualState & {
  duration: number;
  ease: unknown;
};

export class LoginBandMotionController {
  public owner: LoginBandMotionOwner = "idle";

  private activeTween: LoginBandTween | null = null;
  private revision = 0;
  private readonly options: LoginBandMotionControllerOptions;

  public constructor(options: LoginBandMotionControllerOptions) {
    this.options = options;
  }

  public followPointer(target: LoginBandMotionTarget) {
    if (this.owner !== "idle" && this.owner !== "pointer") {
      return false;
    }

    this.animate("pointer", target, "pointer");
    return true;
  }

  public collapseToLine(target: LoginBandMotionTarget) {
    if (this.owner !== "idle" && this.owner !== "pointer") {
      return false;
    }

    this.animate("pointer", target, "pointer");
    return true;
  }

  public openToPanel(target: LoginBandMotionTarget) {
    if (this.owner === "opening" || this.owner === "open") {
      return false;
    }

    this.animate("opening", target, "open");
    return true;
  }

  public closeToLine(target: LoginBandMotionTarget) {
    this.animate("closing", target, "idle");
  }

  public setImmediate(owner: LoginBandMotionOwner, target: LoginBandVisualState) {
    this.claim(owner);
    this.apply(target);
  }

  public destroy() {
    this.claim("idle");
  }

  private animate(
    owner: LoginBandMotionOwner,
    target: LoginBandMotionTarget,
    completedOwner: LoginBandMotionOwner,
  ) {
    const revision = this.claim(owner);

    if (target.duration === 0) {
      this.apply(target);
      this.owner = completedOwner;
      return;
    }

    const tweenState = { ...this.options.visualState };
    this.activeTween = this.options.createTween(tweenState, {
      centerX: target.centerX,
      width: target.width,
      duration: target.duration,
      ease: target.ease,
      overwrite: true,
      onUpdate: () => {
        if (!this.isCurrent(revision, owner)) {
          return;
        }

        this.apply(tweenState);
      },
      onComplete: () => {
        if (!this.isCurrent(revision, owner)) {
          return;
        }

        this.apply(target);
        this.activeTween = null;
        this.owner = completedOwner;
      },
    });
  }

  private claim(owner: LoginBandMotionOwner) {
    this.revision += 1;
    this.activeTween?.kill();
    this.activeTween = null;
    this.owner = owner;
    return this.revision;
  }

  private isCurrent(revision: number, owner: LoginBandMotionOwner) {
    return this.revision === revision && this.owner === owner;
  }

  private apply(target: LoginBandVisualState) {
    this.options.visualState.centerX = target.centerX;
    this.options.visualState.width = target.width;
    this.options.render();
  }
}

export function createLoginBandMotionController(
  options: LoginBandMotionControllerOptions,
) {
  return new LoginBandMotionController(options);
}
