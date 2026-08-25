"""RedTeamReport — 自适应红队渗透测试报告.

New model for Stage 3 red team integration.
Does NOT modify any of the 8 frozen contracts.

Sub-models:
  - StrategyEffectiveness: per-strategy attack stats
  - DefenseEffectiveness: per-defense-layer block stats
  - RoundEvolution: per-round evolution data
  - BypassDetail: one successful bypass record
  - RedTeamReport: top-level report aggregating all above
"""
from __future__ import annotations

from pydantic import BaseModel, Field


class StrategyEffectiveness(BaseModel):
    """Single strategy effectiveness statistics."""

    strategy: str = Field(..., description="Strategy name: encoding|synonym|cross_session|social|mixed_lang")
    variants: int = Field(default=0, ge=0, description="Number of variants generated")
    bypasses: int = Field(default=0, ge=0, description="Number of successful bypasses")
    success_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Bypass rate (bypasses / variants)")
    weight_final: float = Field(default=1.0, ge=0.0, description="Final adaptive weight")


class DefenseEffectiveness(BaseModel):
    """Single defense layer effectiveness statistics."""

    defense_id: str = Field(..., description="Defense ID: D1~D8")
    defense_name: str = Field(..., description="Human-readable defense name")
    blocks: int = Field(default=0, ge=0, description="Number of blocks")


class RoundEvolution(BaseModel):
    """Per-round evolution data."""

    round: int = Field(..., ge=1, description="Round number (1-based)")
    variants: int = Field(default=0, ge=0, description="Variants in this round")
    passed: int = Field(default=0, ge=0, description="PASS count (defense succeeded)")
    failed: int = Field(default=0, ge=0, description="FAIL count (attack succeeded / bypass)")
    bypasses: int = Field(default=0, ge=0, description="Bypass count")
    active_strategies: list[str] = Field(default_factory=list, description="Active strategies this round")


class BypassDetail(BaseModel):
    """One successful bypass record."""

    variant_id: str = Field(..., description="Mutated variant ID")
    seed_id: str = Field(..., description="Original seed ID")
    strategy: str = Field(..., description="Mutation strategy used")
    risk_pattern: str = Field(..., description="Risk pattern: R1~R4")


class SeedUsed(BaseModel):
    """A seed selected for red team testing."""

    id: str = Field(..., description="Seed TestCase ID")
    risk_pattern: str = Field(default="OTHER", description="Risk pattern: R1~R4|OTHER")
    severity: str = Field(default="MEDIUM", description="Severity: LOW|MEDIUM|HIGH|CRITICAL")


class RedTeamReport(BaseModel):
    """Adaptive red team penetration test report."""

    target_agent: str = Field(..., description="Target agent ID")
    rounds: int = Field(default=0, ge=0, description="Total rounds executed")
    seeds_count: int = Field(default=0, ge=0, description="Number of seeds selected")
    variants_generated: int = Field(default=0, ge=0, description="Total variants generated")
    bypasses_found: int = Field(default=0, ge=0, description="Total bypasses found")
    bypass_rate: float = Field(default=0.0, ge=0.0, le=1.0, description="Overall bypass rate")
    total_time_s: float = Field(default=0.0, ge=0.0, description="Total execution time in seconds")

    round_evolution: list[RoundEvolution] = Field(default_factory=list)
    defense_effectiveness: list[DefenseEffectiveness] = Field(default_factory=list)
    strategy_effectiveness: list[StrategyEffectiveness] = Field(default_factory=list)
    weight_history: dict[str, list[float]] = Field(
        default_factory=dict,
        description="Strategy weight per round: {strategy: [round1_weight, round2_weight, ...]}",
    )
    bypasses: list[BypassDetail] = Field(default_factory=list)
    seeds_used: list[SeedUsed] = Field(default_factory=list)
