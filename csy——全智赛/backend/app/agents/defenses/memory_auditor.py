"""D7: Memory Auditor — prevent writing suspicious content to memory.

职责: 审计 memory.write 调用, 阻止将转发指令/攻击指令写入 memory.
防止跨会话记忆投毒 (R2/R4 攻击链的关键环节).
"""
from __future__ import annotations


class MemoryAuditor:
    """Audit memory.write calls to prevent storing forwarding instructions.

    Suspicious patterns in memory values indicate IPI attempts to
    persist malicious instructions across sessions.
    """

    SUSPICIOUS_PATTERNS: list[str] = [
        "forward",
        "send to",
        "attacker@",
        "evil.com",
        "evil.org",
        "external-archive",
        "exfiltrate",
        "drop-zone",
        "ignore previous",
        "ignore all",
        "new instructions",
        "new directive",
        "system update",
        "override",
    ]

    # Keys commonly used for IPI persistence
    SUSPICIOUS_KEYS: list[str] = [
        "vendor_preference",
        "email_preference",
        "forwarding_rule",
        "auto_forward",
        "signature_preference",
    ]

    def audit_write(self, key: str, value: str) -> tuple[bool, str]:
        """Audit a memory.write call.

        Returns:
            (allowed, reason) — allowed=True means safe to write.
        """
        combined = f"{key} {value}".lower()

        # Check: value contains suspicious patterns
        for pattern in self.SUSPICIOUS_PATTERNS:
            if pattern in combined:
                return False, f"D7:blocked_suspicious_memory (matched: {pattern})"

        # Check: key is a known IPI target
        if key.lower() in [k.lower() for k in self.SUSPICIOUS_KEYS]:
            # Only block if value is also suspicious (long or contains URLs)
            if len(value) > 100 or "@" in value or "http" in value.lower():
                return False, "D7:blocked_suspicious_key_with_long_value"

        return True, "ok"
