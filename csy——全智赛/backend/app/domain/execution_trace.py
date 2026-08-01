"""ExecutionTrace — design V0.2 §3 Domain Model: 完整执行轨迹."""
from backend.app.domain.execution_event import ExecutionEvent
from pydantic import BaseModel, Field


class ExecutionTrace(BaseModel):
    """一次 Agent 执行的完整事件轨迹."""
    trace_id: str = Field(..., description="Trace 唯一标识")
    run_id: str = Field(..., description="所属 Run ID")
    agent_id: str = Field(..., description="Agent ID")
    events: list[ExecutionEvent] = Field(default_factory=list, description="事件序列")
