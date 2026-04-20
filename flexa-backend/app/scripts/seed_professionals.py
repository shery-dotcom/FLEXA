"""
Seed script to create real professionals for marketplace.
Run with: python -m app.scripts.seed_professionals
"""

import asyncio
import uuid
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.models.user import User
from app.models.profile import Profile
from app.models.professional import ProfessionalProfile, AvailabilitySlot
from app.database import Base

# Previous demo/mock emails to purge from marketplace.
OLD_MOCK_EMAILS = [
    "sarah.khan@flexa.com",
    "ahmed.malik@flexa.com",
    "fatima.hassan@flexa.com",
    "usman.ali@flexa.com",
]

# Real professional data for production-facing experts section.
REAL_PROFESSIONALS = [
    {
        "email": "ameer.ahmed.khan@flexa.com",
        "username": "Ameer Ahmed Khan",
        "phone": "+92-300-1000101",
        "specialization": "fitness_trainer",
        "bio": "Location: Vostro World G-13. Personal Trainer with UAE coaching exposure. EFBB men's physique athlete and coach with focus on body composition, conditioning, and performance-based training.",
        "years_experience": 8,
        "certifications": [
            "EFBB Men's Physique Athlete (UAE)",
            "EFBB Men's Physique Coach (UAE)",
            "Certified Boxercise Instructor (REPS) (UAE)",
            "Certified Level-2 QCF (UAE)",
        ],
        "languages": ["English", "Urdu"],
        "consultation_price_usd": 60,
        "consultation_duration_mins": 60,
        "average_rating": 4.9,
        "total_reviews": 0,
        "total_sessions_completed": 0,
        "timezone": "Asia/Karachi",
    },
    {
        "email": "samiya.malik@flexa.com",
        "username": "Samiya Malik",
        "phone": "+92-300-1000102",
        "specialization": "fitness_trainer",
        "bio": "Location: VostroWorld. Fitness Instructor with practical group-training and studio coaching experience. Helps improve strength, conditioning, and sustainable fitness habits.",
        "years_experience": 6,
        "certifications": [
            "Level 3 Gactiveig",
            "Certified Glesmills / BODYPUMP",
            "Certified Grts.global",
            "Archer PAAAL Pakistan",
        ],
        "languages": ["English", "Urdu", "Hindi"],
        "consultation_price_usd": 50,
        "consultation_duration_mins": 45,
        "average_rating": 4.7,
        "total_reviews": 0,
        "total_sessions_completed": 0,
        "timezone": "Asia/Karachi",
    },
    {
        "email": "fazal.ghilmaan.javaid@flexa.com",
        "username": "Fazal Ghilmaan Javaid",
        "phone": "+92-300-1000103",
        "specialization": "fitness_trainer",
        "bio": "ISSA-certified trainer focused on strength, conditioning, and physique transformation. Supports evidence-based training plans with practical nutrition guidance and safe session progression.",
        "years_experience": 7,
        "certifications": [
            "ISSA Certified Personal Trainer",
            "Strength and Conditioning Specialist",
            "Bodybuilding Specialist",
            "Nutritionist",
            "CPR & AED Certified",
        ],
        "languages": ["English", "Urdu", "Arabic"],
        "consultation_price_usd": 55,
        "consultation_duration_mins": 60,
        "average_rating": 4.8,
        "total_reviews": 0,
        "total_sessions_completed": 0,
        "timezone": "Asia/Karachi",
    },
    {
        "email": "samra.munir@flexa.com",
        "username": "Samra Munir",
        "phone": "+92-300-1000104",
        "specialization": "nutritionist",
        "bio": "Location: VostroWorld. Nutritionist helping clients lose fat, gain muscle strength, and manage disease-specific nutrition needs. Supports structured plans aligned with long-term health outcomes.",
        "years_experience": 5,
        "certifications": [
            "Nutritionist",
            "10K+ Healthy Transformations",
            "Fat Loss and Muscle Gain Guidance",
            "Disease Management Nutrition",
        ],
        "languages": ["English", "Urdu"],
        "consultation_price_usd": 65,
        "consultation_duration_mins": 45,
        "average_rating": 4.8,
        "total_reviews": 0,
        "total_sessions_completed": 0,
        "timezone": "Asia/Karachi",
    },
    {
        "email": "dr.muneeba.mehmood@flexa.com",
        "username": "Dr Muneeba Mehmood",
        "phone": "+92-300-1000105",
        "specialization": "fitness_trainer",
        "bio": "Orthopaedic Physiotherapist at VostroWorld with sports medicine and spine manual therapy specialization. Focuses on pain-aware training progression, movement quality, and safe return-to-activity plans.",
        "years_experience": 9,
        "certifications": [
            "Certified Spine Manual Therapist",
            "Sports Medicine",
            "Orthopaedic Physiotherapist",
        ],
        "languages": ["English", "Urdu"],
        "consultation_price_usd": 70,
        "consultation_duration_mins": 60,
        "average_rating": 4.9,
        "total_reviews": 0,
        "total_sessions_completed": 0,
        "timezone": "Asia/Karachi",
    },
]


async def seed_professionals():
    """Replace old seeded experts and create updated real professional profiles with availability slots."""
    
    # Create async engine and session
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )
    
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with engine.begin() as conn:
        # Don't create tables here - let Alembic handle migrations
        pass
    
    target_emails = set(OLD_MOCK_EMAILS + [p["email"] for p in REAL_PROFESSIONALS])

    async with async_session() as db:
        # Purge old seeded profiles so Experts section does not show mock entries.
        existing_users_res = await db.execute(
            select(User).where(User.email.in_(target_emails))
        )
        existing_users = existing_users_res.scalars().all()

        for existing_user in existing_users:
            await db.delete(existing_user)

        if existing_users:
            await db.commit()
            print(f"🧹 Removed {len(existing_users)} old seeded professional users")

        for prof_data in REAL_PROFESSIONALS:
            
            try:
                # Create user account
                user = User(
                    id=uuid.uuid4(),
                    email=prof_data["email"],
                    phone=prof_data["phone"],
                    hashed_password="$2b$12$fake_hash_for_testing",  # Dummy hash
                    is_active=True,
                    is_verified=True,
                    role="professional",  # Already verified for testing
                )
                db.add(user)
                await db.flush()
                
                # Create user profile
                profile = Profile(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    username=prof_data["username"],
                    age=None,
                    gender=None,
                    height_cm=None,
                    weight_kg=None,
                )
                db.add(profile)
                await db.flush()
                
                # Create professional profile
                professional = ProfessionalProfile(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    specialization=prof_data["specialization"],
                    bio=prof_data["bio"],
                    years_experience=prof_data["years_experience"],
                    certifications=json.dumps(prof_data["certifications"]),
                    languages=json.dumps(prof_data["languages"]),
                    consultation_price_usd=prof_data["consultation_price_usd"],
                    consultation_duration_mins=prof_data["consultation_duration_mins"],
                    is_verified=True,  # Pre-verified for testing
                    average_rating=prof_data["average_rating"],
                    total_reviews=prof_data["total_reviews"],
                    total_sessions_completed=prof_data["total_sessions_completed"],
                    timezone=prof_data["timezone"],
                    is_accepting_clients=True,
                )
                db.add(professional)
                await db.flush()
                
                # Create availability slots (next 30 days)
                base_date = datetime.now(timezone.utc)
                slots_created = 0
                
                for day in range(1, 31):
                    slot_date = base_date + timedelta(days=day)
                    
                    # Skip weekends (Saturday=5, Sunday=6)
                    if slot_date.weekday() > 4:
                        continue
                    
                    # Add 3 slots per day: 10am, 2pm, 6pm (UTC)
                    for hour in [10, 14, 18]:
                        start_time = slot_date.replace(hour=hour, minute=0, second=0, microsecond=0)
                        end_time = start_time + timedelta(
                            minutes=prof_data["consultation_duration_mins"]
                        )
                        
                        slot = AvailabilitySlot(
                            id=uuid.uuid4(),
                            professional_id=professional.id,
                            start_time=start_time,
                            end_time=end_time,
                            is_available=True,
                        )
                        db.add(slot)
                        slots_created += 1
                
                await db.commit()
                print(f"✅ Created: {prof_data['username']} ({prof_data['specialization']}) with {slots_created} availability slots")
                
            except Exception as e:
                await db.rollback()
                print(f"❌ Error creating {prof_data['username']}: {str(e)}")
    
    await engine.dispose()
    print("\n🎉 Seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_professionals())
