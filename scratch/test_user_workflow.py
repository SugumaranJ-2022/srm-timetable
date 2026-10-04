import asyncio
import io
import pandas as pd
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy import text
from sqlalchemy.future import select
from backend.app.models.models import (
    User, Department, Subject, Staff, Section, Classroom, TimeSlot, SectionSubject, PreAllocatedSlot
)
from backend.app.core.solver import generate_timetable_csp
from backend.app.api.auth import get_password_hash

async def test_full_user_workflow():
    async with AsyncSessionLocal() as db:
        # First ensure DB is seeded
        sec_res = await db.execute(select(Section).where(Section.name == "BCA A"))
        sec_bca = sec_res.scalar_one_or_none()
        if not sec_bca:
            print("Seeding DB first...")
            from scratch.seed_db import import_excel
            await import_excel()
            sec_res = await db.execute(select(Section).where(Section.name == "BCA A"))
            sec_bca = sec_res.scalar_one()

        # Step 1: User Pre-allocates Tamil I & Maths for BCA A
        dept_res = await db.execute(select(Department).where(Department.name == "Languages"))
        dept_lang = dept_res.scalar_one_or_none()
        if not dept_lang:
            dept_lang = Department(name="Languages")
            db.add(dept_lang)
            await db.flush()

        # Tamil I
        sub_res = await db.execute(select(Subject).where(Subject.code == "TAM101"))
        sub_tamil = sub_res.scalar_one_or_none()
        if not sub_tamil:
            sub_tamil = Subject(code="TAM101", name="Tamil I", credits=3, semester=1, department_id=dept_lang.id)
            db.add(sub_tamil)
            await db.flush()

        usr_res = await db.execute(select(User).where(User.email == "sugu@srmist.edu.in"))
        usr_sugu = usr_res.scalar_one_or_none()
        if not usr_sugu:
            usr_sugu = User(email="sugu@srmist.edu.in", password_hash=get_password_hash("Staff123!"), role="Staff")
            db.add(usr_sugu)
            await db.flush()

        stf_res = await db.execute(select(Staff).where(Staff.user_id == usr_sugu.id))
        stf_sugu = stf_res.scalar_one_or_none()
        if not stf_sugu:
            stf_sugu = Staff(user_id=usr_sugu.id, name="Dr. Sugu")
            db.add(stf_sugu)
            await db.flush()

        ps1_res = await db.execute(select(PreAllocatedSlot).where(PreAllocatedSlot.section_id == sec_bca.id, PreAllocatedSlot.timeslot_id == 2))
        if not ps1_res.scalar_one_or_none():
            db.add(PreAllocatedSlot(section_id=sec_bca.id, subject_id=sub_tamil.id, staff_id=stf_sugu.id, timeslot_id=2))

        ss_t_res = await db.execute(select(SectionSubject).where(SectionSubject.section_id == sec_bca.id, SectionSubject.subject_id == sub_tamil.id))
        if not ss_t_res.scalar_one_or_none():
            db.add(SectionSubject(section_id=sec_bca.id, subject_id=sub_tamil.id, assigned_staff_id=stf_sugu.id))

        # Maths
        sub_m_res = await db.execute(select(Subject).where(Subject.code == "MAT101"))
        sub_maths = sub_m_res.scalar_one_or_none()
        if not sub_maths:
            sub_maths = Subject(code="MAT101", name="Maths", credits=3, semester=1, department_id=dept_lang.id)
            db.add(sub_maths)
            await db.flush()

        usr_m_res = await db.execute(select(User).where(User.email == "maran@srmist.edu.in"))
        usr_maran = usr_m_res.scalar_one_or_none()
        if not usr_maran:
            usr_maran = User(email="maran@srmist.edu.in", password_hash=get_password_hash("Staff123!"), role="Staff")
            db.add(usr_maran)
            await db.flush()

        stf_m_res = await db.execute(select(Staff).where(Staff.user_id == usr_maran.id))
        stf_maran = stf_m_res.scalar_one_or_none()
        if not stf_maran:
            stf_maran = Staff(user_id=usr_maran.id, name="Dr. Maran")
            db.add(stf_maran)
            await db.flush()

        ps2_res = await db.execute(select(PreAllocatedSlot).where(PreAllocatedSlot.section_id == sec_bca.id, PreAllocatedSlot.timeslot_id == 15))
        if not ps2_res.scalar_one_or_none():
            db.add(PreAllocatedSlot(section_id=sec_bca.id, subject_id=sub_maths.id, staff_id=stf_maran.id, timeslot_id=15))

        ss_m_res = await db.execute(select(SectionSubject).where(SectionSubject.section_id == sec_bca.id, SectionSubject.subject_id == sub_maths.id))
        if not ss_m_res.scalar_one_or_none():
            db.add(SectionSubject(section_id=sec_bca.id, subject_id=sub_maths.id, assigned_staff_id=stf_maran.id))

        await db.commit()
        print("STEP 1: User pre-allocated slots added (Tamil I & Maths).")

        # Step 2: Upload Master Excel via backend import_master logic
        print("\nSTEP 2: Simulating Master Excel upload...")
        from fastapi import UploadFile
        from backend.app.api.admin import import_master
        
        with open("timetable_data.xlsx", "rb") as f:
            file_bytes = f.read()
        
        upload_file = UploadFile(filename="timetable_data.xlsx", file=io.BytesIO(file_bytes))
        
        mock_admin = type("User", (), {"id": 1, "role": "Admin"})()
        import_res = await import_master(file=upload_file, db=db, current_user=mock_admin)
        print("IMPORT MASTER RESPONSE:", import_res)

        # Step 3: Verify Pre-Allocated slots were preserved after master import
        res_post_pre = await db.execute(select(PreAllocatedSlot))
        post_pre_slots = res_post_pre.scalars().all()
        print(f"\nSTEP 3: Pre-allocated slots after Master Upload: {len(post_pre_slots)}")
        for ps in post_pre_slots:
            sec = (await db.execute(select(Section).where(Section.id == ps.section_id))).scalar_one_or_none()
            sub = (await db.execute(select(Subject).where(Subject.id == ps.subject_id))).scalar_one_or_none()
            stf = (await db.execute(select(Staff).where(Staff.id == ps.staff_id))).scalar_one_or_none()
            ts = (await db.execute(select(TimeSlot).where(TimeSlot.id == ps.timeslot_id))).scalar_one_or_none()
            print(f"  Preserved PreAlloc: Section={sec.name if sec else ps.section_id}, Subject={sub.name if sub else ps.subject_id}, Staff={stf.name if stf else ps.staff_id}, Slot={ts.day_of_week} P{ts.period_number}")

        # Step 4: Generate Master Timetable (Filling Free Spaces)
        print("\nSTEP 4: Generating Master Timetable (Filling Free Spaces)...")
        gen_res = await generate_timetable_csp(db, "2026-2027", 1)
        print("SOLVER RESULT:", gen_res)

if __name__ == "__main__":
    asyncio.run(test_full_user_workflow())
