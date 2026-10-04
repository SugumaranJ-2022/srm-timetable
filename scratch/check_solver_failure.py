import asyncio
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy.future import select
from backend.app.models.models import Section, Subject, Staff, SectionSubject, TimeSlot, Classroom, PreAllocatedSlot
from backend.app.core.solver import generate_timetable_csp

async def main():
    async with AsyncSessionLocal() as db:
        res_pre = await db.execute(select(PreAllocatedSlot))
        pre_slots = res_pre.scalars().all()
        print(f"PreAllocatedSlots count: {len(pre_slots)}")
        for ps in pre_slots:
            sec = (await db.execute(select(Section).where(Section.id == ps.section_id))).scalar_one_or_none()
            sub = (await db.execute(select(Subject).where(Subject.id == ps.subject_id))).scalar_one_or_none()
            stf = (await db.execute(select(Staff).where(Staff.id == ps.staff_id))).scalar_one_or_none()
            ts = (await db.execute(select(TimeSlot).where(TimeSlot.id == ps.timeslot_id))).scalar_one_or_none()
            print(f"  Slot ID={ps.id}: Section={sec.name if sec else ps.section_id}, Subject={sub.name if sub else ps.subject_id}, Staff={stf.name if stf else ps.staff_id}, Timeslot={ps.timeslot_id} ({ts.day_of_week} P{ts.period_number})")

        print("\nCalling generate_timetable_csp...")
        res = await generate_timetable_csp(db, "2026-2027", 1)
        print("SOLVER RESULT:", res)

if __name__ == "__main__":
    asyncio.run(main())
