# Agent 工作交接报告

> 日期: 2026-08-24
> 交接内容: 本 Session 完成的所有工作及项目现状

---

## 一、本 Session 完成的工作

### 1. 自适应红队 (Adaptive Red Team) — 已完成 ✅

**需求来源**: 用户要求"一个有实际应用价值但是难度和工作量不大的方案"

**新增文件 (4 个):**
| 文件 | 说明 |
|------|------|
| `backend/app/redteam/__init__.py` | 包初始化 |
| `backend/app/redteam/mutator.py` | 攻击变异引擎: 5 种策略 (encoding/synonym/cross_session/social/mixed_lang) |
| `backend/scripts/run_redteam.py` | 红队运行脚本: CLI + 迭代反馈循环 + 报告生成 |
| `backend/tests/test_redteam_mutator.py` | 24 个单元测试 |

**产出**: `redteam_report.md` (项目根目录) — 2 轮 × 4 种子 × 16 变异, 0 bypass

**Bug 修复**: `_extract_strategy()` 中策略名提取从 split("_") 改为子串匹配 `f"_{s}_"`, 解决了 cross_session 策略被误标为 unknown 的问题.

### 2. 项目文档 — 已完成 ✅

**新增文件 (3 个):**
| 文件 | 说明 |
|------|------|
| `docs/project_overview.md` | 项目结构与内容分布地图 — 后端17模块 + 前端7工作区 + 共享资源 |
| `docs/project_introduction.md` | 项目简介 — 背景/目标/方案/成果/亮点/应用场景 |
| `docs/architecture/frontend-map.md` | 前端全景地图 (Explore agent 产出, 458行, 13个章节) |

### 3. 一键启动脚本 — 已完成 ✅

**修改文件**: `一键启动.bat`

- 原来只启动后端, 现在同时启动前后端 (两个独立窗口)
- 后端: uvicorn :8000 (热重载)
- 前端: pnpm dev :3000
- GBK 编码 + CRLF 换行 (Windows cmd.exe 兼容)
- 使用 Python raw string + `write_bytes()` 生成, 避免 BOM 和 shell 转义问题
- 生成辅助脚本 `_write_bat.py` 已删除

### 4. D3 确认门控闭环 — 已完成 ✅

**需求来源**: 胡继天发现邮件确认弹窗的"允许/拒绝"只更新前端 state, 不回传后端

**改动文件 (8 个):**

**后端 (6 个):**
| 文件 | 改动 |
|------|------|
| `backend/app/domain/enums.py` | 新增 `CONFIRMATION_REQUESTED`, `CONFIRMATION_DECIDED` 事件类型 |
| `backend/app/confirmation/__init__.py` | **新增** — `ConfirmationManager` (线程安全, threading.Event 阻塞等待) |
| `backend/app/sandbox/composite.py` | `execute()` 中插入 D3 确认门控: 发布事件 → 阻塞等待 → 接收决定 |
| `backend/app/services/evaluation_service.py` | 创建/管理 per-run ConfirmationManager + `get_confirmation_manager()` + finally 清理 |
| `backend/app/api/evaluations.py` | 新增 `POST /{id}/confirmations/{call_id}` 端点 |
| `backend/tests/test_confirmation_manager.py` | **新增** — 9 个测试 (非交互/交互/超时/并发) |
| `backend/tests/test_domain_enums.py` | 更新枚举测试, 加入两个新事件类型 |

**前端 (2 个):**
| 文件 | 改动 |
|------|------|
| `app/api/evaluations/[evaluationId]/confirmations/[callId]/route.ts` | **新增** — BFF 代理路由 |
| `EvaluationWorkspaceProvider.tsx` | `resolveEmailConfirmation` 增加 `fetch()` 回传后端 |

**闭环流程**:
```
email.send (confirmed=false) → CompositeSandbox 发布 CONFIRMATION_REQUESTED
  → SSE 推送到前端 → 弹窗
  → 用户点允许/拒绝 → fetch POST 到后端
  → ConfirmationManager.submit_decision() → event.set()
  → 执行线程解除阻塞 → 根据决定执行或拒绝发送
```

**设计要点**:
- 60 秒超时自动拒绝
- `interactive=False` 模式用于 CLI 脚本 (自动拒绝, 不阻塞)
- 现有 346 个测试不受影响
- 测试结果: 355 个测试全部通过 (346 原有 + 9 新增)

### 5. 前端拉取 — 已完成 ✅

两次从 `origin/codex-overview-r4-dashboard` 合并到 `main`:
- 第1次: 2 commits (Agent测评提示栏位置移动 + D3冻结), 8 文件
- 第2次: 2 commits (修复bug + mock evaluation), 21 文件 (含 `evaluation-mock.ts`, 可用 `?evaluationMock=1`)

---

## 二、Git 状态

**当前分支**: `main`

**未提交的变更 (全部):**

Modified (8):
```
M  apps/main-platform/app/windows/main/evaluation/EvaluationWorkspaceProvider.tsx
M  csy——全智赛/backend/app/api/evaluations.py
M  csy——全智赛/backend/app/domain/enums.py
M  csy——全智赛/backend/app/sandbox/composite.py
M  csy——全智赛/backend/app/services/evaluation_service.py
M  csy——全智赛/backend/tests/test_domain_enums.py
M  csy——全智赛/baseline_98_report.md
M  csy——全智赛/一键启动.bat
```

Untracked (10):
```
?? apps/main-platform/app/api/evaluations/[evaluationId]/confirmations/     ← D3 BFF路由
?? csy——全智赛/backend/app/confirmation/                                    ← D3 ConfirmationManager
?? csy——全智赛/backend/app/redteam/                                         ← 红队模块
?? csy——全智赛/backend/scripts/run_redteam.py                               ← 红队脚本
?? csy——全智赛/backend/tests/test_confirmation_manager.py                   ← D3 测试
?? csy——全智赛/backend/tests/test_redteam_mutator.py                        ← 红队测试
?? csy——全智赛/docs/project_introduction.md                                 ← 项目简介
?? csy——全智赛/docs/project_overview.md                                     ← 项目结构地图
?? csy——全智赛/redteam_report.md                                            ← 红队报告
?? docs/architecture/frontend-map.md                                        ← 前端全景地图
```

**所有变更都未 commit**, 用户尚未要求提交.

---

## 三、项目关键指标

| 指标 | 数值 |
|------|------|
| 后端代码 | ~8,500 行 (含红队 + 确认模块) |
| 测试用例 | 355 个 (全部通过) |
| 安全 TC | 98 条 (4 大风险模式) |
| 防御层 | 8 层 (D1-D8) |
| Agent | 3 个 (CorpMate / Bare LLM / Defended LLM) |
| Defended LLM 拦截率 | 100% (98/98 PASS) |
| 红队变异策略 | 5 种 |
| 前端工作区 | 7 个 |
| BFF 路由 | 17 条 (含新增的确认路由) |

---

## 四、项目文件速查

| 想找什么 | 去看 |
|---------|------|
| 项目整体结构 | `docs/project_overview.md` |
| 项目简介 (写材料用) | `docs/project_introduction.md` |
| 前端详细结构 | `docs/architecture/frontend-map.md` |
| 基线测试报告 | `baseline_98_report.md` |
| 红队测试报告 | `redteam_report.md` |
| 契约治理规则 | `CODING_AGENT_RULE.md` |
| 安全语义定义 | `docs/security-model.md` |
| 一键启动 | `一键启动.bat` (双击启动前后端) |

---

## 五、技术栈 & 运行方式

**后端**: Python 3.14 + FastAPI + Pydantic v2 + SQLite
```bash
cd backend
# venv 在 backend/venv/
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
# 运行测试
python -m pytest backend/tests/ -v
# 运行基线评估
python -m backend.scripts.run_baseline --workers 4 --output baseline_98_report.md
# 运行红队
python -m backend.scripts.run_redteam --rounds 2 --output redteam_report.md
```

**前端**: Next.js + React + TypeScript + Tailwind CSS v4 + GSAP
```bash
cd apps/main-platform
pnpm dev  # :3000
# Mock 模式: http://localhost:3000/?evaluationMock=1
```

**LLM API**: SiliconFlow (MiniMax-M2.5), base URL `https://api.siliconflow.cn/v1`

---

## 六、已知问题 & 待办

### 已完成但可能需要后续优化:

1. **D3 确认闭环前端联调**: 后端 API 和前端 fetch 已实现, 但尚未在实际前端环境中端到端验证 (弹窗 → 点击 → 后端解除阻塞 → 邮件发送). 建议胡继天在前端实测一次完整流程.

2. **红队报告策略提取**: `_extract_strategy()` 已修复, 但红队运行结果因 LLM 非确定性, 每次运行 bypass 数量不同 (0-2). 这是预期行为.

3. **一键启动.bat**: 编码为 GBK, 不含中文注释. 如果路径包含特殊字符可能有问题.

### 用户可能想做但尚未明确要求的:

1. **提交所有变更到 git** — 当前所有改动都是未提交状态
2. **更多红队轮次** — 当前只跑了 2 轮, 可以增加到 3-5 轮
3. **前端 E2E 测试** — 为 D3 确认闭环添加 Playwright 测试
4. **项目材料撰写** — 用户提到要写项目申报/介绍材料, 文档已准备好

---

## 七、团队信息

| 角色 | 成员 | 负责领域 |
|------|------|---------|
| Security & Evaluation Owner | 陈书扬 | 安全模型、测试用例、Judge 系统、防御策略 |
| Platform & Backend Owner | 步嘉城 | 后端架构、API、沙箱、执行引擎 |
| Frontend & Experience Owner | 胡继天 | 前端 UI/UX、交互、数据可视化 |

**GitHub**: `https://github.com/viky-hu/csy114514`
**默认分支**: `main`
**活跃远程分支**: `codex-overview-r4-dashboard` (前端更新)
