---
name: bff-route-governance
description: Next.js BFF 与 Route Handler 治理 skill。用于新增或改造 app api 路由、联邦 ask health 接口、模型配置接口、数据库接口时，统一校验、鉴权、限流、错误归一化和环境变量边界。
---

# BFF 路由治理

## 职责边界

Route Handler 只做解析请求、校验参数、调用服务、返回标准响应。复杂业务逻辑放到 `lib/server/**` 或明确服务文件。

## 必做规则

- 所有密钥和后端地址来自环境变量，禁止硬编码。
- 敏感变量不得使用 `NEXT_PUBLIC_*`。
- 每个接口必须提供稳定错误语义：HTTP 状态码、可读消息、必要的 requestId。
- 前端统一调用同域 `/api/...`，不直接请求 Python 中心或节点服务。
- 新增接口时说明未来如何支持新节点、新字段、超时和失败降级。

## 常见错题

### 错题 1：能跑通但无边界保护

错误做法：Route Handler 直接转发 body，不校验、不鉴权、不处理上游错误。

正确做法：进入服务前做 schema 校验；上游失败统一转成稳定错误体。

### 错题 2：响应结构重复散落

错误做法：每个 route 都手写一套 `{ ok, error }`。

正确做法：出现重复响应结构时抽公共响应构造器或错误工具。

### 错题 3：把聚合逻辑放进 `proxy.ts`

错误做法：用 `proxy.ts` 做慢查询和联邦聚合。

正确做法：`proxy.ts` 只做全局边界能力，业务聚合留在 Route Handler 和服务层。

## 联邦接口检查点

- `/api/federation/ask` 负责前端统一提问入口。
- `/api/federation/health` 负责中心与节点健康聚合。
- 服务层处理超时、上游错误、响应校验和 requestId 贯穿。
- `global` 模式走联邦，`local` 模式可保留本地或增强检索回退。
