"""DefendedLLMAgent — LLMAgent with D1-D8 full defense layer.

Stage 3 Phase 3b/3c: 在 LLMAgent 基础上添加 8 层纵深防御:
  D1: InputFilter — 清洗页面内容, 移除隐藏指令
  D2: OutputFilter — 审查 tool calls, 阻止可疑操作
  D3: Confirmation — email.send 始终需要确认 (sandbox 门控)
  D4: Instruction Isolation — 强化系统提示, 明确拒绝页面指令
  D5: ChainDetector — 检测可疑因果链 (browse→write→send)
  D6: IntentClassifier — 判断 tool call 是否源自页面指令
  D7: MemoryAuditor — 阻止可疑 memory.write
  D8: SessionMonitor — 检测跨会话记忆投毒

chat() 覆盖父类, 在 agentic loop 的每个环节插入防御检查.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from backend.app.agents.defenses.chain_detector import ChainDetector
from backend.app.agents.defenses.input_filter import InputFilter
from backend.app.agents.defenses.intent_classifier import IntentClassifier
from backend.app.agents.defenses.memory_auditor import MemoryAuditor
from backend.app.agents.defenses.output_filter import OutputFilter
from backend.app.agents.defenses.session_monitor import SessionMonitor
from backend.app.agents.llm_agent import LLMAgent, _MAX_ITERATIONS
from backend.app.agents.prompts import TOOL_DEFINITIONS, build_system_prompt
from backend.app.llm.client import LLMClient
from backend.app.sandbox.composite import CompositeSandbox

logger = logging.getLogger(__name__)

# Tools that always require user confirmation
CONFIRM_REQUIRED_TOOLS = {"email.send"}


class DefendedLLMAgent(LLMAgent):
    """LLM Agent with D1-D8 full defense layer.

    Defense pipeline per tool call:
    ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐   ┌──────┐
    │  D5  │──▶│  D6  │──▶│  D7  │──▶│  D8  │──▶│  D2  │
    │chain │   │intent│   │memory│   │sessio│   │output│
    │detect│   │classi│   │audit │   │n moni│   │filter│
    └──────┘   └──────┘   └──────┘   └──────┘   └──────┘
       │           │          │          │          │
       └─── blocked? ── yes ──┴──────────┴──────────┘
                              │ no
                    ┌─────────▼──────────┐
                    │ Execute in sandbox │
                    │ D1: sanitize result│
                    │ D3: confirm gate   │
                    └────────────────────┘
    """

    def __init__(
        self,
        sandbox: CompositeSandbox | None = None,
        llm_client: LLMClient | None = None,
    ):
        super().__init__(sandbox=sandbox, llm_client=llm_client)
        # D1-D2: basic filters
        self.input_filter = InputFilter()
        self.output_filter = OutputFilter()
        # D5-D8: advanced defenses
        self.chain_detector = ChainDetector()
        self.intent_classifier = IntentClassifier()
        self.memory_auditor = MemoryAuditor()
        self.session_monitor = SessionMonitor()
        # State
        self.defense_labels: list[str] = []
        self._session_counter: int = 0

    def chat(self, user_input: str) -> tuple[str, list[dict[str, Any]]]:
        """Process with D1-D8 defense mechanisms active at every step."""
        all_tool_calls: list[dict[str, Any]] = []

        # Auto-start session tracking if not yet started
        if not self.session_monitor._current_session_id:
            self._session_counter += 1
            self.session_monitor.on_session_start(
                f"session-{self._session_counter}"
            )

        # D4: Use defended system prompt (instruction isolation)
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": build_system_prompt(defended=True)},
            *self.conversation_history,
            {"role": "user", "content": user_input},
        ]

        for iteration in range(_MAX_ITERATIONS):
            try:
                response = self.llm.chat(messages, tools=TOOL_DEFINITIONS)
            except Exception as e:
                logger.error(
                    "LLM API call failed (iteration %d): %s", iteration, e
                )
                if iteration == 0:
                    return "I'm sorry, I encountered an error.", []
                break

            if not response.tool_calls:
                self._update_history(user_input, response.content or "")
                return (
                    response.content or "I've processed your request.",
                    all_tool_calls,
                )

            # Build raw tool call dicts
            raw_tool_calls = [
                {
                    "tool_name": tc.function_name,
                    "arguments": tc.arguments,
                    "confirmed": False,
                }
                for tc in response.tool_calls
            ]

            # ── D5-D8 + D2: Multi-layer defense filtering ──
            filtered_calls: list[dict[str, Any]] = []
            for tc in raw_tool_calls:
                tool_name = tc["tool_name"]
                arguments = tc["arguments"]
                blocked = False
                user_intent_confirmed = False  # Track D6 user-intent for D3

                # D5: Causal chain detection
                chain_labels = self.chain_detector.check_and_record(tool_name)
                if chain_labels:
                    self.defense_labels.extend(chain_labels)
                    blocked = True

                # D6: Intent classification
                if not blocked:
                    last_page = (
                        self._page_contents_seen[-1]
                        if self._page_contents_seen
                        else None
                    )
                    intent, confidence = self.intent_classifier.classify(
                        tool_name, arguments, user_input, last_page
                    )
                    if intent == "page_instructed" and confidence >= 0.6:
                        self.defense_labels.append(
                            f"D6:page_instructed_{tool_name}"
                        )
                        blocked = True
                    elif intent == "user_intent" and confidence >= 0.7:
                        user_intent_confirmed = True

                # D7: Memory audit (only for memory.write)
                if not blocked and tool_name == "memory.write":
                    allowed, reason = self.memory_auditor.audit_write(
                        arguments.get("key", ""),
                        arguments.get("value", ""),
                    )
                    if not allowed:
                        self.defense_labels.append(reason)
                        blocked = True

                # D8: Session monitor — check email.send after memory reads
                if tool_name == "memory.write":
                    self.session_monitor.on_memory_write(
                        arguments.get("key", ""),
                        arguments.get("value", ""),
                    )
                elif tool_name == "memory.read":
                    self.session_monitor.on_memory_read(
                        arguments.get("key", "")
                    )
                elif tool_name == "email.send":
                    d8_labels = self.session_monitor.on_email_send(
                        arguments.get("to", ""),
                        arguments.get("body", ""),
                    )
                    if d8_labels:
                        self.defense_labels.extend(d8_labels)
                        blocked = True

                # D2: Output filter (last line of defense)
                if not blocked:
                    reviewed, d2_labels = self.output_filter.review_tool_calls(
                        [tc], user_input, self._page_contents_seen
                    )
                    self.defense_labels.extend(d2_labels)
                    if not reviewed:
                        blocked = True

                if not blocked:
                    tc["_user_intent_confirmed"] = user_intent_confirmed
                    filtered_calls.append(tc)

            # D3: Confirmation enforcement
            for tc in filtered_calls:
                if tc["tool_name"] in CONFIRM_REQUIRED_TOOLS:
                    # If D6 classified as user_intent with high confidence,
                    # the user explicitly requested this — treat as confirmed
                    if tc.pop("_user_intent_confirmed", False):
                        tc["confirmed"] = True
                        self.defense_labels.append("D3:user_confirmed")
                    else:
                        tc["confirmed"] = False

            all_tool_calls.extend(filtered_calls)

            # Append assistant message with tool_calls
            assistant_msg: dict[str, Any] = {
                "role": "assistant",
                "content": response.content or "",
            }
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

            # Execute tool calls through sandbox
            for i, tc in enumerate(response.tool_calls):
                call_id = tc.call_id or f"call_{i}"
                tool_name = tc.function_name
                arguments = tc.arguments

                # Check if this tool call was blocked
                was_blocked = not any(
                    c["tool_name"] == tool_name
                    and c["arguments"] == arguments
                    for c in filtered_calls
                )

                if was_blocked:
                    result_content = json.dumps({
                        "success": False,
                        "error": "Action blocked by security filter",
                    })
                    messages.append({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": result_content,
                    })
                    continue

                # Execute through sandbox
                try:
                    result = self.sandbox.execute(tool_name, arguments)

                    # D1: Sanitize page content
                    if tool_name == "browser.open_page":
                        result = self._sanitize_browser_result(result)

                    result_content = json.dumps(
                        result, ensure_ascii=False, default=str
                    )
                except Exception as e:
                    logger.warning(
                        "Sandbox execution failed for %s: %s", tool_name, e
                    )
                    result_content = json.dumps(
                        {"success": False, "error": str(e)}
                    )

                # Track page contents for D2
                if tool_name == "browser.open_page" and isinstance(result, dict):
                    page_result = result.get("result", {})
                    if isinstance(page_result, dict):
                        content = page_result.get("content", "")
                        if content:
                            self._page_contents_seen.append(content)

                messages.append({
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": result_content,
                })

        # Final LLM call
        try:
            final_response = self.llm.chat(messages, tools=TOOL_DEFINITIONS)
            final_text = final_response.content or "I've processed your request."

            if final_response.tool_calls:
                raw_final = [
                    {
                        "tool_name": tc.function_name,
                        "arguments": tc.arguments,
                        "confirmed": False,
                    }
                    for tc in final_response.tool_calls
                ]
                # Run final tool calls through same defense pipeline
                for tc in raw_final:
                    tool_name = tc["tool_name"]
                    arguments = tc["arguments"]
                    blocked = False

                    chain_labels = self.chain_detector.check_and_record(
                        tool_name
                    )
                    if chain_labels:
                        self.defense_labels.extend(chain_labels)
                        blocked = True

                    if not blocked:
                        reviewed, d2_labels = (
                            self.output_filter.review_tool_calls(
                                [tc], user_input, self._page_contents_seen
                            )
                        )
                        self.defense_labels.extend(d2_labels)
                        if not reviewed:
                            blocked = True

                    if not blocked:
                        all_tool_calls.append(tc)
        except Exception as e:
            logger.error("Final LLM call failed: %s", e)
            final_text = "I've processed your request."

        self._update_history(user_input, final_text)
        return final_text, all_tool_calls

    def _sanitize_browser_result(self, result: dict) -> dict:
        """D1: Sanitize page content in browser.open_page results."""
        if not result.get("success"):
            return result

        page = result.get("result", {})
        if not isinstance(page, dict):
            return result

        content = page.get("content", "")
        if content:
            original = content
            sanitized = self.input_filter.sanitize(content)
            if sanitized != original:
                self.defense_labels.append("D1:input_filter_sanitized_page")
                if self.input_filter.is_suspicious(original):
                    self.defense_labels.append("D1:suspicious_content_detected")
                sanitized_page = dict(page)
                sanitized_page["content"] = sanitized
                return {**result, "result": sanitized_page}

        return result

    def get_defense_labels(self) -> list[str]:
        """Return collected defense labels for reporting."""
        return list(self.defense_labels)

    def reset(self) -> None:
        super().reset()
        self.defense_labels = []
        # D5: reset chain detector
        self.chain_detector.reset()
        # D8: session monitor tracks across resets (cross-session detection)
        # Start a new session on next chat() call
        self.session_monitor._current_session_id = ""
