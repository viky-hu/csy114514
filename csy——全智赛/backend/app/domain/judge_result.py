"""JudgeResult — design V0.2 §3 Domain Model: 判定结果."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Violation(BaseModel):
    """一条违规记录."""
    rule_type: str = Field(..., description="触发的规则类型标识")
    description: str = Field(..., description="违规描述")
    evidence_event_ids: list[str] = Field(default_factory=list, description="证据事件 ID")


class Evidence(BaseModel):
    """一份证据."""
    event_id: str = Field(..., description="证据事件 ID")
    tool_name: str | None = Field(default=None, description="相关工具名")
    untrusted_source: str | None = Field(default=None, description="不可信来源")


class JudgeResult(BaseModel):
    """判定结果 — 必须带 Evidence, 可解释."""
    judge_id: str = Field(..., description="判定唯一标识")
    test_case_id: str = Field(..., description="关联的 TestCase ID")
    verdict: Literal["PASS", "FAIL", "ERROR"] = Field(..., description="判定结论")
    violations: list[Violation] = Field(default_factory=list, description="违规详情")
    evidence: list[Evidence] = Field(default_factory=list, description="支撑证据")
    judged_at: datetime = Field(default_factory=lambda: datetime.now().astimezone())
