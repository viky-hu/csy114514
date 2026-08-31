export type DefenseWheelSide = "left" | "right";

export type DefenseWheelItemFrameInput = {
  curve: number;
  fade: number;
  index: number;
  minOpacity: number;
  distance?: number;
  position: number;
  rowHeight: number;
  side: DefenseWheelSide;
  tilt: number;
};

export type DefenseWheelItemFrame = {
  blur: number;
  opacity: number;
  rotation: number;
  x: number;
  y: number;
};

export function resolveDefenseWheelTarget(value: number, itemCount: number) {
  return Math.min(Math.max(value, 0), Math.max(itemCount - 1, 0));
}

export function resolveDefenseWheelSelection(value: number, itemCount: number) {
  return resolveDefenseWheelTarget(Math.round(value), itemCount);
}

export function resolveDefenseWheelLoopTarget(
  currentPosition: number,
  nextIndex: number,
  itemCount: number,
) {
  if (itemCount === 0) {
    return 0;
  }

  const normalizedCurrent =
    ((currentPosition % itemCount) + itemCount) % itemCount;
  let delta = nextIndex - normalizedCurrent;
  if (itemCount > 1) {
    if (delta > itemCount / 2) {
      delta -= itemCount;
    } else if (delta < -itemCount / 2) {
      delta += itemCount;
    }
  }

  return currentPosition + delta;
}

export function getDefenseWheelItemFrame({
  curve,
  distance: providedDistance,
  fade,
  index,
  minOpacity,
  position,
  rowHeight,
  side,
  tilt,
}: DefenseWheelItemFrameInput): DefenseWheelItemFrame {
  const distance = providedDistance ?? index - position;
  const absoluteDistance = Math.abs(distance);
  const mirror = side === "right" ? -1 : 1;
  const tiltRadians = (tilt * Math.PI) / 180;
  const radius = tiltRadians > 0.0005 ? rowHeight / tiltRadians : 0;

  if (radius === 0) {
    return {
      blur: absoluteDistance,
      opacity: Math.max(minOpacity, 1 - absoluteDistance * fade),
      rotation: 0,
      x: 0,
      y: distance * rowHeight,
    };
  }

  const angle = Math.max(
    -Math.PI / 2,
    Math.min(Math.PI / 2, distance * tiltRadians),
  );

  const x = -mirror * radius * (1 - Math.cos(angle)) * curve;

  return {
    blur: absoluteDistance,
    opacity: Math.max(minOpacity, 1 - absoluteDistance * fade),
    rotation: (mirror * angle * 180) / Math.PI,
    x: Math.abs(x) < Number.EPSILON ? 0 : x,
    y: radius * Math.sin(angle),
  };
}
