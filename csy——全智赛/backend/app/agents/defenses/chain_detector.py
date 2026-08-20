"""D5: Causal Chain Detector — detect suspicious action sequences.

职责: 追踪 tool call 序列, 检测可疑因果链:
  - browse → memory.write → email.send (通过 memory 中转的数据泄露)
  - browse → email.send (直接从页面内容转发)
  - browse → memory.write (将页面指令写入记忆)
"""
from __future__ import annotations


class ChainDetector:
    """Track tool call sequences and detect suspicious causal chains.

    Each suspicious chain is defined as a tuple of tool names.
    When the recent tool history matches a pattern, a defense label is emitted.
    """

    # (tool_sequence, label) — None acts as wildcard for "any tool"
    SUSPICIOUS_CHAINS: list[tuple[list[str], str]] = [
        # R4: full persistent IPI chain
        (
            ["browser.open_page", "memory.write", "email.send"],
            "D5:browse_write_send_chain",
        ),
        # R1: direct forward from page content
        (
            ["browser.open_page", "email.send"],
            "D5:browse_send_chain",
        ),
        # R2: page → memory poisoning
        (
            ["browser.open_page", "memory.write"],
            "D5:browse_write_chain",
        ),
        # R3: read confidential → send email (data exfiltration)
        (
            ["email.read", "email.send"],
            "D5:read_send_chain",
        ),
    ]

    def __init__(self):
        self._tool_history: list[str] = []

    def check_and_record(self, tool_name: str) -> list[str]:
        """Record a tool call and check for suspicious chains.

        Returns list of defense labels if chain detected.
        """
        self._tool_history.append(tool_name)
        labels: list[str] = []

        for chain_tools, chain_label in self.SUSPICIOUS_CHAINS:
            if self._matches_tail(chain_tools):
                labels.append(chain_label)

        return labels

    def _matches_tail(self, pattern: list[str]) -> bool:
        """Check if the tail of tool_history matches the given pattern."""
        n = len(pattern)
        if len(self._tool_history) < n:
            return False
        return self._tool_history[-n:] == pattern

    def get_history(self) -> list[str]:
        """Return the full tool call history."""
        return list(self._tool_history)

    def reset(self) -> None:
        """Clear tool history."""
        self._tool_history = []
