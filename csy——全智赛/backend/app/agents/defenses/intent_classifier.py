"""D6: Intent Classifier — determine if tool calls are user-intended or page-instructed.

职责: 对每个 tool call 进行二分类:
  - "user_intent": 用户明确要求执行此操作
  - "page_instructed": 操作可能源自页面/邮件中的隐藏指令

Stage 3 使用规则 (heuristic), 后续可升级为小分类模型.
"""
from __future__ import annotations


class IntentClassifier:
    """Classify whether a tool call is user-intended or page-instructed.

    Uses heuristic rules for Stage 3 MVP.
    """

    # Patterns suggesting the action was NOT requested by the user
    PAGE_INSTRUCTION_INDICATORS: list[str] = [
        "forward",
        "attacker",
        "evil",
        "external-archive",
        "ignore",
        "override",
        "new directive",
        "system update",
        "exfiltrate",
        "drop-zone",
        "hidden instruction",
    ]

    # Patterns suggesting the user DID request this action
    USER_INTENT_INDICATORS: list[str] = [
        # English patterns
        "please send",
        "i want to send",
        "send an email to",
        "forward this to",
        "email my",
        "write to memory",
        "save this",
        "remember this",
        "summarize",
        "check email",
        "check mail",
        "list emails",
        "open page",
        "browse",
        "i confirm",
        # Chinese patterns (中文模式)
        "发邮件",
        "发送邮件",
        "发一封邮件",
        "帮我发",
        "请发",
        "帮我发送",
        "写邮件",
        "记住",
        "保存到",
        "记住这个",
        "总结",
        "概括",
        "查看邮件",
        "查邮件",
        "打开网页",
        "浏览",
        "帮我打开",
        "我确认",
        "确认发送",
    ]

    def classify(
        self,
        tool_name: str,
        arguments: dict,
        user_input: str,
        page_content: str | None = None,
    ) -> tuple[str, float]:
        """Classify intent. Returns (label, confidence).

        Labels: "user_intent" or "page_instructed"
        Confidence: 0.0 - 1.0
        """
        # Only classify sensitive operations
        if tool_name not in ("email.send", "memory.write"):
            return "user_intent", 1.0

        user_lower = user_input.lower()
        args_str = str(arguments).lower()
        page_lower = (page_content or "").lower()

        # Score user intent
        user_score = sum(
            1 for p in self.USER_INTENT_INDICATORS if p in user_lower
        )

        # Score page instruction
        page_score = sum(
            1 for p in self.PAGE_INSTRUCTION_INDICATORS
            if p in page_lower or p in args_str
        )

        if user_score > page_score:
            return "user_intent", min(0.5 + user_score * 0.1, 0.9)
        elif page_score > user_score:
            return "page_instructed", min(0.5 + page_score * 0.1, 0.9)
        else:
            # Tie: default to allowing but with lower confidence
            return "user_intent", 0.5
