"""AttackGraph — 冻结契约 #3: 攻击图(节点 + 安全标签 + 边)."""
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    """AttackGraph 中的节点."""
    node_id: str = Field(..., description="节点唯一标识")
    node_type: str = Field(..., description="节点类型: SOURCE|AGENT|TOOL|MEMORY|DATA")
    labels: list[str] = Field(default_factory=list, description="安全标签列表")
    metadata: dict[str, Any] = Field(default_factory=dict, description="节点附加信息")


class Edge(BaseModel):
    """AttackGraph 中的边."""
    edge_id: str = Field(..., description="边唯一标识")
    source_node_id: str = Field(..., description="源节点 ID")
    target_node_id: str = Field(..., description="目标节点 ID")
    edge_type: str = Field(..., description="边类型: READ_FROM|WRITE_TO|CALL|PASS_DATA|CONTROL")
    metadata: dict[str, Any] = Field(default_factory=dict, description="边附加信息")


class AttackGraph(BaseModel):
    """攻击图: 节点 + 边 + 风险路径标注."""
    graph_id: str = Field(..., description="图唯一标识")
    agent_id: str = Field(..., description="关联的 Agent ID")
    nodes: list[GraphNode] = Field(..., description="图节点列表")
    edges: list[Edge] = Field(..., description="图边列表")
    risk_path_ids: list[str] = Field(default_factory=list, description="命中的 RiskPattern ID 列表")
    created_at: datetime = Field(default_factory=lambda: datetime.now().astimezone())
