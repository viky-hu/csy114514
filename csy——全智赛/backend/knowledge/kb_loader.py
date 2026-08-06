"""Knowledge base loader — Security Line assets from shared/examples/security.

S1-4 format convention: shared JSON is the single source; every object must
validate against its frozen domain model before use. RiskMatcher consumes the
RiskPattern[] loaded here.
"""
from __future__ import annotations

import json
from pathlib import Path

from backend.app.domain.risk_pattern import RiskPattern

_SHARED_SECURITY_DIR = (
    Path(__file__).resolve().parents[2] / "shared" / "examples" / "security"
)
RISK_PATTERNS_FILE = _SHARED_SECURITY_DIR / "risk_patterns.json"


def load_risk_patterns(path: Path | None = None) -> list[RiskPattern]:
    """Load risk_patterns.json into contract-validated RiskPattern objects."""
    target = Path(path) if path is not None else RISK_PATTERNS_FILE
    data = json.loads(target.read_text(encoding="utf-8"))
    return [RiskPattern.model_validate(item) for item in data]