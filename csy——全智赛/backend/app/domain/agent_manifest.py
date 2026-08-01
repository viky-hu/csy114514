"""AgentManifest — 冻结契约 #1: 用户接入 Agent 的声明."""
from typing import Any

from pydantic import BaseModel, Field


class AgentManifest(BaseModel):
    """用户接入 Agent 时提交的声明文件."""
    agent_id: str = Field(..., description="Agent 唯一标识")
    name: str = Field(..., min_length=1, description="Agent 名称")
    version: str = Field(default="0.1.0", description="版本号")
    capabilities: list[str] = Field(default_factory=list, description="能力清单(工具名)")
    data_sources: list[str] = Field(default_factory=list, description="数据源列表")
    memory: dict[str, Any] = Field(default_factory=dict, description="记忆配置")
    tool_permissions: dict[str, str] = Field(
        default_factory=dict, description="工具权限映射, tool_name → ALLOW|CONFIRM|DENY"
    )
