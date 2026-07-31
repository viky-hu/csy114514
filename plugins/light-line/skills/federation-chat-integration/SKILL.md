---
name: federation-chat-integration
description: 联邦聊天真实链路接入 skill。用于把 Window 4 global 问答从前端 mock 切换到 Next.js BFF、central_server.py、多个 node_server.py 的多节点协同检索与中心聚合回答链路。
---

# 联邦聊天接入

## 适用场景

当需要把交互对话的全局模式接入真实中心节点和普通节点，或修复联邦 ask、health、requestId、错误降级链路时使用。

## 目标效果

前端发送问题后，经由 `/api/federation/ask` 调用中心服务，中心向多个节点查询，返回聚合答案和节点明细；任一节点失败时系统仍部分可用并给出可理解反馈。

## 推荐链路

```text
ChatInteractionPanel
  -> federation-chat-api.ts
  -> /api/federation/ask
  -> central-client.ts
  -> central_server.py /ask
  -> node_server.py /query
```

## 实施步骤

1. 冻结请求和响应 schema，包含主答案、节点明细、status、requestId、错误体。
2. 在 BFF 层完成请求解析、schema 校验、requestId 透传、错误归一化。
3. 服务层封装中心调用、超时、上游错误和响应校验。
4. `global` 模式走联邦真实链路，`local` 模式保留本地或 mock 回退。
5. 中心服务和节点服务统一读取 SM4 key、节点超时和 requestId。
6. 增加 health 聚合，支持中心健康和节点健康可观测。
7. 同步架构文档和扩展审查记录。

## 必查边界

- 前端不暴露后端密钥和内网地址。
- 任一节点故障时返回 partial 或可理解 error。
- requestId 贯穿前端、BFF、中心、节点日志。
- 重复错误结构必须抽象，不散写。
