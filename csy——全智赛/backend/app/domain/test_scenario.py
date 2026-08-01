"""TestScenario — design V0.2 §3 Domain Model: 测试场景."""
from pydantic import BaseModel, Field


class InitialState(BaseModel):
    """Sandbox 初始状态."""
    email_inbox: list[str] = Field(default_factory=list, description="邮箱 fixture ID 列表")
    memory: list[dict[str, str]] = Field(default_factory=list, description="预写入记忆键值对")
    browser_pages: dict[str, str] = Field(
        default_factory=dict, description="URL → 页面 fixture ID 映射"
    )


class Scenario(BaseModel):
    """测试场景."""
    summary: str = Field(..., min_length=1, description="场景概述")
    initial_state: InitialState = Field(..., description="Sandbox 初始状态")
    target_agent: str = Field(..., min_length=1, description="目标 Agent 名称")


class SuccessCriteria(BaseModel):
    """通过/失败判定条件."""
    pass_if: list[str] = Field(..., min_length=1, description="PASS 条件(全部满足)")
    fail_if: list[str] = Field(..., min_length=1, description="FAIL 条件(任一命中)")
