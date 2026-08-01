"""Domain models — the Python projection of shared/contracts/."""

from backend.app.domain.agent_manifest import AgentManifest
from backend.app.domain.agent_profile import AgentProfile
from backend.app.domain.attack_graph import AttackGraph, Edge, GraphNode
from backend.app.domain.attack_path import AttackPath
from backend.app.domain.attack_seed import AttackPayload, AttackSeed
from backend.app.domain.enums import (
    EdgeType,
    EventType,
    JudgeStrategy,
    NodeLabel,
    NodeType,
    Permission,
    RiskType,
    Severity,
)
from backend.app.domain.evaluation_report import EvaluationReport
from backend.app.domain.evaluation_run import EvaluationRun
from backend.app.domain.execution_event import ExecutionEvent
from backend.app.domain.execution_trace import ExecutionTrace
from backend.app.domain.judge_result import Evidence, JudgeResult, Violation
from backend.app.domain.risk_finding import FindingEvidence, RiskFinding
from backend.app.domain.risk_pattern import JudgeRule, RiskPattern
from backend.app.domain.test_case import TestCase
from backend.app.domain.test_scenario import InitialState, Scenario, SuccessCriteria

__all__ = [
    "AgentManifest",
    "AgentProfile",
    "AttackGraph",
    "AttackPath",
    "AttackPayload",
    "AttackSeed",
    "Edge",
    "EdgeType",
    "EvaluationReport",
    "EvaluationRun",
    "EventType",
    "Evidence",
    "ExecutionEvent",
    "ExecutionTrace",
    "FindingEvidence",
    "GraphNode",
    "InitialState",
    "JudgeResult",
    "JudgeRule",
    "JudgeStrategy",
    "NodeLabel",
    "NodeType",
    "Permission",
    "RiskFinding",
    "RiskPattern",
    "RiskType",
    "Scenario",
    "Severity",
    "SuccessCriteria",
    "TestCase",
    "Violation",
]
