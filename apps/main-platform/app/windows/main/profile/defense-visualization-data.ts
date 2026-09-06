export type DefenseLayer = {
  id: DefenseLayerId;
  label: string;
};

export type DefenseDisplayLayer = {
  displayId: `D${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;
  label: string;
  canonicalId: DefenseLayerId;
};

export type DefenseDisplayItem =
  | DefenseDisplayLayer & { kind: "layer" }
  | {
      kind: "bridge";
      id: "llm-tool-call-bridge";
      label: "LLM 推理 → 返回 tool calls";
    };

export type DefenseLayerId =
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "D5"
  | "D6"
  | "D7"
  | "D8";

export const DEFENSE_LAYERS: readonly DefenseLayer[] = [
  { id: "D1", label: "输入过滤" },
  { id: "D2", label: "输出过滤" },
  { id: "D3", label: "确认门控" },
  { id: "D4", label: "指令隔离" },
  { id: "D5", label: "链检测" },
  { id: "D6", label: "意图分类" },
  { id: "D7", label: "记忆审计" },
  { id: "D8", label: "会话监控" },
];

export const DEFAULT_DEFENSE_LAYER_INDEX = 0;
export const DEFAULT_DEFENSE_DISPLAY_INDEX = 0;

// The display sequence follows the conceptual data flow while canonical
// IDs remain stable for backend reports and internal state.
export const DEFENSE_DISPLAY_LAYERS: readonly DefenseDisplayLayer[] = [
  { displayId: "D1", label: "输入过滤", canonicalId: "D1" },
  { displayId: "D2", label: "指令隔离", canonicalId: "D4" },
  { displayId: "D3", label: "因果链监测", canonicalId: "D5" },
  { displayId: "D4", label: "意图分类", canonicalId: "D6" },
  { displayId: "D5", label: "记忆审计", canonicalId: "D7" },
  { displayId: "D6", label: "会话监控", canonicalId: "D8" },
  { displayId: "D7", label: "输出过滤", canonicalId: "D2" },
  { displayId: "D8", label: "确认门控", canonicalId: "D3" },
];

export const DEFENSE_DISPLAY_ITEMS: readonly DefenseDisplayItem[] = [
  { kind: "layer", displayId: "D1", label: "输入过滤", canonicalId: "D1" },
  { kind: "layer", displayId: "D2", label: "指令隔离", canonicalId: "D4" },
  {
    kind: "bridge",
    id: "llm-tool-call-bridge",
    label: "LLM 推理 → 返回 tool calls",
  },
  { kind: "layer", displayId: "D3", label: "因果链监测", canonicalId: "D5" },
  { kind: "layer", displayId: "D4", label: "意图分类", canonicalId: "D6" },
  { kind: "layer", displayId: "D5", label: "记忆审计", canonicalId: "D7" },
  { kind: "layer", displayId: "D6", label: "会话监控", canonicalId: "D8" },
  { kind: "layer", displayId: "D7", label: "输出过滤", canonicalId: "D2" },
  { kind: "layer", displayId: "D8", label: "确认门控", canonicalId: "D3" },
];

export function getDefenseLayer(index: number): DefenseLayer {
  return DEFENSE_LAYERS[index] ?? DEFENSE_LAYERS[DEFAULT_DEFENSE_LAYER_INDEX]!;
}

export function getDefenseDisplayIndexFromCanonicalIndex(
  canonicalIndex: number,
): number {
  const canonicalLayer = getDefenseLayer(canonicalIndex);
  const displayIndex = DEFENSE_DISPLAY_LAYERS.findIndex(
    (layer) => layer.canonicalId === canonicalLayer.id,
  );
  return displayIndex >= 0 ? displayIndex : 0;
}

export function getDefenseCanonicalIndexFromDisplayIndex(
  displayIndex: number,
): number {
  const displayLayer =
    DEFENSE_DISPLAY_LAYERS[displayIndex] ?? DEFENSE_DISPLAY_LAYERS[0]!;
  const canonicalIndex = DEFENSE_LAYERS.findIndex(
    (layer) => layer.id === displayLayer.canonicalId,
  );
  return canonicalIndex >= 0 ? canonicalIndex : DEFAULT_DEFENSE_LAYER_INDEX;
}

export function getDefenseCanonicalIndexFromDisplayItemIndex(
  displayIndex: number,
): number | null {
  const item = DEFENSE_DISPLAY_ITEMS[displayIndex];
  if (!item || item.kind === "bridge") return null;
  const canonicalIndex = DEFENSE_LAYERS.findIndex(
    (layer) => layer.id === item.canonicalId,
  );
  return canonicalIndex >= 0 ? canonicalIndex : null;
}

export function getDefenseCanonicalIdFromDisplayItem(
  item: DefenseDisplayItem,
): DefenseLayerId | null {
  return item.kind === "bridge" ? null : item.canonicalId;
}
