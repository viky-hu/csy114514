# 接入 BFF RAG Workflow

## 适用场景

当聊天、检索、RAG、联邦节点、FastAPI 服务或 `/api/federation/**` 链路需要接入前端时使用。

## 目标效果

前端只调用同域 BFF；BFF 负责校验、错误稳定化、request-id 和服务层调用；Python 中心服务与节点服务保持独立运行。

## 应加载的 Skills

- `bff-route-governance`
- `federation-chat-integration`
- `fastapi-mia-rag-integration`
- `frontend-stack-mistake-book`
- `window4-chat-governance`

## 执行步骤

1. 明确链路：UI 组件 -> 前端服务封装 -> Next.js Route Handler -> central client -> Python 服务。
2. Route Handler 只做解析、校验、调用服务、返回稳定响应，不写复杂聚合逻辑。
3. 敏感配置只读服务端环境变量，禁止 `NEXT_PUBLIC_*` 暴露密钥或内部 URL。
4. 错误响应保持稳定结构，前端只消费可展示状态。
5. 健康检查、超时、降级和 request-id 要可审计。
6. 若接入 MiA-RAG，优先适配成熟库和官方服务边界，不重写核心 RAG 能力。

## 验收标准

- 前端组件没有直接访问 Python 服务。
- BFF 不泄露密钥、节点地址或内部异常堆栈。
- 聊天窗口能区分加载、成功、失败和空态。
- health/ask 等接口的职责可被文档和代码共同解释。