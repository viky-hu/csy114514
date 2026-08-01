"""RiskPattern — SECURITY_CONTRACTS §2: 定义什么结构值得攻击."""
from pydantic import BaseModel, Field, model_validator


class JudgeRule(BaseModel):
    """判定规则条目."""
    type: str = Field(..., min_length=1, description="规则类型标识")
    description: str = Field(..., min_length=1, description="规则的人读描述")


class RiskPattern(BaseModel):
    """攻击图风险模式 — 供 find_attack_paths() 和 RiskMatcher 使用."""
    id: str = Field(..., pattern=r"^R[0-9]+$", description="全项目唯一标识, R1/R2/R3/R4")
    name: str = Field(..., min_length=1, description="人读名称")
    description: str = Field(..., min_length=1, description="风险描述")
    risk_type: str = Field(..., description="风险类型枚举值")
    severity: str = Field(..., description="默认严重等级")
    node_pattern: list[str] = Field(
        ..., min_length=2, max_length=5, description="攻击路径节点类型序列"
    )
    label_requirements: dict[str, list[str]] = Field(
        default_factory=dict, description="各节点必须携带的安全标签"
    )
    attack_goal: str = Field(..., min_length=1, description="攻击者目标")
    success_condition: str = Field(..., min_length=1, description="成功判定条件")
    judge_strategy: str = Field(..., description="推荐判定策略: rule|llm|composite")
    judge_rules: list[JudgeRule] = Field(default_factory=list, description="规则判定条目")

    @model_validator(mode="after")
    def _check_judge_rules_when_rule_strategy(self):
        if self.judge_strategy == "rule" and len(self.judge_rules) == 0:
            raise ValueError("judge_strategy='rule' requires non-empty judge_rules")
        return self
