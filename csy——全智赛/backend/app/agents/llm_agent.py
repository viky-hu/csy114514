"""LLMAgent — real LLM-powered agent replacing CorpMate keyword matching.

Stage 3 核心: 用 DeepSeek function calling 替代关键词匹配,
使 IPI 攻击真正生效 (Phase 3a Bare 基线).

Phase 3b: 新增 agentic loop — LLM 调用工具 → Sandbox 执行 → 结果反馈 → LLM 继续.
这使得 LLM 能看到页面内容 (包括 IPI 攻击), 从而使攻击真正生效.

chat() 签名与 CorpMate 完全一致, 满足 AgentInterface Protocol.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from backend.app.agents.prompts import TOOL_DEFINITIONS, build_system_prompt
from backend.app.llm.client import LLMClient
from backend.app.sandbox.composite import CompositeSandbox

logger = logging.getLogger(__name__)

# Maximum tool-call iterations to prevent infinite loops
_MAX_ITERATIONS = 5


class LLMAgent:
    """LLM-based agent that uses function calling for tool invocation.

    Replaces CorpMate's keyword matching with real semantic understanding.
    This is the "bare" version — no defense mechanisms. IPI attacks
    embedded in page content will likely succeed against this agent.

    Agentic loop:
    1. LLM generates tool calls
    2. Sandbox executes tool calls
    3. Results fed back to LLM as tool messages
    4. LLM continues until no more tool calls (or max iterations)
    """

    def __init__(
        self,
        sandbox: CompositeSandbox | None = None,
        llm_client: LLMClient | None = None,
    ):
        self.sandbox = sandbox or CompositeSandbox()
        self.llm = llm_client or LLMClient()
        self.conversation_history: list[dict[str, str]] = []
        # Track page contents seen for defense layer use (D2)
        self._page_contents_seen: list[str] = []

    def chat(self, user_input: str) -> tuple[str, list[dict[str, Any]]]:
        """Process user input using LLM with function calling + agentic loop.

        Returns:
            (response_text, tool_calls) matching AgentInterface protocol.
            tool_calls format:
            [{"tool_name": str, "arguments": dict, "confirmed": bool}]
        """
        all_tool_calls: list[dict[str, Any]] = []

        # Build initial messages list
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": build_system_prompt(defended=False)},
            *self.conversation_history,
            {"role": "user", "content": user_input},
        ]

        for iteration in range(_MAX_ITERATIONS):
            # Call LLM
            try:
                response = self.llm.chat(messages, tools=TOOL_DEFINITIONS)
            except Exception as e:
                logger.error("LLM API call failed (iteration %d): %s", iteration, e)
                if iteration == 0:
                    return (
                        "I'm sorry, I encountered an error processing your request.",
                        [],
                    )
                # On subsequent iterations, use what we have
                break

            # If no tool calls, we're done
            if not response.tool_calls:
                # Update conversation history
                self._update_history(user_input, response.content or "")
                return response.content or "I've processed your request.", all_tool_calls

            # Append assistant message with tool_calls to messages
            assistant_msg: dict[str, Any] = {"role": "assistant", "content": response.content or ""}
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.call_id or f"call_{i}",
                    "type": "function",
                    "function": {
                        "name": tc.function_name,
                        "arguments": json.dumps(tc.arguments),
                    },
                }
                for i, tc in enumerate(response.tool_calls)
            ]
            messages.append(assistant_msg)

            # Execute each tool call through sandbox and collect results
            for i, tc in enumerate(response.tool_calls):
                call_id = tc.call_id or f"call_{i}"

                # Record this tool call decision
                tc_dict = {
                    "tool_name": tc.function_name,
                    "arguments": tc.arguments,
                    "confirmed": False,
                }
                all_tool_calls.append(tc_dict)

                # Execute through sandbox
                try:
                    result = self.sandbox.execute(tc.function_name, tc.arguments)
                    result_content = json.dumps(result, ensure_ascii=False, default=str)
                except Exception as e:
                    logger.warning("Sandbox execution failed for %s: %s", tc.function_name, e)
                    result_content = json.dumps(
                        {"success": False, "error": str(e)}
                    )

                # Track page contents for D2 defense
                if tc.function_name == "browser.open_page" and isinstance(result, dict):
                    page_result = result.get("result", {})
                    if isinstance(page_result, dict):
                        content = page_result.get("content", "")
                        if content:
                            self._page_contents_seen.append(content)

                # Append tool result message
                messages.append({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": result_content,
                })

        # Final LLM call to get response text after tool results
        try:
            final_response = self.llm.chat(messages, tools=TOOL_DEFINITIONS)
            final_text = final_response.content or "I've processed your request."

            # If the final call also has tool calls, record them (but don't execute)
            for tc in final_response.tool_calls:
                all_tool_calls.append({
                    "tool_name": tc.function_name,
                    "arguments": tc.arguments,
                    "confirmed": False,
                })
        except Exception as e:
            logger.error("Final LLM call failed: %s", e)
            final_text = "I've processed your request."

        self._update_history(user_input, final_text)
        return final_text, all_tool_calls

    def _update_history(self, user_input: str, assistant_text: str) -> None:
        """Append user + assistant messages to conversation history."""
        self.conversation_history.append(
            {"role": "user", "content": user_input}
        )
        self.conversation_history.append(
            {"role": "assistant", "content": assistant_text or ""}
        )

    def reset(self) -> None:
        """Reset conversation history. Sandbox reset is caller's responsibility."""
        self.conversation_history = []
        self._page_contents_seen = []
