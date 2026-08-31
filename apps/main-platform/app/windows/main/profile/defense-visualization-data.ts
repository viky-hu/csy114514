export type DefenseLayer = {
  id: DefenseLayerId;
  label: string;
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

// The flow and backend-facing state stay in canonical ID order. The wheel
// follows the conceptual visual flow from brief section 4.1.
export const DEFENSE_WHEEL_LAYERS: readonly DefenseLayer[] = [
  DEFENSE_LAYERS[0]!,
  DEFENSE_LAYERS[3]!,
  DEFENSE_LAYERS[4]!,
  DEFENSE_LAYERS[5]!,
  DEFENSE_LAYERS[6]!,
  DEFENSE_LAYERS[7]!,
  DEFENSE_LAYERS[1]!,
  DEFENSE_LAYERS[2]!,
];

export function getDefenseLayer(index: number): DefenseLayer {
  return DEFENSE_LAYERS[index] ?? DEFENSE_LAYERS[DEFAULT_DEFENSE_LAYER_INDEX]!;
}

export function getDefenseWheelIndex(canonicalIndex: number): number {
  const canonicalLayer = getDefenseLayer(canonicalIndex);
  const wheelIndex = DEFENSE_WHEEL_LAYERS.findIndex(
    (layer) => layer.id === canonicalLayer.id,
  );
  return wheelIndex >= 0 ? wheelIndex : 0;
}

export function getDefenseCanonicalIndexFromWheelIndex(wheelIndex: number): number {
  const wheelLayer = DEFENSE_WHEEL_LAYERS[wheelIndex] ?? DEFENSE_WHEEL_LAYERS[0]!;
  const canonicalIndex = DEFENSE_LAYERS.findIndex(
    (layer) => layer.id === wheelLayer.id,
  );
  return canonicalIndex >= 0 ? canonicalIndex : DEFAULT_DEFENSE_LAYER_INDEX;
}
