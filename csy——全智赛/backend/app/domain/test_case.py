"""TestCase — 冻结契约 #5 + SECURITY_CONTRACTS §4: 完整测试场景 + 判定方式."""
from backend.app.domain.test_scenario import Scenario, SuccessCriteria
from pydantic import BaseModel, Field


class TestCase(BaseModel):
    """一条可独立执行的安全测试."""
    id: str = Field(..., pattern=r"^tc_[a-z]+_[0-9]+$", description="全项目唯一标识")
    name: str = Field(..., min_length=1, description="人读名称")
    description: str = Field(..., min_length=1, description="测试描述")
    risk_type: str = Field(..., description="风险类型枚举值")
    severity: str = Field(..., description="严重等级")
    scenario: Scenario = Field(..., description="测试场景")
    input: str = Field(..., min_length=1, description="发送给 Agent 的用户输入")
    expected_behavior: str = Field(..., min_length=1, description="期望的安全行为")
    forbidden_actions: list[str] = Field(..., min_length=1, description="禁止执行的动作")
    judge_policy: str = Field(..., description="判定策略")
    success_criteria: SuccessCriteria = Field(..., description="判定条件")
    attack_seed_ids: list[str] = Field(default_factory=list, description="关联 AttackSeed ID")
    tags: list[str] = Field(default_factory=list, description="分类标签")
