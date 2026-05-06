"""
Seed professional profiles into the database
"""
import asyncio
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import delete, select
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.professional import ProfessionalProfile
from app.models.user import User
from app.models.profile import Profile
from app.core.config import settings

# Professional data
PROFESSIONALS = [
    {
        "username": "ameer_ahmed_khan",
        "email": "ameer@flexa.com",
        "specialization": "Fitness",
        "bio": "EFBB mens physic Athlete (UAE) | EFBB mens physic Coach (UAE) | Certified Boxercise Instructor (REPS) (UAE) | Certified level-2 QCF (UAE)",
        "certifications": "EFBB Athlete & Coach, Boxercise Instructor, QCF Level 2",
        "languages": "English, Urdu",
        "location": "Vostro World G-13",
        "consultation_price_usd": 50,
        "consultation_duration_mins": 60,
        "average_rating": 4.8,
        "total_reviews": 25,
        "total_sessions_completed": 120,
        "years_experience": 8,
    },
    {
        "username": "samiya_malik",
        "email": "samiya@flexa.com",
        "specialization": "Fitness",
        "bio": "Certified Fitness Instructor | Level 3 Gactiveig | Certified Glesmills/BODYPUMP Instructor | Grts.global Certified | Archer PAAAL Pakistan",
        "certifications": "Level 3 Gactiveig, Glesmills, BODYPUMP, Grts.global, PAAAL",
        "languages": "English, Urdu",
        "location": "Vostro World",
        "consultation_price_usd": 45,
        "consultation_duration_mins": 60,
        "average_rating": 4.7,
        "total_reviews": 18,
        "total_sessions_completed": 95,
        "years_experience": 6,
    },
    {
        "username": "fazal_ghilmaan",
        "email": "fazal@flexa.com",
        "specialization": "Fitness",
        "bio": "ISSA Certified Personal Trainer | Strength and Conditioning Specialist | Bodybuilding Specialist | Nutritionist | CPR & AED Certified",
        "certifications": "ISSA Personal Trainer, Strength & Conditioning Specialist, Bodybuilding Specialist, Nutritionist, CPR & AED",
        "languages": "English, Urdu",
        "location": "Lahore",
        "consultation_price_usd": 55,
        "consultation_duration_mins": 60,
        "average_rating": 4.9,
        "total_reviews": 32,
        "total_sessions_completed": 150,
        "years_experience": 10,
    },
    {
        "username": "samra_munir",
        "email": "samra@flexa.com",
        "specialization": "Nutrition",
        "bio": "Certified Nutritionist | Specializes in Fat Loss & Muscle Gain | Strength and Disease Management | 10K+ Healthy Transformations",
        "certifications": "Certified Nutritionist, Fat Loss Specialist, Disease Management",
        "languages": "English, Urdu",
        "location": "Vostro World",
        "consultation_price_usd": 40,
        "consultation_duration_mins": 45,
        "average_rating": 4.8,
        "total_reviews": 28,
        "total_sessions_completed": 200,
        "years_experience": 7,
    },
    {
        "username": "dr_muneeba",
        "email": "muneeba@flexa.com",
        "specialization": "Physical Therapy",
        "bio": "Dr. Orthopaedic Physiotherapist | Certified Spine Manual Therapist | Sports Medicine Specialist | Vostro World",
        "certifications": "Orthopaedic Physiotherapist, Spine Manual Therapist, Sports Medicine",
        "languages": "English, Urdu",
        "location": "Vostro World",
        "consultation_price_usd": 60,
        "consultation_duration_mins": 45,
        "average_rating": 4.9,
        "total_reviews": 35,
        "total_sessions_completed": 180,
        "years_experience": 12,
    },
]


async def seed_professionals():
    """Seed professional profiles - removes all others, keeps only these 5"""
    # Create async engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
    )

    # Create async session
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Clear all existing professionals first
        print("🧹 Clearing existing professionals...")
        await session.execute(delete(ProfessionalProfile))
        await session.commit()
        print("✅ Cleared old professionals")
        
        for prof_data in PROFESSIONALS:
            try:
                # Check if user with this email already exists
                existing_user = await session.execute(
                    select(User).where(User.email == prof_data["email"])
                )
                user = existing_user.scalars().first()
                
                if not user:
                    # Create new user
                    user_id = uuid.uuid4()
                    user = User(
                        id=user_id,
                        email=prof_data["email"],
                        hashed_password="dummy",
                        is_verified=True,
                        is_active=True,
                        created_at=datetime.now(),
                        updated_at=datetime.now(),
                    )
                    session.add(user)
                    await session.flush()
                    
                    # Create profile for new user
                    profile = Profile(
                        id=uuid.uuid4(),
                        user_id=user.id,
                        username=prof_data["username"],
                        age=35,
                        gender="Male",
                        height_cm=175,
                        weight_kg=75,
                        bmi=24.5,
                        bmi_category="Normal",
                        created_at=datetime.now(),
                        updated_at=datetime.now(),
                    )
                    session.add(profile)
                    await session.flush()

                # Create professional profile
                professional = ProfessionalProfile(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    specialization=prof_data["specialization"],
                    bio=prof_data["bio"],
                    years_experience=prof_data["years_experience"],
                    certifications=prof_data["certifications"],
                    languages=prof_data["languages"],
                    location=prof_data.get("location", ""),
                    is_verified=True,
                    consultation_price_usd=prof_data["consultation_price_usd"],
                    consultation_duration_mins=prof_data["consultation_duration_mins"],
                    average_rating=prof_data.get("average_rating", 4.5),
                    total_reviews=prof_data.get("total_reviews", 0),
                    total_sessions_completed=prof_data.get("total_sessions_completed", 0),
                    is_accepting_clients=True,
                    max_clients_per_week=15,
                    timezone="Asia/Karachi",
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                )
                session.add(professional)
                await session.flush()
                print(f"✅ Created professional: {prof_data['username']}")

            except Exception as e:
                print(f"❌ Error creating {prof_data['username']}: {str(e)}")
                await session.rollback()
                continue

        await session.commit()
        print("\n✅ All 5 real professionals seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed_professionals())
