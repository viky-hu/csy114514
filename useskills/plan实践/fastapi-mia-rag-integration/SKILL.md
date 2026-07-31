---
name: fastapi-mia-rag-integration
description: FastAPI 加 MiA-RAG 后端整合联调 skill。用于将 Encrypted Smart Graph 后端作为独立 Python 服务接入 final，最小改动前端 local global 检索链路，并保留模型路径和 API Key 占位。
---

# FastAPI 与 MiA-RAG 后端整合

## 适用场景

当队友提供的后端代码需要正式接入 final 前端，尤其 Window 4 的 local 和 global 检索链路需要逐步替换 mock 时使用。

## 目标效果

保持前端主链路最小改动，把新后端作为独立 Python 服务接入，通过现有 `/api/node/retrieve`、`/api/federation/ask`、`central_server.py`、`node_server.py` 形成可验证闭环。

## 暂不执行边界

- 不自行配置 Qwen3-Embedding-8B 真实路径。
- 不自行填真实 API Key。
- 不重写队友已有 RAG 框架。
- 不做生产级部署编排，先完成开发联调和验收脚手架。

## 后端模块映射

- `api/routers/auth.py`：注册、登录、当前用户、JWT 鉴权。
- `api/routers/documents.py`：文档上传、列表、删除。
- `api/routers/query.py`：问答与证据，可作为增强 local 检索来源。
- `api/routers/nodes.py`：节点注册、列表、申请成为中心节点。
- `mia_emb/*`：MiA-RAG 双通道检索、嵌入、mindscape、配置、多模态。
- `node_server.py`：加密节点入口，收到查询后调用 RAG 并加密返回。
- `crypto_utils.py`：SM2、SM3、SM4 通信安全工具。

## 实施顺序

1. 输出后端模块深析、前端映射、差异清单。
2. 冻结接口契约和配置矩阵，环境变量允许占位。
3. local 检索以现有 `/api/node/retrieve` 返回契约为基准，内部可切到新后端 MiA-RAG，并保留回退。
4. global 联邦保持 `askFederationChat -> /api/federation/ask -> central -> node` 主链不变。
5. 延续 requestId、内部 token、TLS 或本地回环例外、header 编解码对称。
6. 分层验证接口契约、鉴权权限、健康状态、端到端发送。
7. 更新架构文档和扩展审查记录。

## 验收标准

- 无模型密钥时仍可自检链路联通、鉴权、错误语义和降级行为。
- 前端 local 和 global 发送流程可验证。
- 配置集中在环境变量，不写死。
- 没有自行编写或替换队友已有 RAG 核心逻辑。
