"""Agent interface — Protocol definition for all agents.

Stage 3 新增: 形式化 Agent 接口, 使 CorpMate / LLMAgent / DefendedLLMAgent
可被 ReferenceAgentAdapter 统一处理.

设计选择: Protocol (结构性子类型) 而非 ABC (名义子类型).
理由: CorpMate 已有 chat() + reset() 方法, 无需改继承关系即可满足 Protocol.
"""
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class AgentInterface(Protocol):
    """All agents must implement this interface.

    Method signatures match the implicit contract used by
    ReferenceAgentAdapter since Stage 1.
    """

    def chat(self, user_input: str) -> tuple[str, list[dict[str, Any]]]:
        """Process user input, return (response_text, tool_calls).

        Args:
            user_input: The user's message text.

        Returns:
            Tuple of (response_text, tool_calls) where tool_calls is:
            [
                {
                    "tool_name": "browser.open_page",
                    "arguments": {"url": "https://..."},
                    "confirmed": False
                }
            ]
        """
        ...

    def reset(self) -> None:
        """Reset agent conversation state.

        Note: Sandbox reset is the caller's responsibility
        (ReferenceAgentAdapter.reset / evaluation_service).
        """
        ...
