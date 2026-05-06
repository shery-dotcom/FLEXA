import uuid
import json
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from fastapi import HTTPException
from app.models.professional import (
    ProfessionalProfile,
    ConsultationSession,
    AvailabilitySlot,
    ProfessionalReview,
    Payment,
)
from app.models.user import User
from app.schemas.professional import (
    ProfessionalRegistrationRequest,
    ProfessionalProfileResponse,
    ConsultationBookingRequest,
)


class ProfessionalService:

    @staticmethod
    async def apply_as_professional(
        db: AsyncSession,
        user_id: uuid.UUID,
        data: ProfessionalRegistrationRequest,
    ) -> ProfessionalProfile:
        """
        Convert a regular user to a professional
        """
        # Check if user exists
        user_res = await db.execute(select(User).where(User.id == user_id))
        user = user_res.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Check if already a professional
        existing_prof = await db.execute(
            select(ProfessionalProfile).where(ProfessionalProfile.user_id == user_id)
        )
        if existing_prof.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Already registered as professional")

        # Create professional profile
        professional = ProfessionalProfile(
            id=uuid.uuid4(),
            user_id=user_id,
            specialization=data.specialization,
            location=data.location,
            bio=data.bio,
            years_experience=data.years_experience,
            certifications=json.dumps(data.certifications),
            languages=json.dumps(data.languages),
            consultation_price_usd=data.consultation_price_usd,
            consultation_duration_mins=data.consultation_duration_mins,
            verification_document_url=data.verification_document_url,
            timezone=data.timezone,
            is_verified=False,  # Requires admin approval
        )

        # Update user role
        user.role = "professional_pending"  # Pending verification

        db.add(professional)
        await db.commit()
        await db.refresh(professional)

        return professional

    @staticmethod
    async def get_professional_profile(
        db: AsyncSession,
        professional_id: uuid.UUID,
    ) -> dict:
        """
        Get professional profile with availability
        """
        try:
            prof_res = await db.execute(
                select(ProfessionalProfile)
                .options(selectinload(ProfessionalProfile.user).selectinload(User.profile))
                .where(ProfessionalProfile.id == professional_id)
            )
            professional = prof_res.scalar_one_or_none()

            if not professional:
                raise HTTPException(status_code=404, detail="Professional not found")

            # Get available slots for next 7 days (without strict timezone filtering)
            now = datetime.now()
            seven_days_from_now = now + timedelta(days=7)
            slots_res = await db.execute(
                select(AvailabilitySlot)
                .where(
                    AvailabilitySlot.professional_id == professional_id,
                    AvailabilitySlot.is_available == True,
                )
                .order_by(AvailabilitySlot.start_time)
            )
            available_slots = slots_res.scalars().all()
            
            # Filter slots to next 7 days
            filtered_slots = [
                slot for slot in available_slots 
                if now <= slot.start_time <= seven_days_from_now
            ][:10]  # Limit to 10

            username = "Unknown"
            if professional.user and professional.user.profile:
                username = professional.user.profile.username
            
            certifications = []
            languages = []
            try:
                certifications = json.loads(professional.certifications) if professional.certifications else []
            except (json.JSONDecodeError, TypeError):
                certifications = [professional.certifications] if professional.certifications else []
            
            try:
                languages = json.loads(professional.languages) if professional.languages else []
            except (json.JSONDecodeError, TypeError):
                languages = [professional.languages] if professional.languages else []

            return {
                "id": str(professional.id),
                "name": username,
                "user": {
                    "username": username,
                },
                "contact_email": professional.user.email if professional.user else "N/A",
                "specialization": professional.specialization,
                "location": professional.location or "",
                "bio": professional.bio,
                "years_experience": professional.years_experience,
                "certifications": certifications,
                "languages": languages,
                "consultation_price_usd": professional.consultation_price_usd,
                "consultation_duration_mins": professional.consultation_duration_mins,
                "average_rating": professional.average_rating,
                "total_reviews": professional.total_reviews,
                "total_sessions_completed": professional.total_sessions_completed,
                "is_verified": professional.is_verified,
                "timezone": professional.timezone,
                "available_slots": [
                    {
                        "slot_id": str(slot.id),
                        "start_time": slot.start_time.isoformat() if slot.start_time else "",
                        "end_time": slot.end_time.isoformat() if slot.end_time else "",
                    }
                    for slot in filtered_slots
                ],
            }
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error in get_professional_profile: {e}")
            raise HTTPException(status_code=500, detail=f"Error loading professional: {str(e)}")

    @staticmethod
    async def search_professionals(
        db: AsyncSession,
        specialization: str | None = None,
        min_rating: float | None = None,
        max_price: float | None = None,
        timezone: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        """
        Search professionals with filters
        """
        query = select(ProfessionalProfile).options(
            selectinload(ProfessionalProfile.user).selectinload(User.profile)
        ).where(
            ProfessionalProfile.is_accepting_clients == True,
        )

        if specialization:
            query = query.where(ProfessionalProfile.specialization.in_([specialization, "both"]))

        if min_rating:
            query = query.where(ProfessionalProfile.average_rating >= min_rating)

        if max_price:
            query = query.where(ProfessionalProfile.consultation_price_usd <= max_price)

        if timezone:
            query = query.where(ProfessionalProfile.timezone == timezone)

        # Order by rating (descending), then by verification status
        query = query.order_by(
            ProfessionalProfile.is_verified.desc(),
            ProfessionalProfile.average_rating.desc(),
        )

        # Pagination
        total_query = select(func.count()).select_from(ProfessionalProfile).where(
            ProfessionalProfile.is_accepting_clients == True,
        )

        if specialization:
            total_query = total_query.where(
                ProfessionalProfile.specialization.in_([specialization, "both"])
            )

        if min_rating:
            total_query = total_query.where(ProfessionalProfile.average_rating >= min_rating)

        if max_price:
            total_query = total_query.where(ProfessionalProfile.consultation_price_usd <= max_price)

        if timezone:
            total_query = total_query.where(ProfessionalProfile.timezone == timezone)

        total_res = await db.execute(total_query)
        total = total_res.scalar()

        query = query.offset((page - 1) * page_size).limit(page_size)

        pros_res = await db.execute(query)
        professionals = pros_res.scalars().all()

        return {
            "professionals": [
                {
                    "id": str(p.id),
                    "user": {
                        "username": p.user.profile.username if p.user.profile else "Unknown",
                    },
                    "specialization": p.specialization,
                    "location": p.location,
                    "bio": p.bio[:100] + "..." if len(p.bio) > 100 else p.bio,
                    "consultation_price_usd": p.consultation_price_usd,
                    "average_rating": p.average_rating,
                    "total_reviews": p.total_reviews,
                    "total_sessions_completed": p.total_sessions_completed,
                    "is_verified": p.is_verified,
                }
                for p in professionals
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    @staticmethod
    async def book_consultation(
        db: AsyncSession,
        user_id: uuid.UUID,
        professional_id: uuid.UUID,
        slot_id: uuid.UUID,
        data: ConsultationBookingRequest,
        subscription_tier: str = "free",  # "free", "premium", "premium_plus"
    ) -> ConsultationSession:
        """
        Book a consultation session
        """
        # Get professional
        prof_res = await db.execute(
            select(ProfessionalProfile)
            .options(selectinload(ProfessionalProfile.user).selectinload(User.profile))
            .where(ProfessionalProfile.id == professional_id)
        )
        professional = prof_res.scalar_one_or_none()
        if not professional:
            raise HTTPException(status_code=404, detail="Professional not found")

        # Get availability slot
        slot_res = await db.execute(
            select(AvailabilitySlot).where(
                AvailabilitySlot.id == slot_id,
                AvailabilitySlot.professional_id == professional_id,
                AvailabilitySlot.is_available == True,
            )
        )
        slot = slot_res.scalar_one_or_none()
        if not slot:
            raise HTTPException(status_code=400, detail="Slot not available")

        # Calculate pricing with subscription discount
        base_price = professional.consultation_price_usd

        # Apply subscription discounts
        discount_rate = 0.0
        if subscription_tier == "premium":
            discount_rate = 0.20  # 20% off
        elif subscription_tier == "premium_plus":
            discount_rate = 0.30  # 30% off

        session_price = base_price * (1 - discount_rate)

        # Calculate commission (25% default, can vary)
        commission_rate = 0.25
        flexa_commission = session_price * commission_rate
        professional_earnings = session_price - flexa_commission

        # Create consultation session
        session = ConsultationSession(
            id=uuid.uuid4(),
            user_id=user_id,
            professional_id=professional_id,
            specialization_type=data.specialization_type,
            session_date=slot.start_time,
            duration_mins=professional.consultation_duration_mins,
            session_price_usd=session_price,
            professional_earnings_usd=professional_earnings,
            flexa_commission_usd=flexa_commission,
            commission_rate=commission_rate,
            notes=data.notes,
        )

        # Mark slot as booked
        slot.is_available = False
        slot.booked_session_id = session.id

        db.add(session)
        db.add(slot)
        await db.flush()

        return session

    @staticmethod
    async def confirm_booking(
        db: AsyncSession,
        session_id: uuid.UUID,
        meeting_link: str,
        requester_user_id: uuid.UUID,
    ) -> ConsultationSession:
        """
        Confirm booking after payment
        """
        session_res = await db.execute(
            select(ConsultationSession)
            .options(selectinload(ConsultationSession.professional).selectinload(ProfessionalProfile.user))
            .where(ConsultationSession.id == session_id)
        )
        session = session_res.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        allowed_user_ids = {session.user_id}
        if session.professional and session.professional.user_id:
            allowed_user_ids.add(session.professional.user_id)
        if requester_user_id not in allowed_user_ids:
            raise HTTPException(status_code=403, detail="Not allowed to confirm this payment")

        session.status = "confirmed"
        if meeting_link is not None:
            session.meeting_link = meeting_link
        session.payment_status = "completed"

        db.add(session)
        await db.commit()
        await db.refresh(session)

        return session

    @staticmethod
    async def get_user_consultations(
        db: AsyncSession,
        user_id: uuid.UUID,
        status: str | None = None,
    ) -> list[dict]:
        """
        Get all consultations for a user
        """
        query = select(ConsultationSession).where(ConsultationSession.user_id == user_id)

        if status:
            query = query.where(ConsultationSession.status == status)

        query = query.order_by(ConsultationSession.session_date.desc())

        res = await db.execute(query)
        sessions = res.scalars().all()

        return [
            {
                "session_id": str(s.id),
                "professional_name": s.professional.user.profile.username if s.professional.user.profile else "Unknown",
                "professional_id": str(s.professional_id),
                "specialization": s.specialization_type,
                "scheduled_at": s.session_date.isoformat(),
                "status": s.status,
                "price_paid_usd": s.session_price_usd,
                "meeting_link": s.meeting_link,
                "notes": s.notes,
            }
            for s in sessions
        ]

    @staticmethod
    async def get_professional_dashboard(
        db: AsyncSession,
        professional_id: uuid.UUID,
    ) -> dict:
        """
        Get professional's dashboard with stats
        """
        prof_res = await db.execute(
            select(ProfessionalProfile).where(ProfessionalProfile.id == professional_id)
        )
        professional = prof_res.scalar_one_or_none()
        if not professional:
            raise HTTPException(status_code=404, detail="Professional not found")

        # Get upcoming sessions (next 7 days)
        now = datetime.now(datetime.now().astimezone().tzinfo)
        seven_days_from_now = now + timedelta(days=7)
        upcoming_res = await db.execute(
            select(ConsultationSession)
            .where(
                ConsultationSession.professional_id == professional_id,
                ConsultationSession.session_date >= now,
                ConsultationSession.session_date <= seven_days_from_now,
            )
            .order_by(ConsultationSession.session_date)
        )
        upcoming_sessions = upcoming_res.scalars().all()

        # Get this month's stats
        this_month_start = datetime.now(datetime.now().astimezone().tzinfo).replace(day=1)
        month_res = await db.execute(
            select(ConsultationSession).where(
                ConsultationSession.professional_id == professional_id,
                ConsultationSession.status == "completed",
                ConsultationSession.ended_at >= this_month_start,
            )
        )
        month_sessions = month_res.scalars().all()
        month_earnings = sum(s.professional_earnings_usd for s in month_sessions)

        return {
            "profile": {
                "id": str(professional.id),
                "name": professional.user.profile.username if professional.user.profile else "Unknown",
                "specialization": professional.specialization,
                "average_rating": professional.average_rating,
                "total_sessions_completed": professional.total_sessions_completed,
            },
            "upcoming_sessions": [
                {
                    "session_id": str(s.id),
                    "user_name": s.user.profile.username if s.user.profile else "Unknown",
                    "scheduled_at": s.session_date.isoformat(),
                    "specialization_type": s.specialization_type,
                    "meeting_link": s.meeting_link,
                    "user_notes": s.notes,
                }
                for s in upcoming_sessions
            ],
            "stats": {
                "sessions_this_month": len(month_sessions),
                "earnings_this_month_usd": month_earnings,
                "average_rating": professional.average_rating,
                "total_sessions_completed": professional.total_sessions_completed,
            },
        }

    @staticmethod
    async def submit_review(
        db: AsyncSession,
        session_id: uuid.UUID,
        user_id: uuid.UUID,
        rating: int,
        title: str,
        content: str,
    ) -> ProfessionalReview:
        """
        Submit a review for a completed session
        """
        # Verify session exists and belongs to user
        session_res = await db.execute(
            select(ConsultationSession).where(
                ConsultationSession.id == session_id,
                ConsultationSession.user_id == user_id,
                ConsultationSession.status == "completed",
            )
        )
        session = session_res.scalar_one_or_none()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found or not completed")

        # Check if review already exists
        existing_review = await db.execute(
            select(ProfessionalReview).where(ProfessionalReview.session_id == session_id)
        )
        if existing_review.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Review already submitted for this session")

        # Create review
        review = ProfessionalReview(
            id=uuid.uuid4(),
            session_id=session_id,
            professional_id=session.professional_id,
            user_id=user_id,
            rating=rating,
            title=title,
            content=content,
        )

        # Update professional's average rating
        all_reviews = await db.execute(
            select(ProfessionalReview).where(
                ProfessionalReview.professional_id == session.professional_id
            )
        )
        reviews = all_reviews.scalars().all()
        avg_rating = sum(r.rating for r in reviews + [review]) / (len(reviews) + 1)

        professional = session.professional
        professional.average_rating = avg_rating
        professional.total_reviews = len(reviews) + 1

        db.add(review)
        db.add(professional)
        await db.commit()
        await db.refresh(review)

        return review
