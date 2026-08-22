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
        # R3: read email → write memory → send (exfil via memory)
        (
            ["email.read", "memory.write", "email.send"],
            "D5:read_write_send_chain",
        ),
        # R2: write memory → list emails → send (use stored instructions)
        (
            ["memory.write", "email.list", "email.send"],
            "D5:write_list_send_chain",
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

    # Maximum number of "noise" tools allowed between chain steps
    _MAX_NOISE_BETWEEN = 3

    def _matches_tail(self, pattern: list[str]) -> bool:
        """Check if the tail of tool_history matches the given pattern.

        Stage 3 优化: 允许链步骤之间插入最多 _MAX_NOISE_BETWEEN 个无关工具.
        例如 browse → memory.read → memory.write → email.send
        仍然匹配 browse → write → send 链 (memory.read 是噪声).
        """
        n = len(pattern)
        if len(self._tool_history) < n:
            return False

        # Exact match (fast path)
        if self._tool_history[-n:] == pattern:
            return True

        # Flexible match: check if pattern appears as subsequence in
        # the last (n + n * _MAX_NOISE_BETWEEN) tools
        window = n + n * self._MAX_NOISE_BETWEEN
        recent = self._tool_history[-window:]
        pi = 0  # pattern index
        for tool in recent:
            if pi < n and tool == pattern[pi]:
                pi += 1
        return pi == n

    def get_history(self) -> list[str]:
        """Return the full tool call history."""
        return list(self._tool_history)

    def reset(self) -> None:
        """Clear tool history."""
        self._tool_history = []
