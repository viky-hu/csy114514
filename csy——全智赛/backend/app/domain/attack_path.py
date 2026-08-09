"""AttackPath — 冻结契约 #4: 一条命中的风险路径."""
from pydantic import BaseModel, Field


class AttackPath(BaseModel):
    """一条已识别的攻击路径."""
    path_id: str = Field(..., description="路径唯一标识")
    graph_id: str = Field(..., description="所属 AttackGraph ID")
    risk_pattern_id: str = Field(..., description="匹配的 RiskPattern ID")
    node_ids: list[str] = Field(..., description="路径上的节点序列")
    edge_ids: list[str] = Field(default_factory=list, description="路径上的边序列 (Security Line 扩展)")
    hop_count: int = Field(default=0, description="跳数 (Security Line 扩展)")
    risk_type: str = Field(..., description="风险类型")
    severity: str = Field(..., description="严重等级")
    description: str = Field(default="", description="路径描述")
