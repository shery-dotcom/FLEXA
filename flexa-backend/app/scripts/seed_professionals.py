"""
Seed script to create mock professionals for testing
Run with: python -m app.scripts.seed_professionals
"""

import asyncio
import uuid
import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.user import User
from app.models.profile import Profile
from app.models.professional import ProfessionalProfile, AvailabilitySlot
from app.database import Base

# Mock professional data
MOCK_PROFESSIONALS = [
    {
        "email": "sarah.khan@flexa.com",
        "username": "Dr. Sarah Khan",
        "phone": "+92-300-1234567",
        "specialization": "nutritionist",
        "bio": "Certified Registered Dietitian (RD) with 12+ years of experience in sports nutrition and medical nutrition therapy. Specializes in personalized meal planning for athletes and fitness enthusiasts. Certified Sports Dietitian (CSSD).",
        "years_experience": 12,
        "certifications": ["RD", "CSSD", "Masters in Clinical Nutrition"],
        "languages": ["English", "Urdu"],
        "consultation_price_usd": 75,
        "consultation_duration_mins": 60,
        "average_rating": 4.9,
        "total_reviews": 48,
        "total_sessions_completed": 120,
        "timezone": "Asia/Karachi",
    },
    {
        "email": "ahmed.malik@flexa.com",
        "username": "Ahmed Malik",
        "phone": "+92-300-2345678",
        "specialization": "fitness_trainer",
        "bio": "Certified Personal Trainer (NASM-CPT) with 8 years of experience in strength training, functional fitness, and body transformation. Specializes in designing personalized workout programs for all fitness levels.",
        "years_experience": 8,
        "certifications": ["NASM-CPT", "Functional Movement Systems (FMS)", "ACE Fitness"],
        "languages": ["English", "Urdu", "Hindi"],
        "consultation_price_usd": 65,
        "consultation_duration_mins": 45,
        "average_rating": 4.7,
        "total_reviews": 35,
        "total_sessions_completed": 95,
        "timezone": "Asia/Karachi",
    },
    {
        "email": "fatima.hassan@flexa.com",
        "username": "Dr. Fatima Hassan",
        "phone": "+92-300-3456789",
        "specialization": "both",
        "bio": "Holistic health specialist combining nutrition science with fitness coaching. 15+ years experience. Helps clients achieve sustainable lifestyle changes through integrated nutrition and exercise programs.",
        "years_experience": 15,
        "certifications": ["RD", "ISSA-CPT", "Health Coach Certification", "PhD Nutrition Science"],
        "languages": ["English", "Urdu", "Arabic"],
        "consultation_price_usd": 85,
        "consultation_duration_mins": 60,
        "average_rating": 4.8,
        "total_reviews": 62,
        "total_sessions_completed": 180,
        "timezone": "Asia/Karachi",
    },
    {
        "email": "usman.ali@flexa.com",
        "username": "Usman Ali",
        "phone": "+92-300-4567890",
        "specialization": "fitness_trainer",
        "bio": "Bodybuilding coach and transformation specialist. IFBB Pro Card holder with 6 years of coaching experience. Specializes in muscle building, strength training, and competition prep.",
        "years_experience": 6,
        "certifications": ["IFBB Pro Card", "ACE Fitness", "Bodybuilding Coach"],
        "languages": ["English", "Urdu"],
        "consultation_price_usd": 55,
        "consultation_duration_mins": 45,
        "average_rating": 4.5,
        "total_reviews": 22,
        "total_sessions_completed": 60,
        "timezone": "Asia/Karachi",
    },
]


async def seed_professionals():
    """Create mock professional profiles with availability slots"""
    
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
    
    async with async_session() as db:
        for prof_data in MOCK_PROFESSIONALS:
            # Check if user already exists
            from sqlalchemy import select
            existing_user = await db.execute(
                select(User).where(User.email == prof_data["email"])
            )
            if existing_user.scalar_one_or_none():
                print(f"⏭️  {prof_data['username']} already exists, skipping...")
                continue
            
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
