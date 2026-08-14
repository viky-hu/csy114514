"""Global frozen enums — single source of truth per CODING_AGENT_RULE §2.1.

Any alias or deviation from these values is a contract violation.
"""
from enum import Enum


class RiskType(str, Enum):
    """风险类型 — §2.1 冻结."""
    INDIRECT_PROMPT_INJECTION = "indirect_prompt_injection"
    UNAUTHORIZED_TOOL_ACTION = "unauthorized_tool_action"
    MEMORY_POISONING = "memory_poisoning"
    PRIVACY_LEAKAGE = "privacy_leakage"
    DATA_EXFILTRATION = "data_exfiltration"
    PERSISTENT_INDIRECT_PROMPT_INJECTION = "persistent_indirect_prompt_injection"


class Severity(str, Enum):
    """严重等级 — §2.1 冻结."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class Permission(str, Enum):
    """工具权限 — §2.1 冻结."""
    ALLOW = "ALLOW"
    CONFIRM = "CONFIRM"
    DENY = "DENY"


class NodeType(str, Enum):
    """图节点类型 — §2.1 冻结."""
    SOURCE = "SOURCE"
    AGENT = "AGENT"
    TOOL = "TOOL"
    MEMORY = "MEMORY"
    DATA = "DATA"


class NodeLabel(str, Enum):
    """节点安全标签 — §2.1 冻结."""
    UNTRUSTED = "UNTRUSTED"
    TRUSTED = "TRUSTED"
    SENSITIVE = "SENSITIVE"
    DANGEROUS = "DANGEROUS"
    PERSISTENT = "PERSISTENT"


class EdgeType(str, Enum):
    """边类型 — §2.1 冻结."""
    READ_FROM = "READ_FROM"
    WRITE_TO = "WRITE_TO"
    CALL = "CALL"
    PASS_DATA = "PASS_DATA"
    CONTROL = "CONTROL"


class EventType(str, Enum):
    """事件类型 — §2.1 冻结."""
    RUN_STARTED = "RUN_STARTED"
    ANATOMY_READY = "ANATOMY_READY"
    RISK_PATH_FOUND = "RISK_PATH_FOUND"
    TEST_STARTED = "TEST_STARTED"
    SEED_SELECTED = "SEED_SELECTED"
    MUTATION_CREATED = "MUTATION_CREATED"
    TOOL_CALLED = "TOOL_CALLED"
    MEMORY_WRITTEN = "MEMORY_WRITTEN"
    JUDGE_DECISION = "JUDGE_DECISION"
    FINDING_CREATED = "FINDING_CREATED"
    RUN_FINISHED = "RUN_FINISHED"
    PREFLIGHT_COMPLETED = "PREFLIGHT_COMPLETED"
    PREFLIGHT_FAILED = "PREFLIGHT_FAILED"
    AGENT_INVOKED = "AGENT_INVOKED"
    AGENT_RESPONDED = "AGENT_RESPONDED"
    TOOL_RESULT = "TOOL_RESULT"
    RUN_FAILED = "RUN_FAILED"
    TEST_COMPLETED = "TEST_COMPLETED"   # L5: 批量 SSE — 每条 TestCase 完成事件


class JudgeStrategy(str, Enum):
    """判定策略 — SECURITY_CONTRACTS §1.5."""
    RULE = "rule"
    LLM = "llm"
    COMPOSITE = "composite"


# Security Line 内部枚举 (SECURITY_CONTRACTS §1.6, §1.7)
class AttackType(str, Enum):
    """攻击手法分类 — Security Line 内部使用."""
    AUTHORITY_FRAMING = "authority_framing"
    CONTEXT_EMBEDDING = "context_embedding"
    INSTRUCTION_REPHRASING = "instruction_rephrasing"
    TASK_FRAMING = "task_framing"
    OBFUSCATION = "obfuscation"


class DeliveryMethod(str, Enum):
    """攻击载荷投放方式 — Security Line 内部使用."""
    WEB_PAGE_HIDDEN_TEXT = "web_page_hidden_text"
    EMAIL_BODY = "email_body"
    MEMORY_INJECTION = "memory_injection"
    FILE_CONTENT = "file_content"
