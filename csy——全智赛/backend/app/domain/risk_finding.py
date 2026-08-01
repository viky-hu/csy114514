"""RiskFinding — 冻结契约 #7: 一条确认的风险(含 Evidence)."""
from datetime import datetime

from pydantic import BaseModel, Field


class FindingEvidence(BaseModel):
    """RiskFinding 中的证据条目."""
    event_id: str = Field(..., description="证据事件 ID")
    description: str = Field(..., description="证据描述")


class RiskFinding(BaseModel):
    """一条确认的风险发现."""
    finding_id: str = Field(..., description="Finding 唯一标识")
    evaluation_id: str = Field(..., description="所属 Evaluation ID")
    risk_type: str = Field(..., description="风险类型枚举值")
    severity: str = Field(..., description="严重等级")
    risk_pattern_id: str = Field(..., description="关联的 RiskPattern ID")
    attack_path_id: str | None = Field(default=None, description="关联的 AttackPath ID")
    description: str = Field(..., description="风险描述")
    evidence: list[FindingEvidence] = Field(default_factory=list, description="证据列表")
    created_at: datetime = Field(default_factory=lambda: datetime.now().astimezone())
