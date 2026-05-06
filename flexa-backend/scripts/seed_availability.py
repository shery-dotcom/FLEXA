"""
Seed availability slots for professionals
"""
import asyncio
import uuid
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.professional import ProfessionalProfile, AvailabilitySlot
from app.core.config import settings


async def seed_availability():
    """Seed availability slots for all professionals"""
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        future=True,
    )

    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Get all professionals
        prof_res = await session.execute(select(ProfessionalProfile))
        professionals = prof_res.scalars().all()
        
        print(f"Found {len(professionals)} professionals")
        
        for prof in professionals:
            try:
                # Delete existing slots for this professional
                existing_slots_res = await session.execute(
                    select(AvailabilitySlot).where(AvailabilitySlot.professional_id == prof.id)
                )
                existing_slots = existing_slots_res.scalars().all()
                for slot in existing_slots:
                    await session.delete(slot)
                
                print(f"🧹 Cleared {len(existing_slots)} old slots for {prof.specialization}")
                
                # Create 10 slots for next 10 days
                base_time = datetime.now().replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
                
                for day_offset in range(10):
                    slot_date = base_time + timedelta(days=day_offset)
                    
                    # Create 2 slots per day (10am and 2pm)
                    for hour in [10, 14]:
                        start_time = slot_date.replace(hour=hour)
                        end_time = start_time + timedelta(minutes=prof.consultation_duration_mins)
                        
                        slot = AvailabilitySlot(
                            id=uuid.uuid4(),
                            professional_id=prof.id,
                            start_time=start_time,
                            end_time=end_time,
                            is_available=True,
                        )
                        session.add(slot)
                
                await session.flush()
                print(f"✅ Created 20 slots for {prof.specialization}")
                
            except Exception as e:
                print(f"❌ Error creating slots for {prof.specialization}: {str(e)}")
                await session.rollback()
                continue
        
        await session.commit()
        print("\n✅ All availability slots seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed_availability())
