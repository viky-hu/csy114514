export type DefenseLayer = {
  id: `D${number}`;
  label: string;
};

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

export function getDefenseLayer(index: number): DefenseLayer {
  return DEFENSE_LAYERS[index] ?? DEFENSE_LAYERS[DEFAULT_DEFENSE_LAYER_INDEX]!;
}
