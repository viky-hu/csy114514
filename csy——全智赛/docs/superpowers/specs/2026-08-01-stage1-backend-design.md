# Stage 1 Backend Scaffold Design (P0-1 ~ P0-4)

> **作者:** 步嘉城 (Agent & Platform Owner)
> **日期:** 2026-08-01
> **依据:** `CODING_AGENT_RULE(1).md` + `stage1_goal.md` + `shared/contracts/SECURITY_CONTRACTS.md`

---

## 1. 目标

D2 晚 SR0 串跑前，交付：
- 可启动的 FastAPI 后端
- 14 个 Pydantic Domain Model（逐字段对齐 contracts）
- 6 个 Mock API（返回 fixture）
- Contract test（序列化 round-trip + 枚举校验 + fixture 校验）

---

## 2. 目录结构

```
csy——全智赛/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app, CORS, exception handlers
│   │   ├── config.py               # Settings from .env
│   │   ├── domain/
│   │   │   ├── __init__.py         # 导出所有模型 + 枚举
│   │   │   ├── enums.py            # 8 组全局冻结枚举
│   │   │   ├── agent_manifest.py
│   │   │   ├── agent_profile.py
│   │   │   ├── attack_graph.py     # 含 Edge 结构
│   │   │   ├── attack_path.py
│   │   │   ├── test_case.py
│   │   │   ├── test_scenario.py
│   │   │   ├── execution_event.py
│   │   │   ├── execution_trace.py
│   │   │   ├── judge_result.py
│   │   │   ├── risk_finding.py
│   │   │   ├── risk_pattern.py
│   │   │   ├── attack_seed.py
│   │   │   ├── evaluation_run.py
│   │   │   └── evaluation_report.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── health.py
│   │   │   ├── agents.py
│   │   │   └── evaluations.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── agent_service.py    # Mock: 读 fixture
│   │   │   └── evaluation_service.py
│   │   └── exception_handlers.py   # 统一错误响应格式
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_health.py
│   │   ├── test_agents_api.py
│   │   ├── test_evaluations_api.py
│   │   ├── test_domain_schema.py   # round-trip + 枚举校验
│   │   └── test_fixtures.py        # fixture 对 schema 校验
│   ├── requirements.txt
│   └── .env.example
├── shared/
│   ├── contracts/                  # 修正: 从 shared/shared/ 提升到 shared/
│   │   ├── SECURITY_CONTRACTS.md
│   │   ├── risk_pattern.schema.json
│   │   ├── attack_seed.schema.json
│   │   └── test_case.schema.json
│   ├── fixtures/                   # P0-1 产出: 至少 3 个 fixture JSON
│   │   ├── agent_profile.json
│   │   ├── attack_graph.json
│   │   └── evaluation_report.json
│   └── examples/security/          # 陈书扬 D2 交付
├── reference-agent/
├── frontend/
├── tests/                          # 跨模块集成测试 (D4+)
├── docs/
├── README.md
└── .env.example
```

---

## 3. Domain Models 完整清单 (14 个)

| # | Pydantic Model | 来源 | 关键字段 |
|---|---------------|------|---------|
| 1 | AgentManifest | 冻结契约 #1 | capabilities, data_sources, memory, tool_permissions |
| 2 | AgentProfile | 冻结契约 #2 | manifest + anatomy 产物 (能力画像+安全资产标注) |
| 3 | AttackGraph | 冻结契约 #3 | nodes[] + edges[] |
| 4 | AttackPath | 冻结契约 #4 | 一条命中的风险路径 |
| 5 | TestCase | 冻结契约 #5 + SEC_CONTRACTS §4 | scenario, input, forbidden_actions, judge_policy, success_criteria |
| 6 | TestScenario | design V0.2 §3 | TestCase.scenario 的子结构 |
| 7 | ExecutionEvent | 冻结契约 #6 | event_id, run_id, timestamp, type, payload |
| 8 | ExecutionTrace | design V0.2 §3 | events[] |
| 9 | JudgeResult | design V0.2 §3 | verdict, violation, evidence |
| 10 | RiskFinding | 冻结契约 #7 | 含 Evidence |
| 11 | RiskPattern | SEC_CONTRACTS §2 | id(R1-R4), risk_type, node_pattern, label_requirements, judge_rules |
| 12 | AttackSeed | SEC_CONTRACTS §3 | risk_pattern_id, attack_type, payload |
| 13 | EvaluationRun | design V0.2 §3 | |
| 14 | EvaluationReport | 冻结契约 #8 | score + findings + 结论 |

### 3.1 内置结构

- **Edge**: `source_node_id`, `target_node_id`, `edge_type` — AttackGraph 的边
- **GraphNode**: `node_id`, `node_type`, `labels[]`, `metadata` — AttackGraph 的节点

---

## 4. 全局冻结枚举 (8 组)

全部定义在 `backend/app/domain/enums.py`：

```python
class RiskType(str, Enum):        # §2.1
class Severity(str, Enum):        # §2.1
class Permission(str, Enum):      # §2.1
class NodeType(str, Enum):        # §2.1
class NodeLabel(str, Enum):       # §2.1
class EdgeType(str, Enum):        # §2.1
class EventType(str, Enum):       # §2.1
class JudgeStrategy(str, Enum):   # SEC_CONTRACTS §1.5
```

Security Line 内部枚举 (`attack_type`, `delivery_method`) 也定义但标注为内部使用。

---

## 5. Mock API 详细设计

### 5.1 端点

| 端点 | 方法 | 请求体 | 响应 | Fixture |
|------|------|--------|------|--------|
| `/health` | GET | - | `{"status":"ok","version":"0.1.0"}` | 无 |
| `/agents` | POST | AgentManifest | AgentProfile (201) | agent_profile.json |
| `/agents/{id}` | GET | - | AgentProfile (200) | agent_profile.json |
| `/agents/{id}/graph` | GET | - | AttackGraph (200) | attack_graph.json |
| `/evaluations` | POST | agent_id | EvaluationReport (201) | evaluation_report.json |
| `/evaluations/{id}` | GET | - | EvaluationReport (200) | evaluation_report.json |
| `/evaluations/{id}/report` | GET | - | EvaluationReport (200) | evaluation_report.json |

### 5.2 行为

- `POST /agents`: 校验请求体符合 AgentManifest schema，返回 fixture 中的 AgentProfile（附上请求中的 manifest 内容）
- `GET /agents/{id}`: 直接返回 fixture
- `GET /agents/{id}/graph`: 返回 fixture 中的 AttackGraph
- `POST /evaluations`: 返回 fixture EvaluationReport
- 不存在的 id 返回 404

### 5.3 错误响应格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "...",
    "details": []
  }
}
```

---

## 6. Fixtures 内容约定

### agent_profile.json
基于 CorpMate v0 工具清单 (SEC_CONTRACTS §5):
- capabilities: chat + 6 tools
- data_sources: browser, email, memory
- memory: persistent
- tool_permissions: email.send=CONFIRM, 其余=ALLOW

### attack_graph.json
CorpMate 的完整攻击面:
- 5 类节点: SOURCE(browser), AGENT(corpmate), TOOL(email.read/email.send), MEMORY, DATA
- 边含 READ_FROM, WRITE_TO, CALL
- 预置 risk_path_ids 标注 R4 路径: SOURCE→AGENT→MEMORY→AGENT→TOOL

### evaluation_report.json
一份模拟测评报告: score + findings + 结论

---

## 7. 技术选型

| 项 | 选择 | 版本 |
|----|------|------|
| Python | 3.11+ | |
| Web 框架 | FastAPI | latest |
| 数据校验 | Pydantic v2 | latest |
| 测试 | pytest + httpx | latest |
| Lint | ruff | latest |
| 配置 | pydantic-settings | latest |
| CORS | fastapi.middleware.cors | 内置 |

---

## 8. 测试策略

### test_domain_schema.py — Contract Test
- 每个 Pydantic 模型: JSON→Model→JSON round-trip
- 枚举值全覆盖: 每个枚举类至少一条正向+负向测试
- 必填字段缺失→ValidationError

### test_fixtures.py — Fixture Gate
- `agent_profile.json` 可通过 AgentProfile.model_validate()
- `attack_graph.json` 可通过 AttackGraph.model_validate()
- `evaluation_report.json` 可通过 EvaluationReport.model_validate()
- 新增/修改 fixture 后 pytest 自动守门

### test_health.py / test_agents_api.py / test_evaluations_api.py
- API 端点测试 (TestClient + httpx)

---

## 9. 前置修正

- [x] 修正 `shared/shared/` → `shared/` (解压产物)
- [x] 补全 14 个 Domain Model (不漏 RiskPattern/AttackSeed/TestScenario/EvaluationRun)
- [x] Edge 结构独立建模
- [x] 8 组枚举全部冻结
- [x] POST 请求体验证
- [x] FastAPI 自动生成 OpenAPI (Pydantic model_config 配置)
- [x] CORS 中间件
- [x] 统一异常处理格式
- [x] fixture 自动校验 (test_fixtures.py)
