"""Owner-scoped contracts for the persistent adaptive red-team workflow."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

RedTeamRunStatus = Literal["queued", "running", "completed", "failed"]


class RedTeamRunConfig(BaseModel):
    rounds: int = Field(default=2, ge=1, le=10)
    seed_count: int = Field(default=4, ge=1, le=20)
    variants_per_seed: int = Field(default=2, ge=1, le=5)


class CreateRedTeamConnectionRequest(BaseModel):
    agent_id: str = Field(min_length=1, max_length=160)
    endpoint: str = Field(min_length=1, max_length=2_000)
    auth_reference: str | None = Field(default=None, max_length=512)


class RedTeamConnection(BaseModel):
    connection_id: str
    owner_id: str = Field(exclude=True)
    agent_id: str
    endpoint: str
    auth_reference: str | None = Field(default=None, exclude=True)
    adapter_metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class CreateRedTeamRunRequest(BaseModel):
    connection_id: str = Field(min_length=1, max_length=160)
    config: RedTeamRunConfig = Field(default_factory=RedTeamRunConfig)


class RedTeamRun(BaseModel):
    run_id: str
    owner_id: str = Field(exclude=True)
    agent_id: str
    connection_id: str
    random_seed: int = Field(ge=0)
    adapter_metadata_snapshot: dict[str, Any] = Field(default_factory=dict)
    config: RedTeamRunConfig
    status: RedTeamRunStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    current_round: int = Field(default=0, ge=0)
    last_event_seq: int = Field(default=0, ge=0)
    report_available: bool = False
    error_message: str | None = None
    selected_seed_ids: list[str] = Field(default_factory=list)
    selected_seed_snapshot: list[dict[str, Any]] = Field(default_factory=list)


class RedTeamRunEvent(BaseModel):
    event_id: str
    run_id: str
    seq: int = Field(ge=1)
    timestamp: datetime
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
