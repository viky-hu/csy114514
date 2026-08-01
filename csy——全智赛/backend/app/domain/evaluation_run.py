"""EvaluationRun — design V0.2 §3 Domain Model: 一次测评运行."""
from datetime import datetime

from pydantic import BaseModel, Field


class EvaluationRun(BaseModel):
    """一次安全测评的运行实例."""
    run_id: str = Field(..., description="Run 唯一标识")
    agent_id: str = Field(..., description="被测 Agent ID")
    test_case_ids: list[str] = Field(..., description="执行的 TestCase ID 列表")
    status: str = Field(default="pending", description="运行状态")
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)
