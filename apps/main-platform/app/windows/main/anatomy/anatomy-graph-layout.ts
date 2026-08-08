import {
  createClockwiseRoundedRectPath,
  getCenteredRectBounds,
} from "../shared/graph-svg-primitives.ts";

export { createClockwiseRoundedRectPath };

export const DEFAULT_ANATOMY_GRAPH_STATE = {
  selectedPathId: "R4",
} as const;

export const ANATOMY_GRAPH_VIEWBOX = {
  height: 520,
  width: 1000,
} as const;

export const ANATOMY_LAYOUT_OFFSET_X = 48;
export const ANATOMY_LAYOUT_OFFSET_Y = 28;
export const ANATOMY_PHASE_LABEL_Y = 390 + ANATOMY_LAYOUT_OFFSET_Y;
export const ANATOMY_PHASE_RAIL_PATH = `M ${56 + ANATOMY_LAYOUT_OFFSET_X} ${
  456 + ANATOMY_LAYOUT_OFFSET_Y
} H ${838 + ANATOMY_LAYOUT_OFFSET_X}`;
export const ANATOMY_ACTIVE_NODE_DURATION = 0.26;
export const ANATOMY_ACTIVE_NODE_Y = -5;
export const ANATOMY_NODE_WIDTH = 150;
export const ANATOMY_NODE_HEIGHT = 88;

function offsetX(x: number) {
  return x + ANATOMY_LAYOUT_OFFSET_X;
}

function offsetY(y: number) {
  return y + ANATOMY_LAYOUT_OFFSET_Y;
}

function offsetPoint(x: number, y: number) {
  return { x: offsetX(x), y: offsetY(y) };
}

export type AnatomyPhaseId =
  | "first_pass"
  | "ingress"
  | "persistence"
  | "recall"
  | "sink";

export const ANATOMY_PHASES = [
  {
    id: "ingress",
    label: "01",
    title: "入口",
    subtitle: "不可信内容进入",
    x: offsetX(112),
  },
  {
    id: "first_pass",
    label: "02",
    title: "初次解析",
    subtitle: "Agent 读取网页",
    x: offsetX(286),
  },
  {
    id: "persistence",
    label: "03",
    title: "持久化",
    subtitle: "写入长期记忆",
    x: offsetX(456),
  },
  {
    id: "recall",
    label: "04",
    title: "二次唤起",
    subtitle: "后续任务读记忆",
    x: offsetX(626),
  },
  {
    id: "sink",
    label: "05",
    title: "外发动作",
    subtitle: "触发危险工具",
    x: offsetX(784),
  },
] as const;

export type AnatomyGraphNodeLayout = {
  height: number;
  id: string;
  phaseId: AnatomyPhaseId | "sidecar";
  role: "agent" | "data" | "memory" | "source" | "tool";
  width: number;
  x: number;
  y: number;
};

export const ANATOMY_NODE_LAYOUTS = {
  agentFirstPass: {
    height: ANATOMY_NODE_HEIGHT,
    id: "agent-first-pass",
    phaseId: "first_pass",
    role: "agent",
    width: ANATOMY_NODE_WIDTH,
    x: offsetX(286),
    y: offsetY(166),
  },
  agentRecall: {
    height: ANATOMY_NODE_HEIGHT,
    id: "agent-recall",
    phaseId: "recall",
    role: "agent",
    width: ANATOMY_NODE_WIDTH,
    x: offsetX(626),
    y: offsetY(166),
  },
  dataEmail: {
    height: ANATOMY_NODE_HEIGHT,
    id: "data-email",
    phaseId: "sidecar",
    role: "data",
    width: ANATOMY_NODE_WIDTH,
    x: offsetX(112),
    y: offsetY(286),
  },
  memoryPersistent: {
    height: ANATOMY_NODE_HEIGHT,
    id: "memory-persistent",
    phaseId: "persistence",
    role: "memory",
    width: ANATOMY_NODE_WIDTH,
    x: offsetX(456),
    y: offsetY(262),
  },
  sourceBrowser: {
    height: ANATOMY_NODE_HEIGHT,
    id: "source-browser",
    phaseId: "ingress",
    role: "source",
    width: ANATOMY_NODE_WIDTH,
    x: offsetX(112),
    y: offsetY(60),
  },
  toolEmailRead: {
    height: ANATOMY_NODE_HEIGHT,
    id: "tool-email-read",
    phaseId: "sidecar",
    role: "tool",
    width: ANATOMY_NODE_WIDTH,
    x: offsetX(784),
    y: offsetY(60),
  },
  toolEmailSend: {
    height: ANATOMY_NODE_HEIGHT,
    id: "tool-email-send",
    phaseId: "sink",
    role: "tool",
    width: ANATOMY_NODE_WIDTH,
    x: offsetX(784),
    y: offsetY(262),
  },
} as const satisfies Record<string, AnatomyGraphNodeLayout>;

export const ANATOMY_LAYOUT_BY_NODE_ID = Object.fromEntries(
  Object.values(ANATOMY_NODE_LAYOUTS).map((layout) => [layout.id, layout]),
) as Record<string, AnatomyGraphNodeLayout>;

export type AnatomyNodeAnchor = "bottom" | "left" | "right" | "top";

type AnatomyRouteDefinition = {
  id: string;
  pathIds: string[];
  sourceAnchor: AnatomyNodeAnchor;
  sourceNodeId: string;
  targetAnchor: AnatomyNodeAnchor;
  targetNodeId: string;
};

export type AnatomyRouteSegment = AnatomyRouteDefinition & {
  d: string;
};

export function getAnatomyNodeBounds(layout: AnatomyGraphNodeLayout) {
  return getCenteredRectBounds(layout);
}

export function getAnatomyNodeAnchor(
  layout: AnatomyGraphNodeLayout,
  anchor: AnatomyNodeAnchor,
) {
  const bounds = getAnatomyNodeBounds(layout);
  const centerX = (bounds.left + bounds.right) / 2;
  const centerY = (bounds.top + bounds.bottom) / 2;

  if (anchor === "left") {
    return { x: bounds.left, y: centerY };
  }

  if (anchor === "right") {
    return { x: bounds.right, y: centerY };
  }

  if (anchor === "top") {
    return { x: centerX, y: bounds.top };
  }

  return { x: centerX, y: bounds.bottom };
}

const ROUTE_DEFINITIONS: AnatomyRouteDefinition[] = [
  {
    id: "source-browser-to-agent-first-pass",
    pathIds: ["R1", "R2", "R4"],
    sourceAnchor: "bottom",
    sourceNodeId: "source-browser",
    targetAnchor: "left",
    targetNodeId: "agent-first-pass",
  },
  {
    id: "agent-first-pass-to-memory",
    pathIds: ["R2", "R4"],
    sourceAnchor: "right",
    sourceNodeId: "agent-first-pass",
    targetAnchor: "left",
    targetNodeId: "memory-persistent",
  },
  {
    id: "memory-to-agent-recall",
    pathIds: ["R4"],
    sourceAnchor: "right",
    sourceNodeId: "memory-persistent",
    targetAnchor: "bottom",
    targetNodeId: "agent-recall",
  },
  {
    id: "agent-recall-to-email-send",
    pathIds: ["R4"],
    sourceAnchor: "right",
    sourceNodeId: "agent-recall",
    targetAnchor: "top",
    targetNodeId: "tool-email-send",
  },
  {
    id: "agent-first-pass-to-email-send",
    pathIds: ["R1", "R3"],
    sourceAnchor: "right",
    sourceNodeId: "agent-first-pass",
    targetAnchor: "left",
    targetNodeId: "tool-email-send",
  },
  {
    id: "data-email-to-email-read",
    pathIds: ["R3"],
    sourceAnchor: "right",
    sourceNodeId: "data-email",
    targetAnchor: "left",
    targetNodeId: "tool-email-read",
  },
  {
    id: "email-read-to-agent-first-pass",
    pathIds: ["R3"],
    sourceAnchor: "left",
    sourceNodeId: "tool-email-read",
    targetAnchor: "top",
    targetNodeId: "agent-first-pass",
  },
];

function getCurveControls(
  route: AnatomyRouteDefinition,
  source: { x: number; y: number },
  target: { x: number; y: number },
) {
  const controls: Record<
    string,
    { controlOne: { x: number; y: number }; controlTwo: { x: number; y: number } }
  > = {
    "agent-first-pass-to-email-send": {
      controlOne: offsetPoint(438, 156),
      controlTwo: offsetPoint(584, 280),
    },
    "agent-first-pass-to-memory": {
      controlOne: offsetPoint(368, 190),
      controlTwo: offsetPoint(374, 262),
    },
    "agent-recall-to-email-send": {
      controlOne: offsetPoint(704, 166),
      controlTwo: offsetPoint(744, 200),
    },
    "data-email-to-email-read": {
      controlOne: offsetPoint(304, 320),
      controlTwo: offsetPoint(560, 68),
    },
    "email-read-to-agent-first-pass": {
      controlOne: offsetPoint(620, 44),
      controlTwo: offsetPoint(366, 56),
    },
    "memory-to-agent-recall": {
      controlOne: offsetPoint(530, 290),
      controlTwo: offsetPoint(590, 248),
    },
    "source-browser-to-agent-first-pass": {
      controlOne: offsetPoint(132, 122),
      controlTwo: offsetPoint(190, 166),
    },
  };

  return (
    controls[route.id] ?? {
      controlOne: {
        x: Math.round(source.x + (target.x - source.x) * 0.38),
        y: source.y,
      },
      controlTwo: {
        x: Math.round(source.x + (target.x - source.x) * 0.62),
        y: target.y,
      },
    }
  );
}

function buildCurvePath(route: AnatomyRouteDefinition) {
  const sourceLayout = ANATOMY_LAYOUT_BY_NODE_ID[route.sourceNodeId];
  const targetLayout = ANATOMY_LAYOUT_BY_NODE_ID[route.targetNodeId];
  const source = getAnatomyNodeAnchor(sourceLayout, route.sourceAnchor);
  const target = getAnatomyNodeAnchor(targetLayout, route.targetAnchor);
  const { controlOne, controlTwo } = getCurveControls(route, source, target);

  return [
    `M ${source.x} ${source.y}`,
    `C ${controlOne.x} ${controlOne.y}`,
    `${controlTwo.x} ${controlTwo.y}`,
    `${target.x} ${target.y}`,
  ].join(" ");
}

export function buildAnatomyRouteSegments(): AnatomyRouteSegment[] {
  return ROUTE_DEFINITIONS.map((route) => ({
    ...route,
    d: buildCurvePath(route),
  }));
}

export function getActiveAnatomyRouteNodeIds(pathId: string) {
  return new Set(
    buildAnatomyRouteSegments()
      .filter((segment) => segment.pathIds.includes(pathId))
      .flatMap((segment) => [segment.sourceNodeId, segment.targetNodeId]),
  );
}
