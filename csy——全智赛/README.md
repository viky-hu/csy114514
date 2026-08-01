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
