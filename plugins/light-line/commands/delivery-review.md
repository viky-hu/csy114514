---
description: 按 Light_line 仓库门禁做交付前审查
argument-hint: CHANGE="<改动摘要或文件范围>"
---

请按 `Light_line` 的“交付前审查”command 执行。

审查对象：`$CHANGE`

必须加载或遵循：

- `repo-delivery-governance`
- `frontend-stack-mistake-book`
- `frontend-component-mistake-book`
- 与改动区域对应的窗口、BFF 或计划实践 skill

执行要求：

1. 说明主责文件和协同文件。
2. 检查扩展成本和边界稳定性，而不是只确认是否报错。
3. 如果发现重复逻辑、边界污染或硬编码扩散，当次重构。
4. 如果模块职责变化，同步架构索引和扩展性审查记录。
5. 给出已运行验证、未运行验证和残余风险。

交付格式：

- 功能归属声明
- 扩展性审查
- 必要重构
- 文档同步情况
- 验证结果
- 残余风险
