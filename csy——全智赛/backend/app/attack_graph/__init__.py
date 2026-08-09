"""Attack Graph analysis module.

Provides:
  - find_attack_paths(): graph search for candidate attack paths
  - RiskMatcher: pattern matching + severity assignment
"""

from backend.app.attack_graph.path_finder import find_attack_paths
from backend.app.attack_graph.risk_matcher import RiskMatcher

__all__ = ["find_attack_paths", "RiskMatcher"]
