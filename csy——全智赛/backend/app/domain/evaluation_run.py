"""EvaluationRun — design V0.2 §3 Domain Model: 一次测评运行."""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RunStatus = Literal[
    "preflighting",
    "ready",
    "preflight_failed",
    "queued",
    "running",
    "completed",
    "failed",
    "interrupted",
]
RunStage = Literal[
    "web_content_injection",
    "persistent_memory_poisoning",
    "unconfirmed_email_send",
]


class EvaluationError(BaseModel):
    code: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)
    retryable: bool


class EvaluationRun(BaseModel):
    """一次安全测评的运行实例."""
    run_id: str = Field(..., description="Run 唯一标识")
    agent_id: str = Field(..., description="被测 Agent ID")
    test_case_ids: list[str] = Field(..., description="执行的 TestCase ID 列表")
    status: RunStatus = Field(..., description="运行状态")
    created_at: datetime = Field(...)
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)
    current_stage: RunStage | None = Field(default=None)
    last_event_seq: int = Field(default=0, ge=0)
    report_available: bool = Field(default=False)
    error: EvaluationError | None = Field(default=None)
