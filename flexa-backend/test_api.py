import asyncio
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.professional import ProfessionalProfile
from app.services.professional_service import ProfessionalService

async def test():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get first professional
        result = await session.execute(select(ProfessionalProfile).limit(1))
        prof = result.scalar_one_or_none()
        
        if prof:
            print(f'Testing with professional: {prof.id}')
            try:
                profile_data = await ProfessionalService.get_professional_profile(session, prof.id)
                print(f'Profile data keys: {profile_data.keys()}')
                print(f'Available slots: {len(profile_data.get("available_slots", []))}')
                if profile_data.get('available_slots'):
                    print(f'First slot: {profile_data["available_slots"][0]}')
                else:
                    print('No slots available')
            except Exception as e:
                print(f'Error: {type(e).__name__}: {e}')
                import traceback
                traceback.print_exc()
        else:
            print('No professionals found')
    
    await engine.dispose()

asyncio.run(test())
