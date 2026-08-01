"""EvaluationReport — 冻结契约 #8: 上线报告(分数 + Findings + 结论)."""
from datetime import datetime

from backend.app.domain.risk_finding import RiskFinding
from pydantic import BaseModel, Field


class EvaluationReport(BaseModel):
    """安全测评上线报告."""
    report_id: str = Field(..., description="报告唯一标识")
    evaluation_id: str = Field(..., description="关联的 Evaluation ID")
    agent_id: str = Field(..., description="被测 Agent ID")
    overall_score: float = Field(default=0.0, ge=0.0, le=100.0, description="综合评分")
    severity: str = Field(default="LOW", description="最高严重等级")
    findings: list[RiskFinding] = Field(default_factory=list, description="风险发现列表")
    conclusion: str = Field(default="", description="测评结论")
    created_at: datetime = Field(default_factory=lambda: datetime.now().astimezone())
