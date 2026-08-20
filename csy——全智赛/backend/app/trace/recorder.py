"""TraceRecorder — converts CorpMate tool calls into ExecutionEvent format."""
import uuid
from datetime import datetime, timezone
from typing import Any

from backend.app.domain.execution_event import ExecutionEvent
from backend.app.domain.execution_trace import ExecutionTrace


class TraceRecorder:
    """Records agent execution as a sequence of ExecutionEvents."""

    def __init__(self):
        self._events: list[ExecutionEvent] = []
        self._run_id = "run-default"
        self._agent_id = "unknown"

    def start_run(self, agent_id: str) -> str:
        """Begin a new run. Returns run_id."""
        self._events = []
        self._run_id = f"run-{uuid.uuid4().hex[:8]}"
        self._agent_id = agent_id
        self._record("RUN_STARTED", {"agent_id": agent_id})
        return self._run_id

    def record_input(self, user_input: str) -> None:
        """Record AGENT_INPUT event."""
        self._record("RUN_STARTED", {"phase": "agent_input"})

    def record_tool_call(self, tool_name: str, arguments: dict[str, Any], confirmed: bool) -> str:
        """Record TOOL_CALLED event. Returns event_id.

        Payload format matches RuleJudge's expected format:
        {"tool_name": str, "arguments": dict, "confirmed": bool}
        """
        event_id = f"evt-{uuid.uuid4().hex[:8]}"
        self._record("TOOL_CALLED", {
            "tool_name": tool_name,
            "arguments": arguments,
            "confirmed": confirmed,
        })
        return event_id

    def record_output(self, response: str) -> None:
        """Record agent output."""
        self._record("RUN_FINISHED", {"phase": "agent_output"})

    def finish_run(self) -> None:
        """Record run finished."""
        self._record("RUN_FINISHED", {"status": "completed"})

    def _record(self, event_type: str, payload: dict[str, Any]) -> str:
        event = ExecutionEvent(
            event_id=f"evt-{uuid.uuid4().hex[:8]}",
            run_id=self._run_id,
            timestamp=datetime.now(timezone.utc),
            type=event_type,
            payload=payload,
        )
        self._events.append(event)
        return event.event_id

    def get_trace(self) -> ExecutionTrace:
        """Return the full execution trace."""
        return ExecutionTrace(
            trace_id=f"trace-{self._run_id}",
            run_id=self._run_id,
            agent_id=self._agent_id,
            events=list(self._events),
        )

    def get_events(self) -> list[ExecutionEvent]:
        """Return raw event list."""
        return list(self._events)
