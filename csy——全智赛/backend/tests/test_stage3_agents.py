"""Stage 3 Phase 3a tests — Agent Protocol, LLMAgent, adapter generalization."""
from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from backend.app.agents.base import AgentInterface
from backend.app.agents.llm_agent import LLMAgent
from backend.app.agents.defended_llm_agent import DefendedLLMAgent
from backend.app.adapter.reference_adapter import ReferenceAgentAdapter
from backend.app.corpmate.agent import CorpMate
from backend.app.llm.client import LLMClient, LLMResponse, ToolCallResult
from backend.app.sandbox.composite import CompositeSandbox


# ---------------------------------------------------------------------------
# AgentInterface Protocol tests
# ---------------------------------------------------------------------------


class TestAgentProtocol:
    """Verify AgentInterface Protocol works with structural typing."""

    def test_corpmate_satisfies_protocol(self):
        """CorpMate has chat() + reset(), so it satisfies AgentInterface."""
        agent = CorpMate()
        assert isinstance(agent, AgentInterface)

    def test_llm_agent_satisfies_protocol(self):
        """LLMAgent satisfies AgentInterface."""
        agent = LLMAgent.__new__(LLMAgent)
        assert isinstance(agent, AgentInterface)

    def test_defended_llm_satisfies_protocol(self):
        """DefendedLLMAgent satisfies AgentInterface."""
        agent = DefendedLLMAgent.__new__(DefendedLLMAgent)
        assert isinstance(agent, AgentInterface)

    def test_incomplete_class_fails_protocol(self):
        """A class without reset() does NOT satisfy AgentInterface."""

        class NotAnAgent:
            def chat(self, user_input: str):
                return "hi", []

        assert not isinstance(NotAnAgent(), AgentInterface)


# ---------------------------------------------------------------------------
# LLMClient tests (mocked API calls)
# ---------------------------------------------------------------------------


class TestLLMClient:
    """Test LLMClient with mocked OpenAI API."""

    @patch("backend.app.llm.client.OpenAI")
    def test_chat_no_tools(self, mock_openai_cls):
        """chat() without tools returns content only."""
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_choice = MagicMock()
        mock_choice.message.content = "Hello!"
        mock_choice.message.tool_calls = None
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )

        client = LLMClient(api_key="sk-test")
        response = client.chat(
            [{"role": "user", "content": "Hi"}]
        )

        assert response.content == "Hello!"
        assert response.tool_calls == []

    @patch("backend.app.llm.client.OpenAI")
    def test_chat_with_tool_calls(self, mock_openai_cls):
        """chat() with tools returns parsed tool_calls."""
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_tc = MagicMock()
        mock_tc.function.name = "email.send"
        mock_tc.function.arguments = '{"to": "test@example.com", "subject": "Hi", "body": "Hello"}'

        mock_choice = MagicMock()
        mock_choice.message.content = ""
        mock_choice.message.tool_calls = [mock_tc]
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )

        client = LLMClient(api_key="sk-test")
        response = client.chat(
            [{"role": "user", "content": "Send email"}],
            tools=[{"type": "function", "function": {"name": "email.send"}}],
        )

        assert len(response.tool_calls) == 1
        assert response.tool_calls[0].function_name == "email.send"
        assert response.tool_calls[0].arguments["to"] == "test@example.com"

    @patch("backend.app.llm.client.OpenAI")
    def test_chat_judge_structured_output(self, mock_openai_cls):
        """chat_judge() returns structured JudgeVerdict from tool_calls."""
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_tc = MagicMock()
        mock_tc.function.name = "submit_verdict"
        mock_tc.function.arguments = (
            '{"verdict": "FAIL", "reasoning": "Agent sent email", '
            '"confidence": 0.9, "violations": []}'
        )

        mock_choice = MagicMock()
        mock_choice.message.content = ""
        mock_choice.message.tool_calls = [mock_tc]
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )

        client = LLMClient(api_key="sk-test")
        verdict = client.chat_judge(
            [{"role": "user", "content": "Evaluate this trace"}]
        )

        assert verdict.verdict == "FAIL"
        assert verdict.confidence == 0.9
        assert "sent email" in verdict.reasoning.lower()

    @patch("backend.app.llm.client.OpenAI")
    def test_chat_judge_fallback_on_no_tool_calls(self, mock_openai_cls):
        """chat_judge() falls back to PASS when LLM returns unstructured output."""
        mock_client = MagicMock()
        mock_openai_cls.return_value = mock_client

        mock_choice = MagicMock()
        mock_choice.message.content = "Everything looks fine"
        mock_choice.message.tool_calls = None
        mock_client.chat.completions.create.return_value = MagicMock(
            choices=[mock_choice]
        )

        client = LLMClient(api_key="sk-test")
        verdict = client.chat_judge(
            [{"role": "user", "content": "Evaluate"}]
        )

        assert verdict.verdict == "PASS"
        assert verdict.confidence == 0.3


# ---------------------------------------------------------------------------
# LLMAgent tests (mocked LLM client)
# ---------------------------------------------------------------------------


class TestLLMAgent:
    """Test LLMAgent with mocked LLMClient."""

    def test_chat_no_tool_calls(self):
        """LLMAgent returns text when LLM has no tool calls."""
        sandbox = CompositeSandbox()
        mock_llm = MagicMock()
        mock_llm.chat.return_value = LLMResponse(
            content="I can help with that!", tool_calls=[]
        )

        agent = LLMAgent(sandbox=sandbox, llm_client=mock_llm)
        response, tool_calls = agent.chat("Hello")

        assert response == "I can help with that!"
        assert tool_calls == []
        assert len(agent.conversation_history) == 2  # user + assistant

    def test_chat_with_tool_calls(self):
        """LLMAgent executes tools via agentic loop, returns tool_calls."""
        sandbox = CompositeSandbox()
        mock_llm = MagicMock()
        # First call: LLM wants to open a page
        # Second call (after tool result): LLM gives final text response
        mock_llm.chat.side_effect = [
            LLMResponse(
                content="Opening the page...",
                tool_calls=[
                    ToolCallResult(
                        function_name="browser.open_page",
                        arguments={"url": "https://malicious.example"},
                        call_id="call_0",
                    )
                ],
            ),
            LLMResponse(
                content="The page contains information about AI.",
                tool_calls=[],
            ),
        ]

        agent = LLMAgent(sandbox=sandbox, llm_client=mock_llm)
        response, tool_calls = agent.chat("Summarize https://malicious.example")

        assert len(tool_calls) == 1
        assert tool_calls[0]["tool_name"] == "browser.open_page"
        assert tool_calls[0]["arguments"]["url"] == "https://malicious.example"
        assert tool_calls[0]["confirmed"] is False
        assert "AI" in response

    def test_chat_handles_llm_error(self):
        """LLMAgent returns error message when LLM API fails."""
        sandbox = CompositeSandbox()
        mock_llm = MagicMock()
        mock_llm.chat.side_effect = Exception("API timeout")

        agent = LLMAgent(sandbox=sandbox, llm_client=mock_llm)
        response, tool_calls = agent.chat("Hello")

        assert "error" in response.lower()
        assert tool_calls == []

    def test_reset_clears_history(self):
        """reset() clears conversation history."""
        mock_llm = MagicMock()
        mock_llm.chat.return_value = LLMResponse(content="Hi", tool_calls=[])

        agent = LLMAgent(llm_client=mock_llm)
        agent.chat("Hello")
        assert len(agent.conversation_history) == 2

        agent.reset()
        assert len(agent.conversation_history) == 0

    def test_multi_turn_history_accumulates(self):
        """Multi-turn conversation accumulates history."""
        mock_llm = MagicMock()
        mock_llm.chat.return_value = LLMResponse(
            content="Sure!", tool_calls=[]
        )

        agent = LLMAgent(llm_client=mock_llm)
        agent.chat("Turn 1")
        agent.chat("Turn 2")

        assert len(agent.conversation_history) == 4  # 2 user + 2 assistant

    def test_passes_system_prompt(self):
        """LLMAgent includes system prompt in messages."""
        mock_llm = MagicMock()
        mock_llm.chat.return_value = LLMResponse(content="OK", tool_calls=[])

        agent = LLMAgent(llm_client=mock_llm)
        agent.chat("Hello")

        call_args = mock_llm.chat.call_args
        messages = call_args[0][0]  # first positional arg
        assert messages[0]["role"] == "system"
        assert "CorpMate" in messages[0]["content"]


# ---------------------------------------------------------------------------
# DefendedLLMAgent tests
# ---------------------------------------------------------------------------


class TestDefendedLLMAgent:
    """Test DefendedLLMAgent (Phase 3a stub)."""

    def test_inherits_llm_agent(self):
        """DefendedLLMAgent is a subclass of LLMAgent."""
        assert issubclass(DefendedLLMAgent, LLMAgent)

    def test_satisfies_protocol(self):
        """DefendedLLMAgent satisfies AgentInterface."""
        agent = DefendedLLMAgent.__new__(DefendedLLMAgent)
        assert isinstance(agent, AgentInterface)

    def test_has_defense_labels(self):
        """DefendedLLMAgent has defense_labels attribute."""
        mock_llm = MagicMock()
        agent = DefendedLLMAgent(llm_client=mock_llm)
        assert agent.defense_labels == []
        assert agent.get_defense_labels() == []

    def test_reset_clears_defense_labels(self):
        """reset() clears both history and defense_labels."""
        mock_llm = MagicMock()
        mock_llm.chat.return_value = LLMResponse(content="OK", tool_calls=[])

        agent = DefendedLLMAgent(llm_client=mock_llm)
        agent.defense_labels = ["D1:test"]
        agent.reset()
        assert agent.defense_labels == []


# ---------------------------------------------------------------------------
# Adapter generalization tests
# ---------------------------------------------------------------------------


class TestAdapterGeneralization:
    """Test ReferenceAgentAdapter accepts any AgentInterface."""

    def test_default_is_corpmate(self):
        """Without agent param, adapter uses CorpMate."""
        adapter = ReferenceAgentAdapter()
        assert isinstance(adapter._agent, CorpMate)

    def test_accepts_llm_agent(self):
        """Adapter accepts LLMAgent via agent parameter."""
        sandbox = CompositeSandbox()
        mock_llm = MagicMock()
        llm_agent = LLMAgent(sandbox=sandbox, llm_client=mock_llm)

        adapter = ReferenceAgentAdapter(sandbox=sandbox, agent=llm_agent)
        assert isinstance(adapter._agent, LLMAgent)

    def test_accepts_defended_llm(self):
        """Adapter accepts DefendedLLMAgent via agent parameter."""
        sandbox = CompositeSandbox()
        mock_llm = MagicMock()
        defended = DefendedLLMAgent(sandbox=sandbox, llm_client=mock_llm)

        adapter = ReferenceAgentAdapter(sandbox=sandbox, agent=defended)
        assert isinstance(adapter._agent, DefendedLLMAgent)

    def test_invoke_with_llm_agent(self):
        """Adapter.invoke() works with LLMAgent."""
        sandbox = CompositeSandbox()
        mock_llm = MagicMock()
        mock_llm.chat.return_value = LLMResponse(
            content="Hello!", tool_calls=[]
        )

        llm_agent = LLMAgent(sandbox=sandbox, llm_client=mock_llm)
        adapter = ReferenceAgentAdapter(sandbox=sandbox, agent=llm_agent)

        response = adapter.invoke("Hi")
        assert response == "Hello!"

    def test_begin_new_session_resets_agent(self):
        """begin_new_session() calls agent.reset() instead of rebuilding."""
        mock_llm = MagicMock()
        mock_llm.chat.return_value = LLMResponse(content="OK", tool_calls=[])

        llm_agent = LLMAgent(llm_client=mock_llm)
        llm_agent.chat("Turn 1")
        assert len(llm_agent.conversation_history) == 2

        adapter = ReferenceAgentAdapter(agent=llm_agent)
        adapter.begin_new_session()
        assert len(llm_agent.conversation_history) == 0


# ---------------------------------------------------------------------------
# TraceRecorder arguments fix test
# ---------------------------------------------------------------------------


class TestTraceRecorderArguments:
    """Verify TraceRecorder now passes real arguments."""

    def test_records_real_arguments(self):
        """record_tool_call() stores actual arguments, not {}."""
        from backend.app.trace.recorder import TraceRecorder

        recorder = TraceRecorder()
        recorder.start_run("test-agent")
        recorder.record_tool_call(
            tool_name="email.send",
            arguments={"to": "test@example.com", "subject": "Test"},
            confirmed=False,
        )

        events = recorder.get_events()
        tool_events = [e for e in events if e.type == "TOOL_CALLED"]
        assert len(tool_events) == 1
        assert tool_events[0].payload["arguments"] == {
            "to": "test@example.com",
            "subject": "Test",
        }


# ---------------------------------------------------------------------------
# Agent factory test
# ---------------------------------------------------------------------------


class TestAgentFactory:
    """Test evaluation_service._create_agent factory."""

    def test_creates_corpmate(self):
        from backend.app.services.evaluation_service import EvaluationCoordinator

        sandbox = CompositeSandbox()
        agent = EvaluationCoordinator._create_agent("corpmate-v0", sandbox)
        assert isinstance(agent, CorpMate)

    def test_raises_for_unknown(self):
        from backend.app.services.evaluation_service import (
            EvaluationCoordinator,
            InvalidAgentSelectionError,
        )

        sandbox = CompositeSandbox()
        with pytest.raises(InvalidAgentSelectionError):
            EvaluationCoordinator._create_agent("nonexistent-agent", sandbox)
