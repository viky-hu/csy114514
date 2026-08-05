export const R4_GRAPH_VIEWBOX = {
  height: 440,
  width: 1000,
} as const;

export const R4_GRAPH_BOUNDARY = {
  height: 388,
  width: 936,
  x: 32,
  y: 26,
} as const;

export const R4_LAYER_BAND_X = 42;
export const R4_LAYER_BAND_WIDTH = 916;
export const R4_LAYER_INFO_TEXT_X = 58;
export const R4_LAYER_INFO_BOUNDARY_X = 160;
export const R4_LAYER_INFO_TEXT_MAX_WIDTH = 92;
export const R4_ATTACK_CHAIN_START_X = 170;

export const R4_LAYER_BANDS = [
  {
    id: "source",
    layerLabel: "第一层",
    subtitle: "不可信网页",
    title: "网页输入层",
    y: 34,
  },
  {
    id: "agent",
    layerLabel: "第二层",
    subtitle: "解析 / 唤起",
    title: "Agent执行层",
    y: 160,
  },
  {
    id: "memory-tool",
    layerLabel: "第三层",
    subtitle: "持久记忆 / 外发工具",
    title: "记忆与工具层",
    y: 286,
  },
] as const;

export const R4_LAYER_BAND_HEIGHT = 108;

export type R4StepLayout = {
  caption: string;
  height: number;
  icon: "agent" | "email" | "memory" | "web";
  id: "agent-parse" | "agent-recall" | "email" | "memory" | "source";
  width: number;
  x: number;
  y: number;
};

export const R4_STEP_LAYOUTS: R4StepLayout[] = [
  {
    caption: "外部输入",
    height: 84,
    icon: "web",
    id: "source",
    width: 132,
    x: 236,
    y: 88,
  },
  {
    caption: "初次解析",
    height: 84,
    icon: "agent",
    id: "agent-parse",
    width: 138,
    x: 388,
    y: 214,
  },
  {
    caption: "持久污染点",
    height: 84,
    icon: "memory",
    id: "memory",
    width: 142,
    x: 540,
    y: 340,
  },
  {
    caption: "二次唤起",
    height: 84,
    icon: "agent",
    id: "agent-recall",
    width: 138,
    x: 692,
    y: 214,
  },
  {
    caption: "外发动作",
    height: 84,
    icon: "email",
    id: "email",
    width: 132,
    x: 844,
    y: 340,
  },
];

export const R4_ROUTE_PAIRS = [
  { direction: "down", from: 0, id: "source-to-agent", to: 1 },
  { direction: "down", from: 1, id: "agent-to-memory", to: 2 },
  { direction: "up", from: 2, id: "memory-to-agent", to: 3 },
  { direction: "down", from: 3, id: "agent-to-email", to: 4 },
] as const;

export function getNodeBounds(layout: R4StepLayout) {
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
  layout: R4StepLayout,
  radius = 10,
) {
  const { bottom, left, right, top } = getNodeBounds(layout);
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

export function buildOrthogonalRouteSegments() {
  return R4_ROUTE_PAIRS.map((route) => {
    const source = R4_STEP_LAYOUTS[route.from];
    const target = R4_STEP_LAYOUTS[route.to];
    const sourceBounds = getNodeBounds(source);
    const targetBounds = getNodeBounds(target);
    const sourceCenterX = (sourceBounds.left + sourceBounds.right) / 2;
    const targetCenterY = (targetBounds.top + targetBounds.bottom) / 2;
    const sourceBoundaryY =
      route.direction === "down" ? sourceBounds.bottom : sourceBounds.top;

    return {
      d: `M ${sourceCenterX} ${sourceBoundaryY} V ${targetCenterY} H ${targetBounds.left}`,
      id: route.id,
      sourceStep: route.from,
      targetStep: route.to,
    };
  });
}

export const hoverBands = R4_STEP_LAYOUTS.map((layout, index) => {
  const currentBounds = getNodeBounds(layout);

  return {
    id: layout.id,
    stepIndex: index,
    xStart: currentBounds.left,
    xEnd: currentBounds.right,
  };
});

export function findHoverStepIndex(viewBoxX: number) {
  const band = hoverBands.find(
    (item) => viewBoxX >= item.xStart && viewBoxX < item.xEnd,
  );

  if (band) {
    return band.stepIndex;
  }

  return null;
}
