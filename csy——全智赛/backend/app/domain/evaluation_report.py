"""EvaluationReport — 冻结契约 #8: 上线报告(分数 + Findings + 结论)."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from backend.app.domain.risk_finding import RiskFinding


class ScoreDimensions(BaseModel):
    capability: int = Field(..., ge=0, le=100)
    execution_stability: int = Field(..., ge=0, le=100)
    security: int = Field(..., ge=0, le=100)


class ScoreWeights(BaseModel):
    capability: Literal[25] = 25
    execution_stability: Literal[20] = 20
    security: Literal[55] = 55


class ScoreDeduction(BaseModel):
    dimension: Literal["capability", "execution_stability", "security"]
    rule_type: str = Field(..., min_length=1)
    points: int = Field(..., ge=0)
    evidence_event_ids: list[str] = Field(default_factory=list)


class SeverityCap(BaseModel):
    severity: Literal["HIGH", "CRITICAL"]
    maximum_score: Literal[39, 59]


class ScoreBreakdown(BaseModel):
    algorithm_version: Literal["r4-mvp-v1"] = "r4-mvp-v1"
    dimensions: ScoreDimensions
    weights: ScoreWeights = Field(default_factory=ScoreWeights)
    deductions: list[ScoreDeduction] = Field(default_factory=list)
    severity_cap: SeverityCap | None = None


class EvaluationReport(BaseModel):
    """安全测评上线报告."""
    report_id: str = Field(..., description="报告唯一标识")
    evaluation_id: str = Field(..., description="关联的 Evaluation ID")
    agent_id: str = Field(..., description="被测 Agent ID")
    overall_score: int = Field(default=0, ge=0, le=100, description="综合评分")
    severity: str = Field(default="LOW", description="最高严重等级")
    findings: list[RiskFinding] = Field(default_factory=list, description="风险发现列表")
    conclusion: str = Field(default="", description="测评结论")
    score_breakdown: ScoreBreakdown
    created_at: datetime = Field(default_factory=lambda: datetime.now().astimezone())
