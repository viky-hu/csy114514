---
description: 按 Light_line 链路规范接入 BFF、RAG 或联邦检索
argument-hint: ENDPOINT="<接口或链路>" SCENARIO="<业务场景>"
---

请按 `Light_line` 的“接入 BFF / RAG / 联邦检索”command 执行。

目标接口或链路：`$ENDPOINT`

业务场景：`$SCENARIO`

必须加载或遵循：

- `bff-route-governance`
- `federation-chat-integration`
- `fastapi-mia-rag-integration`
- `frontend-stack-mistake-book`
- `window4-chat-governance`

执行要求：

1. 明确链路：UI -> 前端 service -> Next.js Route Handler -> central client -> Python 服务。
2. Route Handler 只负责解析、校验、调用服务和返回稳定响应。
3. 敏感配置只放服务端环境变量，禁止公开到 `NEXT_PUBLIC_*`。
4. 错误响应必须稳定，不把内部异常和节点地址直接暴露给前端。
5. 接入 RAG 时优先适配成熟库和已有后端边界，不重写核心 RAG 能力。

交付格式：

- 链路归属
- 接口行为
- 安全边界
- 错误与降级
- 验证结果
