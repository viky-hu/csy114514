---
description: 按 Light_line 项目规范新增一个前端功能
argument-hint: TARGET="<目标模块或文件>" GOAL="<要完成的效果>"
---

请按 `Light_line` 的“新增前端功能”command 执行。

目标模块或文件：`$TARGET`

目标效果：`$GOAL`

必须加载或遵循：

- `frontend-stack-mistake-book`
- `frontend-component-mistake-book`
- `frontend-ui-mistake-book`
- `repo-delivery-governance`
- `window-module-boundary`
- 目标目录下适用的 `AGENTS.md`

执行要求：

1. 先确认功能归属：主责文件、协同文件、是否影响模块职责。
2. 保持 Next.js App Router、React、TypeScript、Tailwind、shadcn/ui、GSAP 的项目边界。
3. 不把 BFF、RAG、密钥、慢查询聚合塞进 UI 组件。
4. 若发现重复逻辑、边界污染或硬编码扩散，当次重构。
5. 改动后给出扩展性审查、必要重构说明和验证结果。

交付格式：

- 功能归属
- 实现摘要
- 扩展性审查
- 必要重构
- 验证结果
- 残余风险
