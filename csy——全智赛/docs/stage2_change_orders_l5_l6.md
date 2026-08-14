# Stage 2 补充变更单 (L5-L7)

> 起草日期: 2026-08-10
> 起草人: 陈书扬 (Security & Evaluation Owner)
> 触发: 步嘉城 D8 开发反馈 — 发现 Stage 2 计划中遗漏的冻结契约变更
> 状态: **待三人签字确认**

---

# L5: EventType 枚举新增 TEST_COMPLETED + 批量 SSE 字段

## 问题

`backend/app/domain/enums.py` 的 `EventType` 枚举 (§2.1 冻结) 有 `TEST_STARTED` 但**没有** `TEST_COMPLETED`。

当前 EventType:
```python
class EventType(str, Enum):
    RUN_STARTED = "RUN_STARTED"
    TEST_STARTED = "TEST_STARTED"    # ← 有
    TOOL_CALLED = "TOOL_CALLED"
    JUDGE_DECISION = "JUDGE_DECISION"
    # ... 没有 TEST_COMPLETED
```

但 Stage 2 批量执行需要 `TEST_COMPLETED` 事件来标识每条 TestCase 完成 (D12 批量 SSE 联调)。

此外，批量 SSE 事件需要新增 `test_case_id`、`turn_index`、`total_turns` 字段以区分不同 TestCase 和轮次。

## 变更方案

```text
① EventType 枚举新增 TEST_COMPLETED = "TEST_COMPLETED"
② TEST_STARTED 事件 payload 新增: test_case_id, turn_index, total_turns
③ TEST_COMPLETED 事件 payload 新增: test_case_id, verdict, evidence_count
④ 前端 Event State Engine 消费新字段
```

### EventType 枚举变更

```python
class EventType(str, Enum):
    # ... 现有值不变 ...
    TEST_COMPLETED = "TEST_COMPLETED"   # 新增
```

### SSE 事件 payload 变更

```python
# TEST_STARTED (增强)
{
    "event_type": "TEST_STARTED",
    "test_case_id": "tc_r4_e2e_001",    # 新增
    "turn_index": 0,                     # 新增: 当前轮次 (0-based)
    "total_turns": 2,                    # 新增: 总轮数
    ...existing fields...
}

# TEST_COMPLETED (新增)
{
    "event_type": "TEST_COMPLETED",
    "test_case_id": "tc_r4_e2e_001",
    "verdict": "FAIL",                   # PASS | FAIL | ERROR
    "evidence_count": 2,
    "rule_id": "forbidden_tool_call",
    ...
}
```

## 影响文件

| 文件 | 变更 |
|------|------|
| `backend/app/domain/enums.py` | EventType 新增 TEST_COMPLETED |
| `backend/app/services/evaluation_service.py` | 发送 TEST_COMPLETED 事件 + 增强 TEST_STARTED payload |
| `backend/tests/test_domain_enums.py` | 更新 EventType 枚举断言 |
| `shared/contracts/SECURITY_CONTRACTS.md` | 无需改动 (EventType 由 CODING_AGENT_RULE 管辖) |
| `CODING_AGENT_RULE.md` | 更新 §2.1 EventType 列表 |

## 风险评估

```text
影响面: 中 (冻结枚举变更，Breaking Change)
Breaking Change: 是 (新增枚举值)
缓解: 新增值为追加，不修改/删除现有值，向后兼容
```

---

# L6: EvaluationReport 新增 summary 统计字段

## 问题

`EvaluationReport` (冻结契约 #8) 当前结构:

```python
class EvaluationReport(BaseModel):
    report_id: str
    evaluation_id: str
    agent_id: str
    overall_score: int
    severity: str
    findings: list[RiskFinding]
    conclusion: str
    score_breakdown: ScoreBreakdown
    created_at: datetime
```

缺少**批量统计**字段。Stage 2 需要按 RiskPattern / risk_type / severity 汇总统计 (D13 报告)。

## 变更方案

```text
① EvaluationReport 新增 summary 字段 (Optional，向后兼容)
② 新增 ReportSummary Pydantic model
③ D13 由 Security + Platform 联合校准统计数据
```

### 新增 ReportSummary

```python
class ReportSummary(BaseModel):
    """批量执行统计摘要."""
    total_tests: int = Field(default=0)
    passed: int = Field(default=0)
    failed: int = Field(default=0)
    error: int = Field(default=0)
    pass_rate: float = Field(default=0.0, ge=0.0, le=1.0)
    by_risk_pattern: dict[str, dict[str, int]] = Field(default_factory=dict)
    # {"R1": {"total": 6, "passed": 4, "failed": 2}, ...}
    by_risk_type: dict[str, dict[str, int]] = Field(default_factory=dict)
    by_severity: dict[str, dict[str, int]] = Field(default_factory=dict)
```

### EvaluationReport 变更

```python
class EvaluationReport(BaseModel):
    # ... 现有字段不变 ...
    summary: ReportSummary | None = Field(default=None)  # 新增: 批量统计 (可选)
```

**向后兼容**: `summary` 为 Optional，单条 TestCase 执行时可以为 None。

## 影响文件

| 文件 | 变更 |
|------|------|
| `backend/app/domain/evaluation_report.py` | 新增 ReportSummary + summary 字段 |
| `backend/app/services/report_service.py` | 计算 summary 逻辑 |
| `backend/tests/` | 新增 summary 相关测试 |

## 风险评估

```text
影响面: 中 (冻结契约 #8 变更)
Breaking Change: 否 (summary 为 Optional，现有报告仍有效)
校准依赖: D13 Security 校准 Judge 规则后，summary 数据才有意义
```

---

# L7: test_case.schema.json id pattern 放宽

## 问题

当前 schema 中 `id` 的 pattern 为 `^tc_[a-z]+_[0-9]+$`，但实际 TestCase ID 不匹配:

```text
tc_r4_e2e_001       ✗ (多段: r4_e2e)
tc_r1_web_001       ✗ (多段: r1_web)
tc_mut_xxx_yyy_001  ✗ (变异 ID 多段)
tc_pipi_001         ✓
tc_pi_001           ✓
```

同样，`attack_seed_ids` 的 pattern `^seed_[a-z]+_[0-9]+$` 也不匹配 `seed_email_forward` 等。

## 变更方案

```text
① id pattern 改为 ^tc_[a-z0-9_]+$ (允许字母数字下划线任意组合)
② attack_seed_ids pattern 改为 ^seed_[a-z0-9_]+$
```

**已在代码中修改** (本变更单记录 + 追认)。

## 影响文件

| 文件 | 变更 |
|------|------|
| `shared/contracts/test_case.schema.json` | pattern 放宽 (已改) |

## 风险评估

```text
影响面: 小 (仅放宽校验，不影响现有数据)
Breaking Change: 否 (放宽 pattern，现有 ID 仍匹配)
```

---

# 附: 步嘉城反馈的其他问题 (非变更单)

## sqlite_store.list_events 上限 100

```text
问题: sqlite_store.list_events 硬编码 LIMIT 100，
      10+ 条多轮 TestCase 时 trace 事件可能超过 100 条被截断。
处理: Platform Line 任务，D12 前修改。
建议: 改为 LIMIT 1000 或支持分页。
Security 不阻塞此项，步嘉城可直接改。
```

## CompositeJudge 依赖 Security judge rules

```text
问题: CompositeJudge (Rule + LLM Mock) 的 LLM Mock 语义依赖 Security 的 judge 规则。
处理: Security Line D8 已产出 Rule Judge 4 条规则定义:
      docs/stage2_rule_judge_definitions.md
      Platform Line D11 可直接消费此文档实现 CompositeJudge。
LLM Mock 行为: 返回 PASS + confidence=0.0，不影响 Rule 判定。
```

---

# 签字确认

| # | 变更 | 陈书扬 | 步嘉城 | 胡继天 |
|---|------|--------|--------|--------|
| L5 | EventType 新增 TEST_COMPLETED | ✅ 2026-08-10 | □ | □ |
| L6 | EvaluationReport.summary | ✅ 2026-08-10 | □ | □ |
| L7 | id pattern 放宽 (已改) | ✅ 2026-08-10 | □ | □ |

**陈书扬备注**:
- L5: 确认 EventType 新增 TEST_COMPLETED，不影响现有事件
- L6: summary 为 Optional，不破坏现有 EvaluationReport。D13 校准后定稿
- L7: 已在代码中修改，变更单追认

**签字后各线动作**:

```text
步嘉城 (Platform):
  ① enums.py 新增 TEST_COMPLETED (L5)
  ② evaluation_service.py 发送 TEST_COMPLETED + 增强 TEST_STARTED payload (L5)
  ③ evaluation_report.py 新增 ReportSummary + summary 字段 (L6, D13)
  ④ sqlite_store.list_events 上限调整 (非变更单，D12 前)
  ⑤ 更新 test_domain_enums.py 测试 (L5)

胡继天 (Frontend):
  ① 等 OpenAPI schema 更新后重新生成 types
  ② Event State Engine 消费 TEST_COMPLETED + test_case_id 字段 (L5, D12)
  ③ Report 页面消费 summary 字段 (L6, D13)
```
