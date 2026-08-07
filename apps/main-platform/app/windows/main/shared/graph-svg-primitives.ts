export type CenteredRectLayout = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export function getCenteredRectBounds(layout: CenteredRectLayout) {
  const left = layout.x - layout.width / 2;
  const right = layout.x + layout.width / 2;
  const top = layout.y - layout.height / 2;
  const bottom = layout.y + layout.height / 2;

  return {
    bottom,
    left,
    right,
    top,
  };
}

export function createClockwiseRoundedRectPath(
  layout: CenteredRectLayout,
  radius = 10,
) {
  const { bottom, left, right, top } = getCenteredRectBounds(layout);
  const cornerRadius = Math.min(radius, layout.width / 2, layout.height / 2);

  return [
    `M ${left + cornerRadius} ${top}`,
    `H ${right - cornerRadius}`,
    `Q ${right} ${top} ${right} ${top + cornerRadius}`,
    `V ${bottom - cornerRadius}`,
    `Q ${right} ${bottom} ${right - cornerRadius} ${bottom}`,
    `H ${left + cornerRadius}`,
    `Q ${left} ${bottom} ${left} ${bottom - cornerRadius}`,
    `V ${top + cornerRadius}`,
    `Q ${left} ${top} ${left + cornerRadius} ${top}`,
    "Z",
  ].join(" ");
}
