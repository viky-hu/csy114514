---
description: 按 Light_line 窗口边界改造 Window 1-4 模块
argument-hint: WINDOW="<窗口名或路径>" CHANGE="<改造目标>"
---

请按 `Light_line` 的“改造窗口模块”command 执行。

目标窗口：`$WINDOW`

改造目标：`$CHANGE`

必须加载或遵循：

- `window-module-boundary`
- `shared-component-governance`
- 目标窗口对应的治理 skill
- `frontend-component-mistake-book`
- 目标目录下适用的 `AGENTS.md`

执行要求：

1. 明确窗口主责，不跨窗口读取私有状态。
2. shared 层只放纯 helper、稳定组件或跨窗口合同，不塞窗口私有分支。
3. Window 4 改造必须检查会话 ID 同步、FLIP 捕获时机、portal 弹窗和存储模式位置。
4. Window 3 改造必须区分列表、详情、预览、写回和反馈状态。
5. Window 2 改造必须保持 D1-D5 单向数据和中心化联动。
6. 改造后说明职责边界是否更稳定。

交付格式：

- 窗口归属
- 边界变化
- 实现摘要
- 扩展性审查
- 验证结果
