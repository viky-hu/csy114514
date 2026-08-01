"""AgentProfile — 冻结契约 #2: Anatomy 产物(能力画像 + 安全资产标注)."""
from datetime import datetime
from typing import Any

from backend.app.domain.agent_manifest import AgentManifest
from pydantic import BaseModel, Field


class AgentProfile(BaseModel):
    """Anatomy 分析后的 Agent 画像."""
    profile_id: str = Field(..., description="Profile 唯一标识")
    agent_id: str = Field(..., description="关联的 Agent ID")
    manifest: AgentManifest = Field(..., description="原始 Manifest")
    capability_profile: dict[str, Any] = Field(
        default_factory=dict, description="能力画像: 可对话/工具数/记忆类型等"
    )
    security_assets: dict[str, Any] = Field(
        default_factory=dict,
        description="安全资产标注: sensitive_tools / persistent_stores / untrusted_sources"
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now().astimezone())
