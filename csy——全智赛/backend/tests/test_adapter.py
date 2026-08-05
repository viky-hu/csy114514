"""Test ReferenceAgentAdapter."""
import pytest
from backend.app.adapter.reference_adapter import ReferenceAgentAdapter


@pytest.fixture
def adapter():
    ad = ReferenceAgentAdapter()
    ad.reset_with_state({
        "email_inbox": ["email_001", "email_003"],
        "memory": [],
        "browser_pages": {"https://malicious.example": "page_fixture_001"},
    })
    return ad


class TestReferenceAgentAdapter:
    def test_invoke_returns_string(self, adapter):
        response = adapter.invoke("check my emails")
        assert isinstance(response, str)
        assert len(response) > 0

    def test_get_manifest(self, adapter):
        manifest = adapter.get_manifest()
        assert manifest.agent_id == "corpmate-v0"
        assert "email.send" in manifest.capabilities
        assert manifest.tool_permissions["email.send"] == "CONFIRM"

    def test_get_trace_after_invoke(self, adapter):
        adapter.start_run("corpmate-v0")
        adapter.invoke("send an email")
        trace = adapter.get_trace()
        assert trace.agent_id == "corpmate-v0"
        assert len(trace.events) >= 2  # input + at least one tool call

    def test_trace_contains_tool_called_events(self, adapter):
        adapter.start_run("corpmate-v0")
        adapter.invoke("summarize https://malicious.example")
        trace = adapter.get_trace()
        tool_events = [e for e in trace.events if e.type == "TOOL_CALLED"]
        assert len(tool_events) >= 1
        # Verify TOOL_CALLED payload format matches RuleJudge expectation
        for e in tool_events:
            assert "tool_name" in e.payload
            assert "arguments" in e.payload
            assert "confirmed" in e.payload

    def test_tool_call_payload_format(self, adapter):
        """Verify TOOL_CALLED payload matches RuleJudge expected format:
        {"tool_name": str, "arguments": dict, "confirmed": bool}
        """
        adapter.start_run("corpmate-v0")
        adapter.invoke("send an email to boss@corp.com")
        trace = adapter.get_trace()
        send_events = [
            e for e in trace.events
            if e.type == "TOOL_CALLED" and e.payload.get("tool_name") == "email.send"
        ]
        assert len(send_events) >= 1
        payload = send_events[0].payload
        assert isinstance(payload["tool_name"], str)
        assert isinstance(payload["arguments"], dict)
        assert isinstance(payload["confirmed"], bool)
        assert payload["confirmed"] is False  # email.send without user confirmation

    def test_reset_clears_trace(self, adapter):
        adapter.start_run("corpmate-v0")
        adapter.invoke("check emails")
        adapter.reset()
        adapter.start_run("corpmate-v0")
        adapter.invoke("check emails")
        trace = adapter.get_trace()
        # Should only have events from second run
        tool_events = [e for e in trace.events if e.type == "TOOL_CALLED"]
        # email.list only, not from first run
        assert len(tool_events) >= 1
