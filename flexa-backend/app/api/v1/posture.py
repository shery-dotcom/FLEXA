from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.posture import PostureSessionCreate, PostureSessionResponse
from app.schemas.posture_analysis import PostureSessionAnalysisCreate, PostureSessionAnalysisResponse
from app.services.posture_service import PostureService
from app.services.posture_analysis_service import PostureAnalysisService


router = APIRouter(prefix="/workout", tags=["Posture Tracking"])


@router.post("/session", response_model=PostureSessionResponse, status_code=201)
async def create_posture_session(
    data: PostureSessionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PostureService.create_session(db, current_user.id, data)


@router.get("/history", response_model=List[PostureSessionResponse])
async def get_posture_history(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await PostureService.get_history(db, current_user.id, limit)


@router.post("/analyze/{session_id}", response_model=PostureSessionAnalysisResponse, status_code=201)
async def analyze_posture_session(
    session_id: str,
    form_data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Analyze a posture session and provide feedback on form quality"""
    import uuid
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise ValueError("Invalid session ID")
    
    return await PostureAnalysisService.analyze_session(
        db, session_uuid, current_user.id, form_data.get("form_data", [])
    )


@router.get("/analysis/latest", response_model=PostureSessionAnalysisResponse)
async def get_latest_analysis(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the most recent posture analysis"""
    analysis = await PostureAnalysisService.get_latest_analysis(db, current_user.id)
    if not analysis:
        raise ValueError("No analysis found")
    return analysis


@router.get("/analysis/history", response_model=List[PostureSessionAnalysisResponse])
async def get_analysis_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get posture analysis history"""
    return await PostureAnalysisService.get_user_analyses(db, current_user.id, limit)
