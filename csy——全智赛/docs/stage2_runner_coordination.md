# Security → Platform: Runner 联调简报 (D8)

> 编制日期: 2026-08-10
> 状态: Security Line D8 产出，供 Platform Line 适配

---

## 1. 变更单 L4 已生效

三人签字确认，契约已更新为 v1.1：

```text
SECURITY_CONTRACTS.md v1.1 §9.3 — TestCase 多轮机制
test_case.schema.json v1.1     — input Optional, scenario.turns + env_delta
```

## 2. Runner 需要的改动 (Platform Line)

### 2.1 Pydantic domain model 更新

**`backend/app/domain/test_case.py`**:
```python
class TestCase(BaseModel):
    __test__ = False                          # L3
    input: str | None = Field(default=None)   # L4: Optional
    # ... 其他字段不变 ...

    @model_validator(mode="after")
    def _validate_input_or_turns(self):
        has_input = self.input is not None
        has_turns = self.scenario and self.scenario.turns
        if not has_input and not has_turns:
            raise ValueError("必须提供 input 或 scenario.turns 之一")
        return self
```

**`backend/app/domain/test_scenario.py`**:
```python
class EnvDelta(BaseModel):
    browser_pages: dict[str, str] | None = None
    memory: list[str] | None = None
    email_inbox: list[str] | None = None

class ScenarioTurn(BaseModel):
    turn_id: str
    input: str
    starts_new_session: bool
    env_delta: EnvDelta | None = None    # L4 新增
```

### 2.2 Runner 执行循环伪代码

```python
async def run_test_case(test_case: TestCase, sandbox: CompositeSandbox):
    # 解析 turns
    if test_case.scenario and test_case.scenario.turns:
        turns = test_case.scenario.turns
    elif test_case.input:
        turns = [ScenarioTurn(turn_id="single", input=test_case.input, starts_new_session=True)]
    else:
        raise ValueError("no input or turns")

    trace = ExecutionTrace()

    for turn in turns:
        # 应用 env_delta (增量合并, 不替换)
        if turn.env_delta:
            sandbox.apply_delta(turn.env_delta)

        # invoke agent
        result = await adapter.invoke(turn.input)
        trace.add_turn_events(turn.turn_id, result.events)

        # Memory 跨 turn 持久化 (不 reset)

    return trace
```

### 2.3 Sandbox.apply_delta() 伪代码

```python
def apply_delta(self, delta: EnvDelta):
    if delta.browser_pages:
        # 增量: 新增/覆盖页面, 不删除已有页面
        self.browser_sandbox.pages.update(delta.browser_pages)
    if delta.memory:
        # 增量: 追加记忆条目
        self.memory_sandbox.entries.extend(delta.memory)
    if delta.email_inbox:
        # 增量: 追加邮件
        self.email_sandbox.inbox.extend(delta.email_inbox)
```

### 2.4 环境重置时机

```text
每条 TestCase 之间:  sandbox.reset()  ← 全清空
每个 turn 之间:      不 reset          ← Memory/Browser/Email 跨 turn 持久化
env_delta 时:       apply_delta()     ← 增量合并
```

## 3. 已有 TestCase 清单 (17 条)

| 文件 | 条数 | 类型 | turns |
|------|------|------|-------|
| security_testcases.json | 7 | PI/IPI/Unauth/Privacy/PersistentIPI | 0-2 |
| security_testcases_r4.json | 4 | Persistent IPI (旗舰) | 2-3 |
| security_testcases_r1.json | 6 | IPI Web | 1-2 |

### 关键 TestCase 用于联调验证:

```text
tc_r4_e2e_001  → 2 turn, env_delta.browser_pages, R4 旗舰
tc_r4_e2e_004  → 3 turn, 2x env_delta, 渐进攻击
tc_r1_web_001  → 1 turn, env_delta.browser_pages, 最简 R1
tc_pipi_001    → 已有 fixture, 向后兼容验证
```

## 4. D9 联调目标

```text
① Pydantic model 更新完成 (EnvDelta + ScenarioTurn.env_delta + input Optional)
② Runner 能循环 N turns
③ env_delta 正确应用到 Sandbox
④ 190 现有测试全绿 (向后兼容)
⑤ 联合跑通 tc_r4_e2e_001 (2 turn, env_delta)
```

## 5. 向后兼容检查点

```text
✓ tc_pipi_001 (有 input + turns) → Runner 优先使用 turns, 忽略 input
✓ tc_pi_001 (只有 input, 无 turns) → 包装为单轮 turn
✓ 所有 7 条现有 TestCase → 仍有效
```
