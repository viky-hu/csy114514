---
description: 按 Light_line 动效基线优化 GSAP、Rive、Three.js 或图谱时间轴
argument-hint: SURFACE="<界面或动画区域>" ISSUE="<要解决的问题>"
---

请按 `Light_line` 的“优化动效时间轴”command 执行。

动画区域：`$SURFACE`

要解决的问题：`$ISSUE`

必须加载或遵循：

- `frontend-motion-mistake-book`
- `frontend-timeline-mistake-book`
- `frontend-ui-mistake-book`
- `trace-graph-physics-optimization`
- `repo-delivery-governance`

执行要求：

1. 写清初始态、进入态、交互态、退出态和最终静止态。
2. 高频动画优先使用 `transform` 和 `opacity`。
3. 避免在 hover、滚动或频繁交互中重建完整 timeline。
4. 首屏关键动画期间禁止并发初始化重负载图谱、复杂物理布局或 WebGL 模块。
5. 覆盖 Edge + 125% 缩放检查，并记录残余风险。

交付格式：

- 时间轴阶段
- 性能风险
- 实现摘要
- 验证结果
- 残余风险
