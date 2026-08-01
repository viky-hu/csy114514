"""AttackSeed — SECURITY_CONTRACTS §3: 定义具体攻击从哪里开始."""
from pydantic import BaseModel, Field


class AttackPayload(BaseModel):
    """攻击载荷."""
    content: str = Field(..., min_length=1, description="实际攻击内容")
    delivery_method: str = Field(..., description="投放方式")
    target_tool: str | None = Field(default=None, description="期望目标工具名")
    target_node_id: str | None = Field(default=None, description="期望命中节点 ID")


class AttackSeed(BaseModel):
    """可执行的攻击载荷, 关联一个 RiskPattern."""
    id: str = Field(..., pattern=r"^seed_[a-z]+_[0-9]+$", description="全项目唯一标识")
    name: str = Field(..., min_length=1, description="人读名称")
    description: str = Field(..., min_length=1, description="Seed 描述")
    risk_type: str = Field(..., description="风险类型枚举值")
    risk_pattern_id: str = Field(..., pattern=r"^R[0-9]+$", description="关联 RiskPattern ID")
    attack_type: str = Field(..., description="攻击手法分类")
    payload: AttackPayload = Field(..., description="攻击载荷")
    difficulty: str = Field(..., description="攻击难度: low|medium|high")
    tags: list[str] = Field(default_factory=list, description="分类标签")
