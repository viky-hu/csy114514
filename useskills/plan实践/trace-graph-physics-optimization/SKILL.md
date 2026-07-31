---
name: trace-graph-physics-optimization
description: 知识溯源页第二屏知识图谱物理布局优化 skill。用于真实 RAG 语义图谱节点过密、中心大节点均匀放射小节点、线条杂乱交织时，使用 vis-network 物理引擎和数据密度控制优化呈现。
---

# 溯源图谱物理优化

## 适用场景

当知识溯源页第二屏展示真实后端 RAG 语义关联图谱，出现多中心大节点互相连接、小节点密集放射、线条交织难读时使用。

## 目标效果

让多中心大节点与大量小节点有序分布、低重叠、可拖拽缩放，并在初始稳定后停止持续物理计算，兼顾物理感和性能。

## 数据源规则

- 进入组件时按需注入 vis-network 样式和脚本。
- 优先拉取真实图数据；若 manifest 提供 activeDataUrl 则使用它，否则回退精简 JSON。
- 请求使用 `cache: "no-store"`。
- 每次根据问题生成的图谱应存入 SQL；再次进入同一答案溯源页时读取已生成图谱，不重新后端计算。

## 物理参数

使用 `barnesHut`，优先参考：

- `gravitationalConstant: -2200`
- `centralGravity: 0.38`
- `springLength: 130`
- `springConstant: 0.05`
- `damping: 0.22`
- `avoidOverlap: 0.18`
- `adaptiveTimestep: true`
- stabilization iterations 约 320，完成后关闭 stabilization。

## 交互规则

- 允许拖节点、拖视图、缩放、hover。
- 禁用键盘和导航按钮。
- 拖动时不隐藏边和节点。
- tooltip 延迟 80ms。
- 重置视图调用 `fit`，动画 420ms，easing 使用 `easeInOutQuad`。

## 常见错题

### 错题 1：曲线越多越高级

错误做法：为了“动态弯曲”打开所有边平滑曲线，导致绕行和交叉更多。

正确做法：默认关闭 `edges.smooth`，先降低交叉和密度；确需曲线时只对特定边轻量开启。

### 错题 2：物理引擎永不停止

正确做法：稳定化完成后关闭 stabilization，保留布局定型，减少抖动和算力占用。

## 验收标准

- 多中心节点不明显压叠。
- 线条密度可读，不形成满屏乱网。
- 重置视图可用。
- 同一答案再次进入直接读 SQL 持久图谱。
