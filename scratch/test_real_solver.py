import asyncio
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy.future import select
from backend.app.models.models import Section, Subject, Staff, SectionSubject, TimeSlot, Classroom, PreAllocatedSlot
from backend.app.core.solver import generate_timetable_csp

async def main():
    async with AsyncSessionLocal() as db:
        # Enable logging by temporary wrapper or run solver
        res = await generate_timetable_csp(db, "2026-2027", 1)
        print("REAL SOLVER RESULT:", res)

if __name__ == "__main__":
    asyncio.run(main())
