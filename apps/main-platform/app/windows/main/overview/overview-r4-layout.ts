export const R4_GRAPH_VIEWBOX = {
  height: 340,
  width: 880,
} as const;

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
    y: 128,
  },
  {
    id: "memory-tool",
    layerLabel: "第三层",
    subtitle: "持久记忆 / 外发工具",
    title: "记忆与工具层",
    y: 222,
  },
] as const;

export const R4_LAYER_BAND_HEIGHT = 84;

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
    height: 66,
    icon: "web",
    id: "source",
    width: 132,
    x: 118,
    y: 76,
  },
  {
    caption: "初次解析",
    height: 66,
    icon: "agent",
    id: "agent-parse",
    width: 138,
    x: 286,
    y: 172,
  },
  {
    caption: "持久污染点",
    height: 68,
    icon: "memory",
    id: "memory",
    width: 142,
    x: 444,
    y: 268,
  },
  {
    caption: "二次唤起",
    height: 66,
    icon: "agent",
    id: "agent-recall",
    width: 138,
    x: 612,
    y: 172,
  },
  {
    caption: "外发动作",
    height: 68,
    icon: "email",
    id: "email",
    width: 132,
    x: 770,
    y: 268,
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
    const startY =
      route.direction === "down" ? sourceBounds.bottom : sourceBounds.top;

    return {
      d: `M ${source.x} ${startY} V ${target.y} H ${targetBounds.left}`,
      id: route.id,
      sourceStep: route.from,
      targetStep: route.to,
    };
  });
}

const HOVER_BOUNDS = [48, 202, 365, 528, 691, 832] as const;

export const hoverBands = R4_STEP_LAYOUTS.map((layout, index) => ({
  id: layout.id,
  stepIndex: index,
  xEnd: HOVER_BOUNDS[index + 1],
  xStart: HOVER_BOUNDS[index],
}));

export function findHoverStepIndex(viewBoxX: number) {
  const band = hoverBands.find(
    (item) => viewBoxX >= item.xStart && viewBoxX < item.xEnd,
  );

  if (band) {
    return band.stepIndex;
  }

  return viewBoxX < hoverBands[0].xStart
    ? hoverBands[0].stepIndex
    : hoverBands[hoverBands.length - 1].stepIndex;
}
