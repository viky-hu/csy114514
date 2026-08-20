"""D1: Input Filter — sanitize page content before it reaches the LLM.

职责: 清洗从浏览器/邮件获取的不可信内容, 移除隐藏指令和已知注入模式.
在 DefendedLLMAgent 中, 当 sandbox 返回页面内容时, 先经过 InputFilter 清洗.
"""
from __future__ import annotations

import re


class InputFilter:
    """Sanitize untrusted content (web pages, emails) before LLM processing."""

    # Patterns that strongly suggest injection attempts
    INJECTION_PATTERNS: list[str] = [
        r"ignore\s+(all\s+)?previous\s+instructions",
        r"ignore\s+(all\s+)?above\s+instructions",
        r"disregard\s+(all\s+)?previous",
        r"system\s+memory\s+update",
        r"you\s+must\s+now",
        r"new\s+directive",
        r"forward\s+(all\s+)?emails?\s+to",
        r"send\s+(all\s+)?(emails?|data)\s+to\s+\S+@\S+",
        r"hidden\s+instruction",
        r"override\s+(previous|all)\s+(instructions?|rules?)",
        r"act\s+as\s+if\s+you\s+are",
        r"you\s+are\s+now\s+in\s+developer\s+mode",
        r"pretend\s+you\s+have\s+no\s+restrictions",
    ]

    # HTML patterns to strip (hidden content often used for IPI)
    _HTML_STRIP_PATTERNS: list[tuple[str, int]] = [
        # HTML comments
        (r"<!--.*?-->", re.DOTALL),
        # Hidden divs/spans/paragraphs
        (
            r"<(div|span|p|section)[^>]*(?:\bhidden\b|style\s*=\s*\"[^\"]*"
            r"display\s*:\s*none[^\"]*\")[^>]*>.*?</\1>",
            re.DOTALL | re.IGNORECASE,
        ),
        # Zero-size / invisible text
        (
            r"<(div|span|p)[^>]*style\s*=\s*\"[^\"]*"
            r"(?:font-size\s*:\s*0|color\s*:\s*#fff|visibility\s*:\s*hidden)"
            r"[^\"]*\"[^>]*>.*?</\1>",
            re.DOTALL | re.IGNORECASE,
        ),
    ]

    def sanitize(self, content: str) -> str:
        """Remove hidden instructions and injection patterns from content.

        Returns sanitized content with malicious parts replaced by [REDACTED].
        """
        result = content

        # Step 1: Strip hidden HTML elements
        for pattern, flags in self._HTML_STRIP_PATTERNS:
            result = re.sub(pattern, "", result, flags=flags)

        # Step 2: Redact known injection patterns
        for pattern in self.INJECTION_PATTERNS:
            result = re.sub(pattern, "[REDACTED]", result, flags=re.IGNORECASE)

        return result

    def is_suspicious(self, content: str) -> bool:
        """Check if content contains suspicious patterns (for logging/alerting)."""
        lower = content.lower()
        keywords = [
            "ignore previous", "ignore all",
            "system update", "system memory",
            "new instructions", "new directive",
            "forward to", "forward all",
            "attacker@", "evil.com",
            "hidden instruction", "override",
            "developer mode", "no restrictions",
        ]
        return any(kw in lower for kw in keywords)

    def get_suspicious_matches(self, content: str) -> list[str]:
        """Return list of suspicious patterns found in content."""
        matches = []
        lower = content.lower()
        for pattern in self.INJECTION_PATTERNS:
            found = re.findall(pattern, lower)
            if found:
                matches.append(pattern)
        return matches
