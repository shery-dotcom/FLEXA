import uuid
from typing import Optional
import stripe
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.core.config import settings
from app.dependencies import get_current_user
from app.database import get_db
from app.models.professional import ProfessionalProfile, Payment
from app.models.user import User
from app.services.professional_service import ProfessionalService
from app.schemas.professional import (
    ProfessionalRegistrationRequest,
    ProfessionalDetailResponse,
    ConsultationBookingRequest,
    ReviewSubmissionRequest,
    PaymentConfirmationRequest,
)

router = APIRouter(prefix="/professionals", tags=["Professionals & Marketplace"])


@router.post("/apply", response_model=dict)
async def apply_as_professional(
    data: ProfessionalRegistrationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Convert current user to a professional
    Requires admin verification before activation
    """
    professional = await ProfessionalService.apply_as_professional(
        db=db,
        user_id=current_user.id,
        data=data,
    )
    
    return {
        "professional_id": str(professional.id),
        "status": "pending_verification",
        "message": "Application submitted. Admin will review your credentials.",
        "created_at": professional.created_at.isoformat(),
    }


@router.get("/search")
async def search_professionals(
    specialization: Optional[str] = Query(None, description="Filter by specialization"),
    min_rating: Optional[float] = Query(None, description="Minimum average rating"),
    max_price: Optional[float] = Query(None, description="Maximum consultation price"),
    timezone: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Search for verified professionals
    """
    results = await ProfessionalService.search_professionals(
        db=db,
        specialization=specialization,
        min_rating=min_rating,
        max_price=max_price,
        timezone=timezone,
        page=page,
        page_size=page_size,
    )
    
    return results


@router.get("/{professional_id}", response_model=dict)
async def get_professional(
    professional_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Get professional profile with available slots
    """
    try:
        prof_uuid = uuid.UUID(professional_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid professional ID")
    
    profile = await ProfessionalService.get_professional_profile(
        db=db,
        professional_id=prof_uuid,
    )
    
    return profile


@router.post("/{professional_id}/book")
async def book_consultation(
    professional_id: str,
    slot_id: str,
    data: ConsultationBookingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Book a consultation with a professional
    Returns payment URL (Stripe)
    """
    try:
        prof_uuid = uuid.UUID(professional_id)
        slot_uuid = uuid.UUID(slot_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid IDs")
    
    # Get user's subscription tier (placeholder for now)
    subscription_tier = getattr(current_user, 'subscription_tier', 'free')
    
    session = await ProfessionalService.book_consultation(
        db=db,
        user_id=current_user.id,
        professional_id=prof_uuid,
        slot_id=slot_uuid,
        data=data,
        subscription_tier=subscription_tier,
    )

    professional_res = await db.execute(
        select(ProfessionalProfile)
        .options(selectinload(ProfessionalProfile.user).selectinload(User.profile))
        .where(ProfessionalProfile.id == prof_uuid)
    )
    professional = professional_res.scalar_one_or_none()
    if not professional:
        await db.rollback()
        raise HTTPException(status_code=404, detail="Professional not found")

    if settings.STRIPE_DEMO_MODE:
        demo_checkout_id = f"cs_test_demo_{str(session.id).replace('-', '')[:18]}"
        payment = Payment(
            session_id=session.id,
            user_id=current_user.id,
            professional_id=professional.id,
            gross_amount_usd=session.session_price_usd,
            flexa_commission_usd=session.flexa_commission_usd,
            professional_payout_usd=session.professional_earnings_usd,
            payment_status="pending",
            stripe_payment_intent_id=demo_checkout_id,
        )

        session.payment_id = demo_checkout_id
        session.payment_status = "pending"

        db.add(payment)
        db.add(session)
        await db.commit()

        return {
            "session_id": str(session.id),
            "status": "pending_payment",
            "price_usd": session.session_price_usd,
            "session_date": session.session_date.isoformat(),
            "message": "Stripe demo checkout created. This is a presentation-only flow.",
            "checkout_url": f"{settings.FRONTEND_URL}/marketplace?payment=success&session_id={session.id}&stripe_session_id={demo_checkout_id}",
            "stripe_session_id": demo_checkout_id,
            "demo_mode": True,
        }

    if not settings.STRIPE_SECRET_KEY:
        await db.rollback()
        raise HTTPException(
            status_code=503,
            detail="Stripe key is missing. Add STRIPE_SECRET_KEY or enable STRIPE_DEMO_MODE.",
        )

    stripe.api_key = settings.STRIPE_SECRET_KEY
    success_url = settings.STRIPE_SUCCESS_URL or (
        f"{settings.FRONTEND_URL}/marketplace?payment=success&session_id={session.id}&stripe_session_id={{CHECKOUT_SESSION_ID}}"
    )
    cancel_url = settings.STRIPE_CANCEL_URL or f"{settings.FRONTEND_URL}/marketplace?payment=cancelled"

    try:
        checkout_session = stripe.checkout.Session.create(
            mode="payment",
            customer_email=current_user.email,
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                "consultation_session_id": str(session.id),
                "user_id": str(current_user.id),
                "professional_id": str(professional.id),
            },
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": settings.STRIPE_CURRENCY,
                        "unit_amount": int(round(session.session_price_usd * 100)),
                        "product_data": {
                            "name": f"FLEXA consultation with {professional.user.profile.username if professional.user.profile else 'Expert'}",
                            "description": f"{data.specialization_type.replace('_', ' ').title()} consultation for {session.duration_mins} minutes",
                        },
                    },
                }
            ],
        )
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=502, detail=f"Could not create Stripe checkout session: {exc}")

    payment = Payment(
        session_id=session.id,
        user_id=current_user.id,
        professional_id=professional.id,
        gross_amount_usd=session.session_price_usd,
        flexa_commission_usd=session.flexa_commission_usd,
        professional_payout_usd=session.professional_earnings_usd,
        payment_status="pending",
    )

    session.payment_id = checkout_session.id
    session.payment_status = "pending"

    db.add(payment)
    db.add(session)
    await db.commit()
    
    return {
        "session_id": str(session.id),
        "status": "pending_payment",
        "price_usd": session.session_price_usd,
        "session_date": session.session_date.isoformat(),
        "message": "Proceed to Stripe Checkout. Use test card 4242 4242 4242 4242 for testing.",
        "checkout_url": checkout_session.url,
        "stripe_session_id": checkout_session.id,
        "demo_mode": False,
    }


@router.get("/my-consultations/list")
async def get_my_consultations(
    status: Optional[str] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all consultation bookings for current user
    """
    consultations = await ProfessionalService.get_user_consultations(
        db=db,
        user_id=current_user.id,
        status=status,
    )
    
    return {
        "consultations": consultations,
        "total": len(consultations),
    }


@router.post("/{session_id}/confirm-payment")
async def confirm_payment(
    session_id: str,
    data: PaymentConfirmationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Confirm payment and activate consultation session
    Called after Stripe payment succeeds
    """
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await ProfessionalService.confirm_booking(
        db=db,
        session_id=session_uuid,
        meeting_link=data.meeting_link,
    )
    
    return {
        "session_id": str(session.id),
        "status": "confirmed",
        "payment_status": session.payment_status,
        "meeting_link": session.meeting_link,
        "session_date": session.session_date.isoformat(),
        "message": "Payment confirmed! Join the meeting at the scheduled time.",
    }


@router.post("/{session_id}/review")
async def submit_review(
    session_id: str,
    data: ReviewSubmissionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Submit a review for a completed consultation
    """
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    review = await ProfessionalService.submit_review(
        db=db,
        session_id=session_uuid,
        user_id=current_user.id,
        rating=data.rating,
        title=data.title,
        content=data.content,
    )
    
    return {
        "review_id": str(review.id),
        "rating": review.rating,
        "created_at": review.created_at.isoformat(),
        "message": "Review submitted successfully!",
    }


# ─────────────────────────────────────────────────────────────
# PROFESSIONAL-ONLY ENDPOINTS
# ─────────────────────────────────────────────────────────────


@router.get("/me/dashboard")
async def professional_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Professional dashboard with stats and upcoming sessions
    """
    if current_user.role not in ["professional", "professional_pending"]:
        raise HTTPException(status_code=403, detail="Not a professional")
    
    if not current_user.professional_profile:
        raise HTTPException(status_code=404, detail="Professional profile not found")
    
    dashboard = await ProfessionalService.get_professional_dashboard(
        db=db,
        professional_id=current_user.professional_profile.id,
    )
    
    return dashboard


@router.post("/me/availability")
async def add_availability_slots(
    slots_data: dict,  # {slots: [{start_time, end_time}, ...]}
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Add availability slots for professional
    
    Example request:
    {
        "slots": [
            {"start_time": "2024-04-20T10:00:00Z", "end_time": "2024-04-20T11:00:00Z"},
            {"start_time": "2024-04-20T14:00:00Z", "end_time": "2024-04-20T15:00:00Z"}
        ]
    }
    """
    if current_user.role not in ["professional", "professional_pending"]:
        raise HTTPException(status_code=403, detail="Not a professional")
    
    if not current_user.professional_profile:
        raise HTTPException(status_code=404, detail="Professional profile not found")
    
    from app.services.professional_service import AvailabilitySlot
    from datetime import datetime
    
    created_count = 0
    for slot_data in slots_data.get("slots", []):
        try:
            start_time = datetime.fromisoformat(slot_data["start_time"].replace("Z", "+00:00"))
            end_time = datetime.fromisoformat(slot_data["end_time"].replace("Z", "+00:00"))
            
            slot = AvailabilitySlot(
                id=uuid.uuid4(),
                professional_id=current_user.professional_profile.id,
                start_time=start_time,
                end_time=end_time,
                is_available=True,
            )
            db.add(slot)
            created_count += 1
        except (ValueError, KeyError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid slot data: {str(e)}")
    
    await db.commit()
    
    return {
        "created_slots": created_count,
        "message": "Availability updated successfully",
    }


@router.get("/me/earnings")
async def get_earnings(
    month: Optional[str] = Query(None, description="Filter by month (YYYY-MM)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get professional earnings for a period
    """
    if current_user.role not in ["professional", "professional_pending"]:
        raise HTTPException(status_code=403, detail="Not a professional")
    
    if not current_user.professional_profile:
        raise HTTPException(status_code=404, detail="Professional profile not found")
    
    # Placeholder - implement actual earnings calculation
    return {
        "period": month or "current_month",
        "total_sessions": 0,
        "gross_revenue_usd": 0,
        "flexa_commission_usd": 0,
        "professional_earnings_usd": 0,
        "pending_payout_usd": 0,
        "completed_payout_usd": 0,
        "payout_schedule": "monthly",
    }
