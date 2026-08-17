"""GET /test-cases — TestCase 列表 API (Stage 2 plan §2.2③, D8 交付)."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.domain.test_case import TestCase
from backend.app.knowledge.kb_loader import load_all_test_case_files

router = APIRouter(prefix="/test-cases", tags=["test-cases"])


class TestCaseSummary(BaseModel):
    """前端 TestCase 选择器消费的摘要字段."""

    id: str = Field(..., description="TestCase 唯一标识")
    name: str = Field(..., description="人读名称")
    risk_type: str = Field(..., description="风险类型")
    severity: str = Field(..., description="严重等级")
    target_risk_pattern: str = Field(..., description="目标 RiskPattern ID (R1-R4)")
    turn_count: int = Field(..., description="轮次数 (多轮 turns 数, 单轮为 1)")
    description: str = Field(..., description="测试描述")


def _target_risk_pattern(tags: list[str]) -> str:
    for tag in tags:
        if len(tag) == 2 and tag[0].lower() == "r" and tag[1].isdigit():
            return tag.upper()
    return ""


@router.get("", response_model=list[TestCaseSummary])
def list_test_cases() -> list[TestCaseSummary]:
    """返回全部 TestCase 摘要 (供前端选择器 + OpenAPI types 生成)."""
    summaries: list[TestCaseSummary] = []
    for raw in load_all_test_case_files():
        scenario = raw.get("scenario", {})
        turns = scenario.get("turns") or []
        turn_count = len(turns) if turns else (1 if raw.get("input") else 0)
        summaries.append(
            TestCaseSummary(
                id=raw["id"],
                name=raw.get("name", ""),
                risk_type=raw.get("risk_type", ""),
                severity=raw.get("severity", ""),
                target_risk_pattern=_target_risk_pattern(raw.get("tags", [])),
                turn_count=turn_count,
                description=raw.get("description", ""),
            )
        )
    return sorted(summaries, key=lambda s: s.id)

@router.get("/{test_case_id}", response_model=TestCase)
def get_test_case(test_case_id: str) -> TestCase:
    """返回单个完整 TestCase (含 scenario.turns + env_delta), 供前端/联调消费.

    L4 签字备注: Frontend 以 OpenAPI schema 为准, 消费 ScenarioTurn.input /
    ScenarioTurn.env_delta / turn_count 等字段。
    """
    for raw in load_all_test_case_files():
        if raw.get("id") == test_case_id:
            return TestCase.model_validate(raw)
    raise HTTPException(status_code=404, detail=f"TestCase '{test_case_id}' not found")
