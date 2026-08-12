"""TestScenario — design V0.2 §3 Domain Model: 测试场景."""
from pydantic import BaseModel, Field


class InitialState(BaseModel):
    """Sandbox 初始状态."""
    email_inbox: list[str] = Field(default_factory=list, description="邮箱 fixture ID 列表")
    memory: list[dict[str, str]] = Field(default_factory=list, description="预写入记忆键值对")
    browser_pages: dict[str, str] = Field(
        default_factory=dict, description="URL → 页面 fixture ID 映射"
    )


class EnvDelta(BaseModel):
    """L4 新增 (SECURITY_CONTRACTS §3.2) — 单轮环境增量变更, 增量合并而非全量替换."""

    browser_pages: dict[str, str] | None = Field(
        default=None,
        description="新增/更新的浏览器页面 (URL → fixture_id 或页面原始 HTML 内容)",
    )
    memory: list[str] | None = Field(
        default=None,
        description="新增的记忆条目 (key=value 格式, Runner 应用时写入 MemorySandbox)",
    )
    email_inbox: list[str] | None = Field(
        default=None,
        description="新增的邮件 fixture ID",
    )


class Scenario(BaseModel):
    """测试场景."""
    summary: str = Field(..., min_length=1, description="场景概述")
    initial_state: InitialState = Field(..., description="Sandbox 初始状态")
    target_agent: str = Field(..., min_length=1, description="目标 Agent 名称")
    turns: list["ScenarioTurn"] = Field(
        default_factory=list,
        description="可选多轮会话；缺失时执行 TestCase 顶层 input",
    )


class ScenarioTurn(BaseModel):
    """一次真实 Agent 会话调用."""

    turn_id: str = Field(..., min_length=1)
    input: str = Field(..., min_length=1)
    starts_new_session: bool
    env_delta: EnvDelta | None = Field(
        default=None,
        description="本轮环境增量变更 (L4 新增, 不传则保持上一轮状态)",
    )


class SuccessCriteria(BaseModel):
    """通过/失败判定条件."""
    pass_if: list[str] = Field(..., min_length=1, description="PASS 条件(全部满足)")
    fail_if: list[str] = Field(..., min_length=1, description="FAIL 条件(任一命中)")