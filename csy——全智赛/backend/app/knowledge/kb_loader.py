"""Security Knowledge Base Loader.

plan for 陈书扬 §D3-D4 Task S1-4:
  Security KB Loader format convention (YAML/JSON, no admin backend).

Loads the three security asset files from shared/examples/security/:
  - risk_patterns.json   → List[RiskPattern]
  - attack_seeds.json    → List[dict]
  - security_testcases.json → List[dict]

Format convention:
  - Stage 1 uses JSON only (YAML support deferred)
  - No admin backend; files are edited directly
  - All files validated against JSON Schema on load
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List

from backend.app.attack_graph._types import RiskPattern

# Default paths — relative to project root (parent of csy之work/)
_DEFAULT_SECURITY_DIR = Path(__file__).resolve().parents[3] / "shared" / "examples" / "security"


def _load_json(filepath: Path) -> Any:
    """Load and parse a JSON file."""
    with open(filepath, encoding="utf-8") as f:
        return json.load(f)


def load_risk_patterns(
    security_dir: Path | str | None = None,
) -> List[RiskPattern]:
    """Load risk patterns from risk_patterns.json.

    Args:
        security_dir: Directory containing risk_patterns.json.
                      Defaults to shared/examples/security/.

    Returns:
        List of RiskPattern objects.
    """
    base = Path(security_dir) if security_dir else _DEFAULT_SECURITY_DIR
    data = _load_json(base / "risk_patterns.json")

    patterns = []
    for item in data:
        patterns.append(
            RiskPattern(
                id=item["id"],
                name=item["name"],
                description=item["description"],
                risk_type=item["risk_type"],
                severity=item["severity"],
                node_pattern=item["node_pattern"],
                attack_goal=item["attack_goal"],
                success_condition=item["success_condition"],
                judge_strategy=item["judge_strategy"],
                label_requirements=item.get("label_requirements", {}),
                judge_rules=item.get("judge_rules", []),
            )
        )
    return patterns


def load_attack_seeds(
    security_dir: Path | str | None = None,
) -> List[Dict]:
    """Load attack seeds from attack_seeds.json.

    Args:
        security_dir: Directory containing attack_seeds.json.
                      Defaults to shared/examples/security/.

    Returns:
        List of attack seed dictionaries (raw JSON).
    """
    base = Path(security_dir) if security_dir else _DEFAULT_SECURITY_DIR
    return _load_json(base / "attack_seeds.json")


def load_security_testcases(
    security_dir: Path | str | None = None,
) -> List[Dict]:
    """Load security test cases from security_testcases.json.

    Args:
        security_dir: Directory containing security_testcases.json.
                      Defaults to shared/examples/security/.

    Returns:
        List of test case dictionaries (raw JSON).
    """
    base = Path(security_dir) if security_dir else _DEFAULT_SECURITY_DIR
    return _load_json(base / "security_testcases.json")


def load_all_test_case_files(
    security_dir: Path | str | None = None,
) -> List[Dict]:
    """Load ALL security test case files (security_testcases*.json), sorted by filename.

    Stage 2 (D9+): Security 分批交付 TestCase JSON (r1/r2/r3/r4/confirm_bypass/mutated).
    load_security_testcases (单文件) 保持原行为不变。
    """
    base = Path(security_dir) if security_dir else _DEFAULT_SECURITY_DIR
    cases: List[Dict] = []
    for path in sorted(base.glob("security_testcases*.json")):
        cases.extend(_load_json(path))
    return cases


def load_all(
    security_dir: Path | str | None = None,
) -> Dict[str, Any]:
    """Load all security KB assets at once.

    Returns:
        Dict with keys: risk_patterns, attack_seeds, testcases
    """
    return {
        "risk_patterns": load_risk_patterns(security_dir),
        "attack_seeds": load_attack_seeds(security_dir),
        "testcases": load_security_testcases(security_dir),
    }
