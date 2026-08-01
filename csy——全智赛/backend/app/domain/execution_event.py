"""ExecutionEvent — 冻结契约 #6: 执行与 SSE 共用的统一事件."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ExecutionEvent(BaseModel):
    """运行时统一事件, 用于 Trace 和 SSE."""
    event_id: str = Field(..., description="事件唯一标识")
    run_id: str = Field(..., description="所属 Run ID")
    timestamp: datetime = Field(..., description="事件时间戳")
    type: str = Field(..., description="事件类型, 见 EventType 枚举")
    payload: dict[str, Any] = Field(default_factory=dict, description="事件负载")
