import type { SecurityProfileColumnId } from "./security-profile-data";
import { getCenteredRectBounds } from "../shared/graph-svg-primitives.ts";

export const PROFILE_GRAPH_VIEWBOX = {
  height: 500,
  width: 1000,
} as const;

export const PROFILE_GRAPH_BOUNDARY = {
  height: 448,
  rx: 8,
  width: 944,
  x: 28,
  y: 26,
} as const;

export const PROFILE_COLUMN_INFO_Y = 76;

export type ProfileGraphLayout = {
  columnId: SecurityProfileColumnId;
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
};

export type ProfileColumnLayout = {
  id: SecurityProfileColumnId;
  infoLines: {
    label: string;
    summary: string;
    title: string;
  };
  labelX: number;
  subtitle: string;
  title: string;
};

export const PROFILE_COLUMNS: ProfileColumnLayout[] = [
  {
    id: "input-data",
    infoLines: {
      label: "第一列",
      summary: "UNTRUSTED + SENSITIVE",
      title: "输入与数据入口",
    },
    labelX: 166,
    subtitle: "不可信输入 / 敏感数据",
    title: "输入/数据边界",
  },
  {
    id: "agent-core",
    infoLines: {
      label: "第二列",
      summary: "TRUSTED AGENT",
      title: "Agent执行核心",
    },
    labelX: 397,
    subtitle: "单一画像主体",
    title: "Agent执行核心",
  },
  {
    id: "persistent-memory",
    infoLines: {
      label: "第三列",
      summary: "PERSISTENT ASSET",
      title: "持久状态",
    },
    labelX: 632,
    subtitle: "可读写的持久资产",
    title: "持久记忆资产",
  },
  {
    id: "tool-sink",
    infoLines: {
      label: "第四列",
      summary: "ALLOW + CONFIRM",
      title: "工具与外发",
    },
    labelX: 862,
    subtitle: "只读工具 / 外发动作",
    title: "工具/外发边界",
  },
] as const;

export const PROFILE_NODE_LAYOUTS = {
  topologyAgent: {
    columnId: "agent-core",
    height: 92,
    id: "agent",
    width: 164,
    x: 397,
    y: 326,
  },
  agent: {
    columnId: "agent-core",
    height: 104,
    id: "agent-corpmate",
    width: 174,
    x: 397,
    y: 256,
  },
  executor: {
    columnId: "agent-core",
    height: 92,
    id: "executor",
    width: 164,
    x: 397,
    y: 326,
  },
  knowledgeBase: {
    columnId: "input-data",
    height: 84,
    id: "knowledge-base",
    width: 164,
    x: 166,
    y: 184,
  },
  knowledgeBaseSnakeCase: {
    columnId: "input-data",
    height: 84,
    id: "knowledge_base",
    width: 164,
    x: 166,
    y: 184,
  },
  planner: {
    columnId: "agent-core",
    height: 92,
    id: "planner",
    width: 164,
    x: 397,
    y: 184,
  },
  retriever: {
    columnId: "agent-core",
    height: 92,
    id: "retriever",
    width: 164,
    x: 397,
    y: 184,
  },
  dataEmail: {
    columnId: "input-data",
    height: 78,
    id: "data-email",
    width: 152,
    x: 166,
    y: 326,
  },
  memoryPersistent: {
    columnId: "persistent-memory",
    height: 84,
    id: "memory-persistent",
    width: 160,
    x: 632,
    y: 384,
  },
  sourceBrowser: {
    columnId: "input-data",
    height: 78,
    id: "source-browser",
    width: 152,
    x: 166,
    y: 184,
  },
  toolEmailRead: {
    columnId: "tool-sink",
    height: 78,
    id: "tool-email-read",
    width: 164,
    x: 862,
    y: 184,
  },
  toolEmailSend: {
    columnId: "tool-sink",
    height: 78,
    id: "tool-email-send",
    width: 164,
    x: 862,
    y: 326,
  },
} as const satisfies Record<string, ProfileGraphLayout>;

export const PROFILE_LAYOUT_BY_NODE_ID = Object.fromEntries(
  Object.values(PROFILE_NODE_LAYOUTS).map((layout) => [layout.id, layout]),
) as Record<string, ProfileGraphLayout>;

const PROFILE_BASE_LAYOUT_IDS = new Set([
  "agent-corpmate",
  "data-email",
  "memory-persistent",
  "source-browser",
  "tool-email-read",
  "tool-email-send",
]);

export type ProfileNodeAnchor = "bottom" | "left" | "right" | "top";

export type ProfileRouteDefinition = {
  carriesUntrustedContent?: boolean;
  channel?: string;
  id: string;
  routeTone: "amber" | "blue" | "green" | "red";
  sourceAnchor: ProfileNodeAnchor;
  sourceNodeId: string;
  targetAnchor: ProfileNodeAnchor;
  targetNodeId: string;
  visualIntent:
    | "data-access"
    | "inbound"
    | "memory-write"
    | "tool-read"
    | "tool-send";
};

export type ProfileRouteSegment = ProfileRouteDefinition & {
  d: string;
  labelX: number;
  labelY: number;
};

export function getProfileNodeBounds(layout: ProfileGraphLayout) {
  return getCenteredRectBounds(layout);
}

export function getProfileNodeAnchor(
  layout: ProfileGraphLayout,
  anchor: ProfileNodeAnchor,
) {
  const bounds = getProfileNodeBounds(layout);
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

const PROFILE_ROUTE_DEFINITIONS: ProfileRouteDefinition[] = [
  {
    id: "source-browser-to-agent",
    routeTone: "blue",
    sourceAnchor: "right",
    sourceNodeId: "source-browser",
    targetAnchor: "left",
    targetNodeId: "agent-corpmate",
    visualIntent: "inbound",
  },
  {
    id: "data-email-to-email-read",
    routeTone: "amber",
    sourceAnchor: "right",
    sourceNodeId: "data-email",
    targetAnchor: "left",
    targetNodeId: "tool-email-read",
    visualIntent: "data-access",
  },
  {
    id: "agent-to-email-read",
    routeTone: "blue",
    sourceAnchor: "right",
    sourceNodeId: "agent-corpmate",
    targetAnchor: "left",
    targetNodeId: "tool-email-read",
    visualIntent: "tool-read",
  },
  {
    id: "agent-to-email-send",
    routeTone: "red",
    sourceAnchor: "right",
    sourceNodeId: "agent-corpmate",
    targetAnchor: "left",
    targetNodeId: "tool-email-send",
    visualIntent: "tool-send",
  },
  {
    id: "agent-to-memory",
    routeTone: "green",
    sourceAnchor: "right",
    sourceNodeId: "agent-corpmate",
    targetAnchor: "left",
    targetNodeId: "memory-persistent",
    visualIntent: "memory-write",
  },
];

function getProfileCurveControls(
  route: ProfileRouteDefinition,
  source: { x: number; y: number },
  target: { x: number; y: number },
) {
  const controls: Record<
    string,
    { controlOne: { x: number; y: number }; controlTwo: { x: number; y: number } }
  > = {
    "agent-to-email-read": {
      controlOne: { x: 570, y: 222 },
      controlTwo: { x: 682, y: 184 },
    },
    "agent-to-email-send": {
      controlOne: { x: 582, y: 284 },
      controlTwo: { x: 688, y: 326 },
    },
    "agent-to-memory": {
      controlOne: { x: 506, y: 318 },
      controlTwo: { x: 520, y: 372 },
    },
    "data-email-to-email-read": {
      controlOne: { x: 384, y: 366 },
      controlTwo: { x: 654, y: 358 },
    },
    "source-browser-to-agent": {
      controlOne: { x: 268, y: 184 },
      controlTwo: { x: 284, y: 238 },
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

export function buildProfileCurvePath(route: ProfileRouteDefinition) {
  const sourceLayout = PROFILE_LAYOUT_BY_NODE_ID[route.sourceNodeId];
  const targetLayout = PROFILE_LAYOUT_BY_NODE_ID[route.targetNodeId];
  const source = getProfileNodeAnchor(sourceLayout, route.sourceAnchor);
  const target = getProfileNodeAnchor(targetLayout, route.targetAnchor);
  const { controlOne, controlTwo } = getProfileCurveControls(route, source, target);

  return [
    `M ${source.x} ${source.y}`,
    `C ${controlOne.x} ${controlOne.y}`,
    `${controlTwo.x} ${controlTwo.y}`,
    `${target.x} ${target.y}`,
  ].join(" ");
}

function createProfileRouteDefinition(route: {
  carriesUntrustedContent?: boolean;
  channel?: string;
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
}): ProfileRouteDefinition | null {
  const source = PROFILE_LAYOUT_BY_NODE_ID[route.sourceNodeId];
  const target = PROFILE_LAYOUT_BY_NODE_ID[route.targetNodeId];

  if (!source || !target) {
    return null;
  }

  const sameColumn = source.x === target.x;

  return {
    carriesUntrustedContent: route.carriesUntrustedContent,
    channel: route.channel ?? route.type,
    id: route.id,
    routeTone: route.carriesUntrustedContent ? "amber" : "blue",
    sourceAnchor: sameColumn ? "bottom" : "right",
    sourceNodeId: route.sourceNodeId,
    targetAnchor: sameColumn ? "top" : "left",
    targetNodeId: route.targetNodeId,
    visualIntent: route.carriesUntrustedContent ? "inbound" : "tool-read",
  };
}

export function buildProfileRouteSegments(
  routes?: Array<{
    carriesUntrustedContent?: boolean;
    channel?: string;
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    type: string;
  }>,
): ProfileRouteSegment[] {
  const definitions = routes
    ? routes
        .map(createProfileRouteDefinition)
        .filter((route): route is ProfileRouteDefinition => Boolean(route))
    : PROFILE_ROUTE_DEFINITIONS;

  return definitions.map((route) => ({
    ...route,
    d: buildProfileCurvePath(route),
    labelX:
      (PROFILE_LAYOUT_BY_NODE_ID[route.sourceNodeId].x +
        PROFILE_LAYOUT_BY_NODE_ID[route.targetNodeId].x) /
      2,
    labelY:
      (PROFILE_LAYOUT_BY_NODE_ID[route.sourceNodeId].y +
        PROFILE_LAYOUT_BY_NODE_ID[route.targetNodeId].y) /
      2 -
      10,
  }));
}

export const profileHoverBands = PROFILE_COLUMNS.map((column) => {
  const columnLayouts = Object.values(PROFILE_NODE_LAYOUTS).filter(
    (layout) =>
      layout.columnId === column.id && PROFILE_BASE_LAYOUT_IDS.has(layout.id),
  );
  const bounds = columnLayouts.map(getProfileNodeBounds);

  return {
    id: column.id,
    xEnd: Math.max(...bounds.map((item) => item.right)),
    xStart: Math.min(...bounds.map((item) => item.left)),
  };
});

export function getProfileColumnBounds(columnId: SecurityProfileColumnId) {
  const band = profileHoverBands.find((item) => item.id === columnId);

  if (!band) {
    return null;
  }

  return {
    xEnd: band.xEnd,
    xStart: band.xStart,
  };
}

export function findProfileHoverColumnId(viewBoxX: number) {
  const band = profileHoverBands.find(
    (item) => viewBoxX >= item.xStart && viewBoxX < item.xEnd,
  );

  return band?.id ?? null;
}
