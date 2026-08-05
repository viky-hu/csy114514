"""ReferenceAgentAdapter — wraps CorpMate for the Runner.

Runner never imports CorpMate directly.
"""
from typing import Any
from backend.app.corpmate.agent import CorpMate
from backend.app.sandbox.composite import CompositeSandbox
from backend.app.trace.recorder import TraceRecorder
from backend.app.domain.agent_manifest import AgentManifest
from backend.app.domain.execution_trace import ExecutionTrace


class ReferenceAgentAdapter:
    """Adapter wrapping the CorpMate reference agent."""

    def __init__(self, sandbox: CompositeSandbox | None = None):
        self._sandbox = sandbox or CompositeSandbox()
        self._agent = CorpMate(sandbox=self._sandbox)
        self._recorder = TraceRecorder()

    def invoke(self, user_input: str) -> str:
        """Invoke the agent with user input. Returns agent's text response.

        Records all tool calls via TraceRecorder.
        """
        self._recorder.record_input(user_input)
        response, tool_calls = self._agent.chat(user_input)
        for tc in tool_calls:
            self._recorder.record_tool_call(
                tool_name=tc["tool_name"],
                arguments=tc.get("arguments", {}),
                confirmed=tc.get("confirmed", False),
            )
        self._recorder.record_output(response)
        return response

    def reset(self) -> None:
        """Reset agent and sandbox for a new test."""
        self._agent.reset()
        self._sandbox.reset()
        self._recorder = TraceRecorder()

    def reset_with_state(self, initial_state: dict[str, Any]) -> None:
        """Reset with specific sandbox initial state (from TestCase.scenario.initial_state)."""
        self._agent.reset()
        self._sandbox.reset(initial_state)
        self._recorder = TraceRecorder()

    def get_manifest(self) -> AgentManifest:
        """Return CorpMate's AgentManifest."""
        return AgentManifest(
            agent_id="corpmate-v0",
            name="CorpMate v0",
            version="0.1.0",
            capabilities=[
                "chat", "browser.open_page", "email.list",
                "email.read", "email.send", "memory.read", "memory.write",
            ],
            data_sources=["browser", "email", "memory"],
            memory={"type": "persistent", "max_entries": 100},
            tool_permissions={
                "browser.open_page": "ALLOW",
                "email.list": "ALLOW",
                "email.read": "ALLOW",
                "email.send": "CONFIRM",
                "memory.read": "ALLOW",
                "memory.write": "ALLOW",
            },
        )

    def get_trace(self) -> ExecutionTrace:
        """Return the recorded execution trace."""
        self._recorder.finish_run()
        return self._recorder.get_trace()

    def start_run(self, agent_id: str = "corpmate-v0") -> str:
        """Start a new trace run. Returns run_id."""
        return self._recorder.start_run(agent_id)
