# Stage 2 Day 0 变更单 (L1-L4)

> 起草日期: 2026-08-10
> 起草人: 陈书扬 (Security & Evaluation Owner)
> 状态: **✅ 三人全部签字确认 (2026-08-10)**
> 
> 签字栏:
> - [x] 陈书扬 (Security Line) — 日期: 2026-08-10 (起草人)
> - [x] 步嘉城 (Platform Line) — 日期: 2026-08-10
> - [x] 胡继天 (Frontend Line) — 日期: 2026-08-10

---

# L1: AgentManifest tools 字段 — 正式采纳双字段结构

## 问题

Design V0.2 §4 定义 AgentManifest 使用 `tools` **数组**:

```json
"tools": [
  { "name": "send_email", "permission": "confirm" }
]
```

但实际代码 (`backend/app/domain/agent_manifest.py`) 使用**两个独立字段**:

```python
class AgentManifest(BaseModel):
    capabilities: list[str]                # ["chat", "browser.open_page", ...]
    tool_permissions: dict[str, str]       # {"browser.open_page": "ALLOW", "email.send": "CONFIRM"}
```

Fixture (`shared/fixtures/agent_profile.json`) 也跟随代码结构。`graph_builder.py` 已基于 `capabilities` 做遍历。

三方不对齐: 设计文档说一套，代码和 fixture 做另一套。

## 变更方案

**采纳代码结构，更新设计文档**。即:

```text
① 正式废弃 design V0.2 中的 tools 数组
② AgentManifest 使用 capabilities + tool_permissions 双字段
③ 更新 design V0.2 §4 与代码对齐
④ 更新 SECURITY_CONTRACTS.md 的 AgentManifest 字段表
```

**理由**: 双字段结构 (flat list + dict) 已被所有消费方使用，迭代和查找更方便，改回数组无收益。

**步嘉城反馈 (已确认)**:
- ✅ 兼容期保留 `capabilities` 字段 — **采纳: 不删除 capabilities，两个字段职责不同**
  - `capabilities: list[str]` → 能力清单 (Runner/Graph Builder 遍历用)
  - `tool_permissions: dict[str, str]` → 权限映射 (值域: ALLOW | CONFIRM | DENY)
- 设计文档中明确两者的区别和用途

## 影响文件

| 文件 | 变更 |
|------|------|
| `design V0.2.md` §4 | 更新 AgentManifest 定义，删除 tools 数组，改为 capabilities + tool_permissions |
| `shared/contracts/SECURITY_CONTRACTS.md` | 更新 AgentManifest 字段表 |
| `backend/app/domain/agent_manifest.py` | **无需改动** (已是目标结构) |
| `shared/fixtures/agent_profile.json` | **无需改动** (已对齐) |

## 风险评估

```text
影响面: 小 (只改文档，不改代码)
Breaking Change: 否 (代码不变)
```

---

# L2: risk_path_ids 语义明确 — 添加文档注释

## 问题

`AttackGraph.risk_path_ids` 字段存储的是 **RiskPattern ID** (R1/R2/R3/R4)，但字段名暗示存储的是 AttackPath ID (如 `path-r4-001`)。

当前代码:

```python
# backend/app/domain/attack_graph.py, line 31
risk_path_ids: list[str] = Field(default_factory=list, description="命中的 RiskPattern ID 列表")
```

CODING_AGENT_RULE.md line 149 已明确冻结:

```text
风险模式 ID 列表: risk_path_ids   (存 RiskPattern.id, 字段名不改)
```

## 变更方案

**不改名，加强文档注释**。即:

```text
① 保持字段名 risk_path_ids 不变 (遵守 CODING_AGENT_RULE 冻结)
② 在 Pydantic Field description 中强化说明 (已有)
③ 在 SECURITY_CONTRACTS.md 中添加明确注释
④ 在 JSON Schema 中添加 $comment
```

**步嘉城反馈 (已确认)**:
- ✅ 确认不改名
- 关于 "API JSON 字段名请一并明确" — **API 字段名保持 `risk_path_ids` 不变**，与 Pydantic model 一致。在 OpenAPI schema 的 description 和 $comment 中添加语义说明，确保前端消费时不误解

SECURITY_CONTRACTS.md 新增说明:

```markdown
> ⚠️ `risk_path_ids` 存储的是 **RiskPattern.id** (如 "R1", "R4")，
> 不是 AttackPath.id。字段名中的 "path" 指风险模式路径，非攻击图路径。
> 此字段名已被 CODING_AGENT_RULE 冻结，不可改名。
```

## 影响文件

| 文件 | 变更 |
|------|------|
| `shared/contracts/SECURITY_CONTRACTS.md` | 添加 risk_path_ids 语义注释 |
| `shared/contracts/attack_graph.schema.json` | 添加 $comment |
| `backend/app/domain/attack_graph.py` | **无需改动** (description 已足够) |
| `CODING_AGENT_RULE.md` | **无需改动** (已冻结) |

## 风险评估

```text
影响面: 极小 (只加文档注释)
Breaking Change: 否
```

---

# L3: TestCase pytest CollectionWarning 消除

## 问题

Pydantic `TestCase` 类名以 `Test` 开头，匹配 pytest 默认收集模式 (`python_classes = Test*`)。

pytest 收集时会发出警告:

```text
PytestCollectionWarning: <class 'backend.app.domain.test_case.TestCase'>
has __init__ but no test methods
```

当前无抑制配置:
- `conftest.py` 无 `__test__`、无 `collect_ignore`
- `pytest.ini` 无 `filterwarnings`
- `test_r4_contracts.py` 通过 alias (`import TestCase as DomainTestCase`) 规避

## 变更方案

**双重保险**:

```text
① TestCase Pydantic 类添加 __test__ = False
② pytest.ini 添加 filterwarnings 抑制
```

具体改动:

### test_case.py

```python
class TestCase(BaseModel):
    """一条可独立执行的安全测试."""
    __test__ = False   # Prevent pytest from collecting this class
    # ... 现有字段不变 ...
```

### pytest.ini

```ini
[pytest]
testpaths = tests
pythonpath = .
asyncio_mode = auto
filterwarnings =
    ignore::pytest.PytestCollectionWarning
```

## 影响文件

| 文件 | 变更 |
|------|------|
| `backend/app/domain/test_case.py` | 添加 `__test__ = False` |
| `backend/pytest.ini` | 添加 `filterwarnings` |

## 风险评估

```text
影响面: 极小 (不影响任何功能)
Breaking Change: 否
```

---

# L4: TestCase 多轮机制正式化 — 基于 scenario.turns

## ⚠️ 重要发现

代码中 **已有** 完整的多轮机制 (`Scenario.turns[]`)，不需要新增 `inputs: list[TurnInput]`。

当前状态:

```python
# backend/app/domain/test_scenario.py
class Scenario(BaseModel):
    summary: str
    initial_state: InitialState
    target_agent: str
    turns: list["ScenarioTurn"] = Field(
        default_factory=list,
        description="可选多轮会话；缺失时执行 TestCase 顶层 input",
    )

class ScenarioTurn(BaseModel):
    turn_id: str
    input: str
    starts_new_session: bool
```

已有 fixture (`tc_pipi_001`) 同时使用顶层 `input` + `scenario.turns`。

**但有两个残留问题:**

1. 顶层 `input` 仍为 required，即使 `scenario.turns` 非空 → 多轮 TestCase 必须写冗余 input
2. `ScenarioTurn` 缺少 `env_delta` (每轮环境变更，Stage 2 多轮攻击需要)

## 变更方案

**不新增字段，增强现有机制**:

```text
① 顶层 input 改为 Optional (当 scenario.turns 非空时可省略)
② ScenarioTurn 新增 env_delta 字段 (可选)
③ 更新 SECURITY_CONTRACTS.md 和 JSON Schema
④ Stage 2 计划中的 "TurnInput schema" 对应 ScenarioTurn + env_delta
```

### 具体改动

#### test_case.py

```python
class TestCase(BaseModel):
    input: str | None = Field(
        default=None, min_length=1,
        description="单轮输入 (当 scenario.turns 为空时必填)"
    )
    # ... 其他字段不变 ...

    @model_validator(mode="after")
    def _validate_input_or_turns(self):
        has_input = self.input is not None
        has_turns = self.scenario and self.scenario.turns
        if not has_input and not has_turns:
            raise ValueError("必须提供 input 或 scenario.turns 之一")
        return self
```

#### test_scenario.py

```python
class EnvDelta(BaseModel):
    """单轮环境增量变更."""
    browser_pages: dict[str, str] | None = None
    memory: list[str] | None = None
    email_inbox: list[str] | None = None

class ScenarioTurn(BaseModel):
    turn_id: str
    input: str
    starts_new_session: bool
    env_delta: EnvDelta | None = Field(
        default=None,
        description="本轮环境变更 (可选，不传则保持上一轮状态)"
    )
```

#### test_case.schema.json

```json
{
    "required": ["id", "risk_type", "severity", "scenario", "judge_rules", "expected_outcome"],
    // input 移出 required，改为条件必填
}
```

### Stage 2 计划对应关系

| 原计划概念 | 实际对应 |
|-----------|---------|
| `TurnInput` | → `ScenarioTurn` (已有) |
| `TurnInput.text` | → `ScenarioTurn.input` (已有) |
| `TurnInput.env_delta` | → `ScenarioTurn.env_delta` (新增) |
| `EnvDelta.browser_pages` | → `EnvDelta.browser_pages` (新增) |
| `EnvDelta.memory` | → `EnvDelta.memory` (新增) |
| `EnvDelta.email_inbox` | → `EnvDelta.email_inbox` (新增) |
| `TestCase.inputs` | → `TestCase.scenario.turns` (已有，不改名) |

## 影响文件

| 文件 | 变更 |
|------|------|
| `backend/app/domain/test_case.py` | `input` 改为 Optional + model_validator |
| `backend/app/domain/test_scenario.py` | 新增 `EnvDelta` 类，`ScenarioTurn` 新增 `env_delta` |
| `shared/contracts/test_case.schema.json` | `input` 移出 required，新增 env_delta 定义 |
| `shared/contracts/SECURITY_CONTRACTS.md` | 更新 TestCase 字段表 + ScenarioTurn 说明 |
| `docs/stage2_security_input_draft.md` | 更新 §3 能力升级表 (不再提 inputs: list[str]) |
| `stage2_plan.md` + 三份个人计划 | 术语对齐: TurnInput → ScenarioTurn |
| `shared/examples/security/security_testcases.json` | **无需改动** (现有 fixture 已兼容) |

**步嘉城反馈 (已确认)**:
- ✅ 确认按 P2-0 适配 + 向后兼容，保 190 全绿
- 关于 "inputs 与 scenario.turns 的关系" — **明确如下**:
  - **不新增 `inputs` 字段**。Runner 直接读 `scenario.turns`
  - `TestCase.input` 改为 Optional — 仅用于无 `turns` 时的单轮模式 (向后兼容)
  - `scenario.turns` 非空时，Runner 按 turns 循环执行，每轮应用 `env_delta`
  - 现有 `tc_pipi_001` (同时有 `input` + `turns`) 仍有效，`input` 字段被 turns 覆盖

## 风险评估

```text
影响面: 中 (TestCase schema 变更，但向后兼容)
Breaking Change: 否 (现有 fixture 同时提供 input + turns，仍有效)
注意: Platform Line Runner 需要适配 env_delta 的应用逻辑
```

---

# 签字确认

以上四项变更单经三人审阅确认:

| # | 变更 | 陈书扬 | 步嘉城 | 胡继天 |
|---|------|--------|--------|--------|
| L1 | AgentManifest 双字段结构 | ✅ 2026-08-10 | ✅ 2026-08-10 | ✅ 2026-08-10 |
| L2 | risk_path_ids 文档注释 | ✅ 2026-08-10 | ✅ 2026-08-10 | ✅ 2026-08-10 |
| L3 | TestCase CollectionWarning | ✅ 2026-08-10 | ✅ 2026-08-10 | ✅ 2026-08-10 |
| L4 | ScenarioTurn + env_delta | ✅ 2026-08-10 | ✅ 2026-08-10 | ✅ 2026-08-10 |

**步嘉城签字备注** (2026-08-10):
- L1: 确认保留 capabilities + tool_permissions 双字段
- L2: 确认 API JSON 字段名 risk_path_ids 不变，加文档说明
- L3: 确认
- L4: 确认按 P2-0 适配 + 向后兼容，保 190 全绿。已明确无 inputs 字段，用 scenario.turns

**胡继天签字备注** (2026-08-10):
- L1-L4: 全部确认
- Frontend 后续以 OpenAPI schema 为准，消费 ScenarioTurn.input、ScenarioTurn.env_delta、turn_count 等派生展示字段
- 个人计划 (`stage2_plan_for_胡继天.md`) 里残留的 `inputs` 旧表述需随 L4 一起术语同步
- 可以开始 D8 开发

**签字后各线动作:**

```text
陈书扬 (Security):
  ① 更新 SECURITY_CONTRACTS.md (L1, L2, L4)
  ② 更新 test_case.schema.json (L4)
  ③ 更新 stage2 计划文档术语 (L4)
  ④ 更新 log.md 标记遗留已解决

步嘉城 (Platform):
  ① 更新 test_case.py: input Optional + model_validator (L4)
  ② 新增 EnvDelta 类 + ScenarioTurn.env_delta (L4)
  ③ test_case.py 添加 __test__ = False (L3)
  ④ pytest.ini 添加 filterwarnings (L3)
  ⑤ 确认 190 tests 仍通过

胡继天 (Frontend):
  ① 等后端更新 OpenAPI schema
  ② 重新生成 backend-api.d.ts
  ③ 确认 ScenarioTurn + env_delta 类型正确
```
