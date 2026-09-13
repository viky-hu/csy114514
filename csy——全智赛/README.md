# 全智赛 — Agent 安全测评平台

## 快速启动

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## 项目结构

- `backend/` — FastAPI 服务
- `shared/contracts/` — 冻结契约（全项目唯一真相来源）
- `shared/fixtures/` — Mock 数据
- `reference-agent/` — CorpMate 参考 Agent
- `frontend/` — 前端

## 环境变量

复制 `.env.example` 为 `.env` 后启动。

开发联调时，前端可以直接打开 `http://localhost:3000/?evaluationMock=1`；
`?evaluationMode=1` 是兼容别名。两者均使用本地确定性测评和红队事件回放，不需要登录、BFF 或 Adapter。
如需走真实红队 BFF/SSE 流程，设置 `REDTEAM_BFF_SIGNING_SECRET`；仅在本机调试受控 fixture Adapter 时，同时设置
`DEBUG=true` 与 `REDTEAM_FIXTURE_ADAPTER_ENABLED=true`。真实 HTTP Adapter 仍只接受公网 HTTPS 测试目标。
