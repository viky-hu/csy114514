"""Evaluation API endpoints."""
from backend.app.services import evaluation_service
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


class CreateEvaluationRequest(BaseModel):
    agent_id: str = Field(..., min_length=1)


@router.post("", status_code=201)
async def create_evaluation(req: CreateEvaluationRequest):
    """Start an evaluation for an agent."""
    report = evaluation_service.create_evaluation(req.agent_id)
    return report.model_dump(mode="json")


@router.get("/{evaluation_id}")
async def get_evaluation(evaluation_id: str):
    """Get evaluation report by ID."""
    report = evaluation_service.get_evaluation(evaluation_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Evaluation '{evaluation_id}' not found")
    return report.model_dump(mode="json")


@router.get("/{evaluation_id}/report")
async def get_evaluation_report(evaluation_id: str):
    """Get the final report for an evaluation."""
    report = evaluation_service.get_evaluation(evaluation_id)
    if report is None:
        raise HTTPException(status_code=404, detail=f"Evaluation '{evaluation_id}' not found")
    return report.model_dump(mode="json")
