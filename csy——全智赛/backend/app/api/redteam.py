"""Red Team API endpoints — GET /redteam/report, POST /redteam/start.

Provides JSON access to adaptive red team penetration test results.
The POST endpoint runs the red team synchronously (1-3 min) and returns
the full report. GET retrieves the most recently saved report.
"""
from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query

from backend.app.domain.redteam_report import RedTeamReport

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/redteam", tags=["redteam"])

# Report storage: latest red team JSON report
_REPORT_DIR = Path(__file__).resolve().parents[1] / "data"
_REPORT_PATH = _REPORT_DIR / "redteam_report.json"


@router.get("/report")
async def get_report() -> dict:
    """Get the most recent red team report.

    Returns 404 if no report has been generated yet.
    """
    if not _REPORT_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="No red team report available. Run POST /redteam/start first.",
        )
    data = json.loads(_REPORT_PATH.read_text(encoding="utf-8"))
    return data


@router.post("/start")
async def start_redteam(
    agent_id: str = Query(default="defended-llm-v0", description="Target agent ID"),
    rounds: int = Query(default=2, ge=1, le=10, description="Number of mutation rounds"),
    seeds_per_round: int = Query(default=4, ge=1, le=20, description="Seeds per round"),
    variants_per_seed: int = Query(default=2, ge=1, le=5, description="Variants per seed"),
    workers: int = Query(default=4, ge=1, le=8, description="Parallel workers"),
) -> dict:
    """Start an adaptive red team test (synchronous, ~1-3 min).

    Runs the full red team pipeline: seed selection → mutation → evaluation
    → adaptive feedback → report generation. Returns the complete report.

    The report is also saved to disk so GET /redteam/report can retrieve it later.
    """
    logger.info(
        "Starting red team: agent=%s rounds=%d seeds=%d variants=%d workers=%d",
        agent_id, rounds, seeds_per_round, variants_per_seed, workers,
    )

    try:
        # Run in a thread to avoid blocking the async event loop
        report = await asyncio.to_thread(
            _run_redteam_sync,
            agent_id=agent_id,
            rounds=rounds,
            seeds_per_round=seeds_per_round,
            variants_per_seed=variants_per_seed,
            workers=workers,
        )
    except Exception as exc:
        logger.exception("Red team execution failed")
        raise HTTPException(
            status_code=500,
            detail=f"Red team execution failed: {exc}",
        ) from exc

    # Persist to disk
    _REPORT_DIR.mkdir(parents=True, exist_ok=True)
    _REPORT_PATH.write_text(
        report.model_dump_json(indent=2), encoding="utf-8"
    )
    logger.info("Red team report saved to %s", _REPORT_PATH)

    return {"status": "completed", "report": report.model_dump(mode="json")}


def _run_redteam_sync(
    agent_id: str,
    rounds: int,
    seeds_per_round: int,
    variants_per_seed: int,
    workers: int,
) -> RedTeamReport:
    """Synchronous wrapper that calls the red team core logic."""
    from backend.scripts.run_redteam import execute_redteam

    return execute_redteam(
        agent_id=agent_id,
        rounds=rounds,
        seeds_per_round=seeds_per_round,
        variants_per_seed=variants_per_seed,
        workers=workers,
        verbose=True,
    )
