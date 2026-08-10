# Stage 2 总体计划 — 给组长审阅版

> 编制日期: 2026-08-10
> 定位: 供组长 (陈书扬) 审阅确认的总体方案，确认后分发三条线

---

## 0. 一句话定位

> **从"骨架能看"到"真正能跑安全测试"——实现多轮执行、批量 TestCase、R1-R4 端到端验证，产出可用测评报告。**

---

## 1. 核心目标与 M2 验收标准

### 1.1 Stage 2 核心目标

| #   | 目标                | 衡量标准                                                |
| --- | ----------------- | --------------------------------------------------- |
| G1  | Multi-turn 多轮攻击执行 | 至少 1 条 3-turn TestCase 端到端跑通                        |
| G2  | 标准安全测试集           | P0 14-20 条 + P1 14-22 条 (含现有 6 条)                   |
| G3  | 完整 Judge 链路       | Rule Judge 4 规则 + Composite Judge (rule + LLM mock) |
| G4  | 批量执行 + 报告         | ≥10 条 TestCase 一键执行 → 结构化报告                         |
| G5  | 前端可视化             | 多 TestCase 选择、运行过程、报告详情                             |

### 1.2 M2 验收标准 (D14 必须全部通过)

| #   | 验收项                                                        | 对应 plan V0.1 |
| --- | ---------------------------------------------------------- | ------------ |
| ①   | CorpMate 接入 → 攻击图谱生成 → ≥10 条 TestCase 自动执行                 | M2 核心        |
| ②   | 多轮 TestCase (≥3 turn) 成功执行，状态在 turn 间累积                    | 新增           |
| ③   | 环境重置: 每条 TestCase 执行前 Sandbox 干净初始化                        | M2 要求        |
| ④   | Trace 正确记录并持久化 (SQLite)                                    | M2 要求        |
| ⑤   | Rule Judge 4 条规则 + Composite Judge 产出 PASS/FAIL + Evidence | M2 要求        |
| ⑥   | 前端: 选择 TestCase → 运行 → 查看报告 (全流程)                          | M2 要求        |
| ⑦   | 结构化报告: 按 RiskPattern/risk_type/severity 汇总                 | 新增           |
| ⑧   | pytest 全部通过 (≥190 基线 + Stage 2 新增)                         | 质量底线         |

---

## 2. 已锁定的技术决策

| #   | 决策项               | 结论                                  | 影响范围             |
| --- | ----------------- | ----------------------------------- | ---------------- |
| D1  | Multi-turn schema | `scenario.turns` + `ScenarioTurn.env_delta` (基于现有 Scenario 机制增强) | 契约 + Runner + 前端 |
| D2  | Mutation Engine   | JSON 模板 (声明式 seed + rules)          | 后端 API + 前端配置    |
| D3  | LLM Judge         | Mock 优先 + 外部 API 接口预留               | Judge 模块         |
| D4  | RiskPattern 扩展    | **暂不新增**，聚焦 R1-R4                   | Security Line    |

> ⚠️ D1 (ScenarioTurn+env_delta schema) 需要走**三人变更流程**后才能写入契约。

---

## 3. Day 0 前置任务 — Stage 1 遗留清理

**时间**: D8 上午 (半天)
**负责人**: 组长主导，三人参与

| #   | 遗留问题                              | 处理方式                                               | 产出                              |
| --- | --------------------------------- | -------------------------------------------------- | ------------------------------- |
| L1  | AgentManifest tools 字段: 数组→字典     | 正式变更单，三人签字                                         | 更新 SECURITY_CONTRACTS.md + 相关代码 |
| L2  | `risk_path_ids` 语义模糊              | 改名为 `matched_pattern_ids` (或添加文档注释)                | 变更单 + 代码更新                      |
| L3  | TestCase pytest CollectionWarning | conftest.py 添加 `__test__ = False` 或 collect_ignore | 消除 warning                      |
| L4  | TestCase 多轮增强                     | `input` 改 Optional + `ScenarioTurn` 新增 `env_delta` | 契约变更单 + Pydantic 模型             |

**Day 0 产出物**: 

- [ ] 变更单 (L1-L4) 三人签字
- [ ] `shared/contracts/SECURITY_CONTRACTS.md` 更新
- [ ] Pydantic domain model 更新 (TestCase.input 改 Optional + ScenarioTurn.env_delta)
- [ ] 前端 OpenAPI types 重新生成
- [ ] log.md 标记遗留问题已解决

---

## 4. 三条线任务分解 (D8-D14)

### 4.1 Security Line (陈书扬) — TestCase 生产 + Judge 规则

| 日   | 任务                                   | 产出                                  | 依赖                    |
| --- | ------------------------------------ | ----------------------------------- | --------------------- |
| D8  | **Day 0 变更单** + ScenarioTurn+env_delta schema | 契约变更、TestCase schema 定稿             | —                     |
| D9  | R4 旗舰 TestCase 编写 (4-6 条)            | `security_testcases_r4.json`        | ScenarioTurn schema   |
| D10 | R1 IPI Web TestCase 编写 (6-8 条)       | `security_testcases_r1.json`        | browser_pages fixture |
| D11 | 多轮攻击 TestCase (4-6 条)                | `security_testcases_multiturn.json` | ScenarioTurn schema   |
| D12 | P1 TestCase: R2 记忆投毒 + 确认绕过 (8-12 条) | `security_testcases_p1.json`        | —                     |
| D13 | Rule Judge 规则完善 (4 条规则) + Judge 校准   | 4 条规则测试通过                           | Runner 可用             |
| D14 | **TestCase 全集串跑验收**                  | ≥28 条 TestCase 端到端通过                | 全链路                   |

**Security Line 关键产出:**

- ScenarioTurn + env_delta: `ScenarioTurn { turn_id, input, starts_new_session, env_delta?: { browser_pages?, memory?, email_inbox? } }` (基于现有 schema 增强)
- 4 条 Rule Judge 规则: `forbidden_tool_call`, `confirmation_missing`, `sensitive_data_exposure`, `required_behavior_missing`
- ≥28 条 TestCase (P0: 14-20, P1: 14-22)

---

### 4.2 Platform Line (步嘉城) — Runner + Judge + 持久化

| 日   | 任务                                    | 产出                                     | 依赖                |
| --- | ------------------------------------- | -------------------------------------- | ----------------- |
| D8  | **Day 0 代码适配** + Multi-turn Runner 核心 | TestCase schema 适配, Runner 支持 turn 循环  | ScenarioTurn schema |
| D9  | Multi-turn Runner 完善: 状态累积 + 环境重置     | Runner 支持 N-turn + Sandbox 每轮 reset    | CompositeSandbox  |
| D10 | 解除 tc_pipi_001 硬编码, 支持多 TestCase      | `test_case_ids` 接受任意列表                 | —                 |
| D11 | Composite Judge: Rule + LLM Mock 编排   | `judge_strategy` 字段, CompositeJudge 模块 | Rule Judge 规则     |
| D12 | 批量执行: EvaluationRunner batch 模式       | POST /evaluations 支持批量 + 进度 SSE        | Multi-turn Runner |
| D13 | 结果统计 API + 报告增强                       | `/evaluations/{id}/report` 按维度汇总       | 批量执行              |
| D14 | **后端全链路串跑 + bug 修复**                  | 190+ 测试全绿, API 稳定                      | 全链路               |

**Platform Line 关键产出:**

- Multi-turn Runner: 循环 N 次 invoke, 每轮收集 Trace, 状态跨 turn 累积
- 环境重置: `CompositeSandbox.reset()` 在每条 TestCase 前调用
- Composite Judge: `rule_first → llm_mock_fallback → aggregate`
- 批量 API: `POST /evaluations` 接受 `test_case_ids: list[str]`
- 统计端点: 报告包含 `summary: { by_risk_pattern, by_risk_type, by_severity, pass_rate }`

---

### 4.3 Frontend Line (胡继天) — 测评 UI + 数据可视化

| 日   | 任务                                    | 产出                              | 依赖         |
| --- | ------------------------------------- | ------------------------------- | ---------- |
| D8  | **Day 0 类型适配** + TestCase 选择器 UI      | OpenAPI types 更新, TestCase 列表组件 | OpenAPI 更新 |
| D9  | 多轮对话展示组件                              | turn-by-turn 对话流可视化             | SSE 多轮事件   |
| D10 | Evaluation Run 页面增强: 多 TestCase 进度    | 批量进度条 + 每条状态指示                  | 批量 SSE     |
| D11 | Report 页面增强: 多维度统计图表                  | 按 RiskPattern/severity 的柱状/饼图   | 统计 API     |
| D12 | Overview Dashboard 从 fixture 切到真实 API | 真实数据驱动总览                        | 后端 API     |
| D13 | UI 联调 + 交互打磨                          | 全流程顺畅                           | 全链路        |
| D14 | **前端全链路串跑 + bug 修复**                  | 前端无阻塞                           | 全链路        |

**Frontend Line 关键产出:**

- TestCase 选择器: 从后端拉取列表，多选创建 Evaluation
- 多轮对话 UI: 展示每轮 input/output/tool_calls, 支持 env_delta 标注
- 批量进度: 多条 TestCase 的进度状态 (pending/running/passed/failed)
- 统计 Dashboard: 按维度的通过率、severity 分布、RiskPattern 覆盖率

---

## 5. 关键依赖链 (Critical Path)

```
Day 0: 契约变更单 (三人) ← 所有人 D8 上午必须完成
         │
         ├──→ Security: ScenarioTurn+env_delta schema 定稿
         │         │
         │         └──→ Security: TestCase 编写 (D9-D13)
         │
         ├──→ Platform: Multi-turn Runner (D8-D9) ← 关键路径!
         │         │
         │         ├──→ Platform: 解除硬编码 (D10)
         │         │         │
         │         │         └──→ Platform: 批量执行 (D12)
         │         │                   │
         │         │                   └──→ Platform: 统计 API (D13)
         │         │
         │         └──→ Platform: Composite Judge (D11)
         │                   ↑
         │                   └── Security: Rule Judge 规则 (D13)
         │
         └──→ Frontend: 类型适配 + TestCase 选择器 (D8)
                   │
                   └──→ Frontend: 多轮 UI → 批量 UI → 统计 UI (D9-D12)
```

**⚡ 关键路径**: Day 0 变更 → Platform Multi-turn Runner (D8-D9) → 解除硬编码 (D10) → 批量执行 (D12) → 统计 (D13) → D14 串跑

**🟢 可并行:**

- Security TestCase 编写 ∥ Platform Runner 开发 ∥ Frontend UI (D8-D12)
- Rule Judge 规则 ∥ Composite Judge 框架 (D11-D12)
- Frontend 组件开发可以用 mock 数据先行，不阻塞后端

---

## 6. TestCase 生产计划 (6 → 28-42 条)

| 阶段     | 日期      | TestCase 类型             | 数量  | 累计    | 优先级    |
| ------ | ------- | ----------------------- | --- | ----- | ------ |
| 现有     | Stage 1 | PI/Unauthorized/Privacy | 6   | 6     | —      |
| Wave 1 | D9      | R4 持久化 IPI 端到端          | 4-6 | 10-12 | **P0** |
| Wave 2 | D10     | R1 IPI Web 注入           | 6-8 | 16-20 | **P0** |
| Wave 3 | D11     | 多轮攻击                    | 4-6 | 20-26 | **P0** |
| Wave 4 | D12     | R2 记忆投毒                 | 4-6 | 24-32 | P1     |
| Wave 5 | D12     | 确认绕过 + 工具链              | 4-6 | 28-38 | P1     |
| Wave 6 | D13     | 防御验证                    | 6-8 | 34-46 | P1     |

**保底目标**: 28 条 (Wave 1-5 全部完成)
**冲刺目标**: 40+ 条 (Wave 6 也完成)

> 策略: P0 的 Wave 1-3 是硬承诺 (14-20 条新 TestCase)，P1 的 Wave 4-6 是弹性目标。如果 D11 前 P0 进度受阻，砍 P1 保 P0。

---

## 7. 8 项能力升级排期

| #   | 能力                          | 负责人     | 开始日   | 完成日   | 依赖              | 状态       |
| --- | --------------------------- | ------- | ----- | ----- | --------------- | -------- |
| 1   | Multi-turn Runner           | 步嘉城     | D8    | D9    | Day 0 变更        | **关键路径** |
| 2   | TestCase schema (ScenarioTurn+env_delta) | 陈书扬     | D8 AM | D8 PM | 三人变更            | **前置条件** |
| 3   | Mutation Engine (JSON 模板)   | 步嘉城     | D12   | D13   | Runner 稳定       | P1, 可降级  |
| 4   | LLM Judge (Mock)            | 步嘉城     | D11   | D11   | —               | Mock 即可  |
| 5   | Composite Judge             | 步嘉城     | D11   | D12   | Rule + LLM Mock | —        |
| 6   | Severity 细化                 | 陈书扬     | D13   | D13   | Judge 产出        | 可在报告层做   |
| 7   | 批量执行                        | 步嘉城     | D12   | D12   | Runner + 解除硬编码  | —        |
| 8   | 结果统计                        | 步嘉城+陈书扬 | D13   | D13   | 批量结果            | —        |

---

## 8. 每日里程碑 (Daily Standup 检查点)

### D8 — "契约日"

- [ ] 三人变更单签字 (L1-L4)
- [ ] TestCase schema (ScenarioTurn+env_delta) 写入契约 + Pydantic model
- [ ] 前端 OpenAPI types 重新生成
- [ ] Platform: Multi-turn Runner 框架搭起 (能循环, 不求完美)
- [ ] Frontend: TestCase 选择器组件骨架
- [ ] log.md 标记遗留问题已解决

- **日终检查**: `pytest` 全绿 (含 schema 变更后的适配测试)

### D9 — "Runner 日"

- [ ] Multi-turn Runner: 3-turn TestCase 能跑通 (哪怕 TestCase 是手写的)
- [ ] 环境重置: 每条 TestCase 前 Sandbox 干净初始化
- [ ] Security: R4 TestCase 第一版 (4-6 条)
- [ ] Frontend: 多轮对话展示组件骨架

- **日终检查**: 至少 1 条 3-turn R4 TestCase 端到端跑通

### D10 — "解放日"

- [ ] 解除 `tc_pipi_001` 硬编码, 支持任意 TestCase 列表
- [ ] Security: R1 IPI Web TestCase (6-8 条)
- [ ] Frontend: Evaluation Run 多 TestCase 进度展示

- **日终检查**: 能选择不同 TestCase 并分别执行

### D11 — "Judge 日"

- [ ] LLM Judge Mock 实现
- [ ] Composite Judge (Rule + LLM Mock) 编排
- [ ] Security: 多轮攻击 TestCase (4-6 条)
- [ ] Frontend: Report 统计图表骨架

- **日终检查**: TestCase 执行 → Judge 判定 → 返回 PASS/FAIL + Evidence

### D12 — "批量日"

- [ ] 批量执行: POST /evaluations 接受多条 TestCase
- [ ] 批量进度 SSE 事件推送
- [ ] Security: P1 TestCase (R2 + 确认绕过, 8-12 条)
- [ ] Mutation Engine v1 (JSON 模板, 最小可用)
- [ ] Frontend: Overview Dashboard 切到真实 API

- **日终检查**: 一键提交 ≥10 条 TestCase, 批量执行完成

### D13 — "统计日"

- [ ] 结果统计 API: by_risk_pattern / by_risk_type / by_severity
- [ ] 报告增强: summary 字段
- [ ] Severity 细化规则
- [ ] Security: Rule Judge 4 条规则全部校准
- [ ] Security: 防御验证 TestCase (6-8 条, 冲刺目标)
- [ ] Frontend: 全 UI 联调

- **日终检查**: 报告包含完整统计数据

### D14 — "串跑日" (M2 验收)

- [ ] 全链路串跑: 接入 → 图谱 → 选 TestCase → 批量执行 → 报告
- [ ] pytest 全绿 (≥190 基线 + 新增)
- [ ] SR 验证脚本通过
- [ ] 前端全流程演示无阻塞
- [ ] log.md 更新 Stage 2 记录

- **日终检查**: **M2 验收通过** 🎉

---

## 9. 风险与降级策略

### 9.1 主要风险

| #   | 风险                       | 概率  | 影响         | 降级方案                                       |
| --- | ------------------------ | --- | ---------- | ------------------------------------------ |
| R1  | Multi-turn Runner 复杂度超预期 | 中   | **阻塞关键路径** | 降级: 先做 2-turn (不追求 N-turn), 用最简状态传递        |
| R2  | Day 0 变更单讨论过久            | 中   | 浪费 D8 半天   | 降级: L1/L2 用注释代替改名, L4 用最简 env_delta        |
| R3  | TestCase 编写速度不够          | 高   | 达不到 28 条   | 降级: P0 保底 14 条, P1 推到 Stage 3              |
| R4  | 前后端集成 bug                | 高   | D14 串跑受阻   | 降级: 前端用 mock fallback, 后端 API 单独验收         |
| R5  | Composite Judge 编排逻辑不清   | 低   | Judge 结果不准 | 降级: 只用 Rule Judge, LLM Mock 返回 always-pass |

### 9.2 砍单优先级 (从先砍到最后砍)

```
🔴 先砍: Mutation Engine (JSON 模板) → 手工写 TestCase 即可
🔴 先砍: 防御验证 TestCase (Wave 6) → 推到 Stage 3
🟡 次砍: Overview Dashboard 切真实 API → 继续用 fixture
🟡 次砍: Severity 细化 → 保持静态 severity
🟢 最后砍: P1 TestCase (Wave 4-5) → 只保 P0
⛔ 不砍: Multi-turn Runner, 批量执行, R4/R1 TestCase, Rule Judge, 前端核心流程
```

---

## 10. 开放问题 (需组长启动前最终确认)

| #   | 问题                                    | 建议                                                                    | 需要确认?  |
| --- | ------------------------------------- | --------------------------------------------------------------------- | ------ |
| Q1  | ScenarioTurn `env_delta` 支持哪些字段?     | `browser_pages`, `memory`, `email_inbox` (与 Sandbox initial_state 对齐) | ✅ 已定 (变更单 L4) |
| Q2  | 现有 TestCase 的 `input: str` 是否保留为向后兼容? | 保留为 Optional, `scenario.turns` 非空时可省略                                   | ✅ 已定 (变更单 L4) |
| Q3  | LLM Mock 的判定策略?                       | 默认返回 `PASS` + 固定 reasoning, 留接口给 Stage 3                              | 建议直接采用 |
| Q4  | 批量执行的并发模型?                            | 串行执行 (Stage 2), 并行留给 Stage 3                                          | 建议直接采用 |
| Q5  | CorpMate 是否需要增加新 tool 支持?             | Stage 2 围绕现有 7 个 tool, 不加新 tool                                       | 建议直接采用 |
| Q6  | 前端是否需要 TestCase 编辑/创建 UI?             | 不需要, TestCase 由 Security Line 用 JSON 文件维护                             | 建议直接采用 |

---

## 11. 文件影响范围预估

### 契约层 (shared/contracts/) — Day 0 统一变更

- `SECURITY_CONTRACTS.md` — TestCase schema: input 改 Optional + ScenarioTurn 新增 env_delta
- `test_case.schema.json` — 对应 JSON Schema 更新

### 后端 (backend/) — D8-D13 持续修改

- `app/domain/models.py` — TestCase, ScenarioTurn, EnvDelta, EvaluationRun 模型
- `app/services/evaluation_coordinator.py` — Multi-turn 执行循环
- `app/services/composite_sandbox.py` — reset() 方法
- `app/services/judge/` — 新建 CompositeJudge, LLMJudge (mock)
- `app/api/routers/evaluations.py` — 批量接口, 统计接口
- `app/services/report_service.py` — 报告增强
- `tests/` — 每条新 TestCase + Runner 测试

### 前端 (apps/main-platform/) — D8-D13 持续修改

- `lib/contracts/backend-api.d.ts` — OpenAPI 重新生成
- `app/api/` — 新增 BFF 路由 (TestCase 列表, 统计)
- `windows/main/evaluation/` — TestCase 选择器, 多轮 UI, 批量进度
- `windows/main/overview/` — 切真实 API
- `app/styles/` — 新增样式

### Security 资产 (shared/examples/security/) — D9-D13 持续新增

- `security_testcases.json` → 拆分为多文件 (r4, r1, multiturn, p1)
- `mutation_templates.json` — Mutation Engine 模板 (新建)

---

*本计划待组长审阅确认后，分发至三条线作为 D8-D14 的执行依据。*