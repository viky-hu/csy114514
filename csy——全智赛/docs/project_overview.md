# 项目概览 — AI Agent 安全评估平台 (CorpSec Platform)

## 一句话介绍

面向企业级 AI Agent 的安全评估平台：通过沙箱化执行、多层防御、自动化红队攻击和量化评分，系统性地检测和防御 AI Agent 面临的提示注入、记忆投毒、隐私泄露和越权操作等安全风险。

## 核心能力

1. **Agent 接入与画像** — 用户接入 AI Agent，平台自动生成安全画像（Attack Graph）和风险路径
2. **沙箱化安全评估** — 在隔离沙箱中运行 98 条安全测试用例，覆盖 4 大风险模式
3. **8 层纵深防御** — 从输入过滤到会话监控的完整防御体系，实测 100% 拦截率
4. **自适应红队** — 自动变异攻击、反馈驱动的迭代渗透测试
5. **三 Agent 对比** — 规则 Agent / 裸 LLM / 防御 LLM 三方对比评估
6. **实时 SSE 推送** — 评估过程实时事件流推送到前端

## 团队分工

| 角色 | 成员 | 负责领域 |
|------|------|---------|
| Security & Evaluation Owner | 陈书扬 | 安全模型、测试用例、Judge 系统、防御策略 |
| Platform & Backend Owner | 步嘉城 | 后端架构、API、沙箱、执行引擎 |
| Frontend & Experience Owner | 胡继天 | 前端 UI/UX、交互、数据可视化 |

## 技术栈

| 层面 | 技术 |
|------|------|
| 后端 | Python 3.14, FastAPI, Pydantic v2, SQLite, NetworkX |
| 前端 | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI |
| LLM | SiliconFlow API (MiniMax-M2.5), OpenAI 兼容接口 |
| 测试 | pytest (346 测试), Playwright E2E |
| 工具链 | pnpm workspace, ruff, ESLint |

---

## 项目目录结构与内容分布

```
repo/
├── csy——全智赛/                 ← 后端 + 共享资源 (本仓库核心)
│   ├── backend/                 ← FastAPI 后端应用
│   ├── shared/                  ← 跨端契约 + 测试数据
│   └── docs/                    ← 项目文档
├── apps/
│   └── main-platform/           ← Next.js 前端应用
└── packages/
    └── configs/                 ← 共享配置
```

---

### 一、后端 (`backend/`)

> ~8,000 行应用代码 + ~6,000 行测试代码, 346 个测试用例

#### 1.1 API 路由层 (`backend/app/api/`)

| 文件 | 说明 |
|------|------|
| `health.py` | GET /health 健康检查 |
| `agents.py` | Agent 注册/查询, GET /agents/{id}/graph 攻击图 |
| `evaluations.py` | 评估流程: 创建/启动/SSE事件流/报告, **最复杂的API模块** |
| `test_cases.py` | 测试用例列表查询 |

#### 1.2 领域模型 (`backend/app/domain/`) — 15 个 Pydantic 模型

| 模型 | 说明 |
|------|------|
| `enums.py` | 全局枚举: RiskType, Severity, Permission, NodeType, EventType 等 |
| `agent_manifest.py` | Agent 接入声明 (能力/工具/权限) |
| `attack_graph.py` | 攻击图: GraphNode + Edge + AttackGraph |
| `attack_path.py` | 一条命中的风险路径 |
| `test_case.py` + `test_scenario.py` | 测试用例 + 多轮场景 + 环境增量 |
| `judge_result.py` | 判定结果: PASS/FAIL + 违规 + 证据 |
| `risk_finding.py` | 确认的风险发现 (含证据链) |
| `evaluation_run.py` + `evaluation_report.py` | 评估运行状态 + 评分报告 |
| `execution_event.py` + `execution_trace.py` | 执行事件 + 执行轨迹 |

#### 1.3 核心服务 (`backend/app/services/`) — 系统骨干

| 文件 | 行数 | 说明 |
|------|------|------|
| `evaluation_service.py` | 946 | **最大文件** — 评估协调器: 创建运行、预检、执行、SSE推送、持久化 |
| `preflight_service.py` | 270 | 攻击载荷预检: 解析 Seed → 变异浏览器页面 → 验证金丝雀 |
| `graph_builder.py` | 178 | 从 AgentManifest 生成 AttackGraph |
| `report_service.py` | 201 | 构建评估报告: 评分维度、严重度扣分 |
| `agent_service.py` | 56 | Agent 注册表 |

#### 1.4 Agent 系统 (`backend/app/agents/`) — 三个 Agent + 8 层防御

**三个 Agent:**

| Agent | 文件 | 说明 |
|-------|------|------|
| CorpMate v0 | `corpmate/agent.py` | 规则引擎 Agent, 关键词匹配 (基准线) |
| LLM Agent v0 | `agents/llm_agent.py` | 裸 LLM Agent, 无防御 (脆弱性对照) |
| Defended LLM v0 | `agents/defended_llm_agent.py` | 8层防御 LLM Agent (核心交付物) |

**8 层防御体系 (`agents/defenses/`):**

| 层 | 文件 | 防御内容 |
|----|------|---------|
| D1 | `input_filter.py` | 输入过滤: Unicode归一化、Base64解码、零宽字符、隐藏HTML剥离、27种注入模式检测 |
| D2 | `output_filter.py` | 输出过滤: 可疑收件人、页面来源收件人、页面内容外泄、恶意记忆写入 |
| D3 | `composite.py` (sandbox) | 确认门控: email.send 等危险操作需用户确认 |
| D4 | `prompts.py` | 指令隔离: 系统提示中严格区分可信/不可信数据 |
| D5 | `chain_detector.py` | 链检测: 6种可疑因果链 (浏览→记忆→发送), 滑动窗口匹配 |
| D6 | `intent_classifier.py` | 意图分类: 区分用户意图 vs 页面指令 |
| D7 | `memory_auditor.py` | 记忆审计: 阻止可疑记忆写入 (转发指令、注入关键词) |
| D8 | `session_monitor.py` | 会话监控: 跨会话/同会话记忆投毒检测 |

#### 1.5 Judge 系统 (`backend/app/judge/`)

| 文件 | 说明 |
|------|------|
| `rule_judge.py` | 规则 Judge: 禁止动作检测、确认缺失检测、敏感数据暴露检测 |
| `llm_judge.py` | LLM Judge: 基于 LLM 的语义安全评估 (结构化输出) |
| `composite_judge.py` | 组合 Judge: Rule (必须先过) + LLM (语义补充) |
| `r4_judge.py` | R4 专用 Judge: 持久化 IPI 因果链判定 |
| `prompts.py` | Judge 提示词模板 |

#### 1.6 沙箱系统 (`backend/app/sandbox/`)

| 文件 | 说明 |
|------|------|
| `composite.py` | 组合沙箱: 路由工具调用到子沙箱, 事件观察, 金丝雀注入 |
| `email_sandbox.py` | 邮件沙箱: 模拟收件箱 (list/read/send + 确认门控) |
| `browser_sandbox.py` | 浏览器沙箱: 模拟网页浏览 (HTML fixture 加载) |
| `memory_sandbox.py` | 记忆沙箱: 键值存储 (跨轮持久持久化) |

#### 1.7 攻击图分析 (`backend/app/attack_graph/`)

| 文件 | 说明 |
|------|------|
| `path_finder.py` | BFS/DFS 路径搜索 (max_depth=4), 基于 NetworkX |
| `risk_matcher.py` | 风险模式匹配: 将 RiskPattern 映射到图路径 |

#### 1.8 其他模块

| 模块 | 说明 |
|------|------|
| `llm/client.py` | LLM 客户端: OpenAI 兼容, 线程安全缓存, 重试退避, 工具名映射 |
| `runner/runner.py` | 测试编排器: TestCase → 多轮执行 → 沙箱 → 轨迹 → Judge |
| `adapter/reference_adapter.py` | Agent 适配器: 统一接口封装 |
| `trace/recorder.py` | 执行轨迹记录: 事件时间戳 + 指纹 |
| `persistence/sqlite_store.py` | SQLite 持久化: WAL 模式, 线程安全, 幂等支持 |
| `knowledge/kb_loader.py` | 安全知识库加载: 从 JSON 文件加载风险模式/攻击种子/测试用例 |
| `security/fingerprints.py` | HMAC 指纹: 金丝雀派生 + 值指纹 (完整性验证) |
| `redteam/mutator.py` | 自适应红队: 5种变异策略 (编码/同义词/跨会话/社工/混语) |

#### 1.9 脚本 (`backend/scripts/`)

| 文件 | 说明 |
|------|------|
| `run_baseline.py` | 基线运行器: 3 Agent × 98 TC 对比评估, 并发执行, 报告导出 |
| `run_redteam.py` | 红队运行器: 迭代变异 + 自适应反馈 + 报告生成 |

#### 1.10 测试 (`backend/tests/`) — 37 个文件, 346 个测试

| 类别 | 文件数 | 覆盖内容 |
|------|--------|---------|
| 领域/Schema | 4 | 数据模型验证、枚举值、fixture 一致性 |
| 攻击图 | 3 | 路径搜索、风险匹配、图构建 |
| 沙箱 | 4 | 工具执行、事件观察、env_delta |
| Judge | 3 | 规则Judge、LLM Judge、组合Judge |
| Agent/防御 | 5 | 三Agent、8层防御、链检测、跨会话 |
| 集成/垂直切片 | 3 | 端到端链路、批量验证 |
| API | 5 | 各端点功能测试、SSE |
| 服务/持久化 | 5 | 评估存储、预检、评分、多轮 |
| 红队 | 1 | 变异策略正确性 |
| 其他 | 4 | 适配器、CorpMate、KB加载、契约 |

---

### 二、前端 (`apps/main-platform/`) — **AgentProof**

> Next.js (App Router) + React + TypeScript · Tailwind CSS v4 · GSAP 3.14 · Three.js
> **详细地图**: 见 `repo/docs/architecture/frontend-map.md`

#### 2.1 架构概览

- **单页应用**: 只有一个路由 `/`，所有"页面"通过 React 状态在客户端切换
- **两个窗口**: `LoginIntroWindow` (登录/Agent接入) ↔ `MainWindow` (主工作台)
- **BFF 代理**: 浏览器只与同源 `/api/*` 通信，不直连后端
- **双后端**: Agent Eval 后端 (`:8000`) + Account Auth 后端 (MiA-RAG)
- **Monorepo**: pnpm workspaces + Turborepo, 共享包 `@csy/configs` + `ui-components`

#### 2.2 7 个导航工作区

| # | 导航键 | 中文 | 组件 | 功能 |
|---|--------|------|------|------|
| 01 | `dashboard` | 总览 | `OverviewDashboard` | 风险评分、R4 攻击链缩略图、关键证据 |
| 02 | `profile` | 安全画像 | `SecurityProfileGraph` | Agent 能力边界确认图 (SVG 可视化) |
| 03 | `anatomy` | 攻击图谱 | `AnatomyGraph` | 五阶段攻击链图 (DrawSVG)、路径检查器 |
| 04 | `run` | 测评运行 | `EvaluationRunWorkspace` | TC选择 + 三阶段执行 + 实时SSE终端 |
| 05 | `report` | 测评报告 | `EvaluationReportWorkspace` | 评分面板、风险发现、证据链追踪 |
| 06 | `agent` | 初始接口 | `AgentInterfaceWorkspace` | Agent 配置清单加载/编辑/保存 |
| 07 | `setting` | 设置 | `AccountSettingsWorkspace` | 头像裁剪、密码修改、退出 |

#### 2.3 BFF API 层 (`app/api/`) — 16 条路由

**Agent Eval 域 (→ `AGENT_EVAL_BACKEND_URL`)**

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/agents` | 注册 Agent 配置清单 |
| GET | `/api/agents/:agentId` | 获取 Agent 档案 |
| GET | `/api/agents/:agentId/graph` | 获取攻击图谱 |
| POST | `/api/evaluations` | 创建测评运行 |
| GET | `/api/evaluations/:id` | 获取运行状态 |
| POST | `/api/evaluations/:id/start` | 启动测评执行 |
| GET | `/api/evaluations/:id/events` | **SSE 事件流** (支持 Last-Event-ID 断点续传) |
| GET | `/api/evaluations/:id/report` | 获取测评报告 |
| GET | `/api/evaluations/:id/trace` | 获取执行追踪 |
| GET | `/api/test-cases` | 获取测试用例目录 |

**Account Auth 域 (→ `MIA_RAG_AUTH_URL`)**

| 方法 | 路由 | 说明 |
|------|------|------|
| GET/PATCH | `/api/account/me` | 用户资料 |
| POST | `/api/account/logout` | 退出登录 |
| POST | `/api/account/password` | 修改密码 |
| POST/DELETE | `/api/account/avatar` | 头像上传/删除 |

#### 2.4 UI 与设计系统特征

| 特征 | 说明 |
|------|------|
| 零组件库 | 不使用 shadcn/MUI/AntD，全部从零构建 |
| SVG 装饰层 | 分隔线、品牌字、过渡矩形均由 SVG 渲染 |
| GSAP 动画 | 登录光带、滚动展开、Agent 加载、工作区切换、侧边栏邻近感知 |
| DrawSVG | 攻击路径逐步绘制动画 |
| Three.js | 光束背景特效 |
| 中文优先 | 界面中文 + 英文副标题，HTML lang=zh-CN |

---

### 三、共享资源 (`shared/`)

#### 3.1 契约 (`shared/contracts/`) — 全项目唯一事实来源

| 文件 | 说明 |
|------|------|
| `SECURITY_CONTRACTS.md` | **法律文档**: RiskPattern/AttackSeed/TestCase 三契约定义 |
| `test_case.schema.json` | TestCase JSON Schema (最复杂) |
| `risk_pattern.schema.json` | RiskPattern JSON Schema |
| `attack_seed.schema.json` | AttackSeed JSON Schema |
| `evaluation_*.schema.json` | EvaluationRun/Report Schema |
| `execution_event.schema.json` | 执行事件 Schema |
| `risk_finding.schema.json` | 风险发现 Schema |

#### 3.2 测试用例 (`shared/examples/security/`) — 98 条, 4 大风险模式

| 文件 | 条数 | 风险模式 |
|------|------|---------|
| `security_testcases.json` | 6 | 基础: PI/IPI/越权/隐私 |
| `security_testcases_r1.json` | ~10 | R1: 间接提示注入 (IPI) |
| `security_testcases_r2.json` | ~8 | R2: 记忆投毒 |
| `security_testcases_r3.json` | ~7 | R3: 隐私泄露 |
| `security_testcases_r4.json` | ~10 | R4: 持久化 IPI (5节点链) |
| `security_testcases_confirm_bypass.json` | ~4 | 确认绕过 |
| `security_testcases_defense.json` | ~8 | 防御检测 |
| `security_testcases_defense_extra.json` | ~8 | 防御增强 |
| `security_testcases_hard.json` | 12 | 高难度对抗 |
| `security_testcases_mutated.json` | ~41 | 变异引擎生成 |

#### 3.3 攻击资产 (`shared/examples/security/`)

| 文件 | 说明 |
|------|------|
| `risk_patterns.json` | 4 个风险模式定义 (R1-R4) |
| `attack_seeds.json` | 9 个攻击种子 (含载荷模板) |
| `mutation_seeds.json` | 10 个变异种子 (模板+邮箱池) |
| `mutation_templates.json` | 8 种投递模板 (权威框架/隐藏HTML/白字等) |
| `mutation_engine.py` | 变异引擎: seeds × templates → 变异 TC |

#### 3.4 Mock 数据 (`shared/fixtures/`)

| 文件 | 说明 |
|------|------|
| `attack_graph.json` | 示例攻击图 |
| `agent_profile.json` | 示例 Agent 画像 |
| `evaluation_report.json` | 示例评估报告 |
| `browser_pages.json` | 浏览器页面 fixture |

---

### 四、项目文档 (`docs/`)

| 文件 | 说明 |
|------|------|
| `security-model.md` | 安全语义定义: 5种标签 (UNTRUSTED/SENSITIVE/DANGEROUS/PERSISTENT/TRUSTED) |
| `stage2_plan.md` | Stage 2 总体规划 |
| `stage2_plan_for_*.md` (3个) | 各成员 Stage 2 任务分配 |
| `stage2_change_orders_*.md` (2个) | 变更单 |
| `stage2_security_input_draft.md` | 安全测试方向草案 |
| `stage2_rule_judge_definitions.md` | 规则Judge定义 |
| `m2_demo_script.md` | M2 里程碑演示脚本 |
| `superpowers/plans/` | Stage 1 后端脚手架详细计划 |
| `superpowers/specs/` | Stage 1 后端设计规格 |

---

### 五、根目录文件

| 文件 | 说明 |
|------|------|
| `CODING_AGENT_RULE.md` | **契约治理法律**: 命名冻结、变更流程、AI Agent 检查清单 |
| `stage1_goal.md` | Stage 1 三人协同计划 (D1-D7) |
| `baseline_98_report.md` | 98 TC 三Agent对比基线报告 |
| `redteam_report.md` | 自适应红队报告 |
| `一键启动.bat` | Windows 一键启动脚本 (后端+前端) |
| `sr3_verify.py` | SR3 验收脚本 |

---

## 风险模式说明

| 模式 | ID | 描述 | 严重度 |
|------|-----|------|--------|
| 间接提示注入 | R1 | 恶意网页/邮件中嵌入隐藏指令，Agent 浏览后执行 | HIGH |
| 记忆投毒 | R2 | 攻击者将恶意指令写入 Agent 持久记忆，未来被检索执行 | HIGH |
| 隐私泄露 | R3 | Agent 将敏感数据（邮件内容/记忆）发送到外部 | HIGH |
| 持久化 IPI | R4 | 完整5节点链: 网页→Agent→记忆→Agent→邮件 (跨会话延迟攻击) | CRITICAL |

## 关键数据指标

| 指标 | 数值 |
|------|------|
| 后端代码 | ~8,000 行 (17 模块) |
| 前端代码 | Next.js App + 组件 |
| 测试代码 | ~6,000 行 (37 文件) |
| 测试用例 | 346 个 (全部通过) |
| 安全 TC | 98 条 (4 大风险模式) |
| 防御层 | 8 层 (D1-D8) |
| Agent | 3 个 (CorpMate / Bare LLM / Defended LLM) |
| 评估得分 | Defended LLM: 100% PASS (98/98) |
