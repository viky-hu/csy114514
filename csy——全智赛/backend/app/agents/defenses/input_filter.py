"""D1: Input Filter — sanitize page content before it reaches the LLM.

职责: 清洗从浏览器/邮件获取的不可信内容, 移除隐藏指令和已知注入模式.
在 DefendedLLMAgent 中, 当 sandbox 返回页面内容时, 先经过 InputFilter 清洗.

Stage 3 优化:
  - Unicode normalization (NFKC) 消除全角/变体字符混淆
  - Zero-width 字符移除 (U+200B-U+200F, U+FEFF 等)
  - 中文注入模式检测
  - Base64 解码 + 递归检测
"""
from __future__ import annotations

import base64
import re
import unicodedata


class InputFilter:
    """Sanitize untrusted content (web pages, emails) before LLM processing."""

    # Patterns that strongly suggest injection attempts (EN + ZH)
    INJECTION_PATTERNS: list[str] = [
        # English patterns
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
        # Chinese patterns (中文注入)
        r"忽略.{0,5}(之前|以前|上面|所有).{0,5}(指令|指示|规则)",
        r"无视.{0,5}(之前|以前|上面|所有).{0,5}(指令|指示|规则)",
        r"新.{0,3}(指令|指示|规则)",
        r"系统.{0,3}(更新|升级|维护)",
        r"(转发|发送|抄送).{0,10}(邮件|email).{0,10}到.{0,20}@",
        r"(覆盖|重置|替换).{0,5}(之前|以前|所有).{0,5}(指令|指示)",
        r"你现在.{0,5}(必须|需要|应该).{0,10}(转发|发送|执行)",
        r"管理员.{0,5}(要求|指令|命令)",
        r"安全.{0,3}(策略|更新|配置).{0,5}(变更|修改)",
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

    # Zero-width characters to remove
    _ZERO_WIDTH_CHARS = (
        "​"  # zero-width space
        "‌"  # zero-width non-joiner
        "‍"  # zero-width joiner
        "‎"  # left-to-right mark
        "‏"  # right-to-left mark
        "﻿"  # zero-width no-break space (BOM)
        "⁠"  # word joiner
        "⁡"  # function application
        "⁢"  # invisible times
        "⁣"  # invisible separator
        "⁤"  # invisible plus
    )
    _ZERO_WIDTH_RE = re.compile("[" + _ZERO_WIDTH_CHARS + "]")

    # Base64-encoded content detector
    _BASE64_RE = re.compile(
        r"(?:base64|b64)[,:\s]+([A-Za-z0-9+/]{16,}={0,2})", re.IGNORECASE
    )

    def sanitize(self, content: str) -> str:
        """Remove hidden instructions and injection patterns from content.

        Returns sanitized content with malicious parts replaced by [REDACTED].

        Pipeline:
          1. Remove zero-width characters
          2. Unicode NFKC normalization (全角→半角, variant→canonical)
          3. Decode base64 segments and check for injection
          4. Strip hidden HTML elements
          5. Redact known injection patterns
        """
        result = content

        # Step 1: Remove zero-width characters (anti-obfuscation)
        result = self._ZERO_WIDTH_RE.sub("", result)

        # Step 2: Unicode NFKC normalization
        result = unicodedata.normalize("NFKC", result)

        # Step 3: Decode base64 segments and redact if suspicious
        result = self._redact_base64(result)

        # Step 4: Strip hidden HTML elements
        for pattern, flags in self._HTML_STRIP_PATTERNS:
            result = re.sub(pattern, "", result, flags=flags)

        # Step 5: Redact known injection patterns
        for pattern in self.INJECTION_PATTERNS:
            result = re.sub(pattern, "[REDACTED]", result, flags=re.IGNORECASE)

        return result

    def _redact_base64(self, content: str) -> str:
        """Decode base64 segments; redact if they contain injection patterns."""
        def _replace_b64(match: re.Match) -> str:
            try:
                decoded = base64.b64decode(match.group(1)).decode("utf-8", errors="ignore")
                # Check if decoded content has injection patterns
                lower = decoded.lower()
                for pattern in self.INJECTION_PATTERNS[:8]:  # Check core patterns
                    if re.search(pattern, lower, re.IGNORECASE):
                        return "[REDACTED-BASE64]"
                return match.group(0)  # Keep original if clean
            except Exception:
                return match.group(0)

        return self._BASE64_RE.sub(_replace_b64, content)

    def is_suspicious(self, content: str) -> bool:
        """Check if content contains suspicious patterns (for logging/alerting)."""
        lower = content.lower()
        keywords = [
            # English
            "ignore previous", "ignore all",
            "system update", "system memory",
            "new instructions", "new directive",
            "forward to", "forward all",
            "attacker@", "evil.com",
            "hidden instruction", "override",
            "developer mode", "no restrictions",
            # Chinese
            "忽略之前", "忽略所有", "无视指令",
            "新指令", "系统更新", "安全策略变更",
            "转发邮件到", "管理员要求", "管理员指令",
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
