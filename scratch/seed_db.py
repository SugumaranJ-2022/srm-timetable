import asyncio
import datetime
import io
import pandas as pd
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy import text
from sqlalchemy.future import select
from backend.app.models.models import (
    User, Department, Subject, Staff, Student, Section, Classroom, TimeSlot, SectionSubject, PreAllocatedSlot
)
from backend.app.api.auth import get_password_hash

async def import_excel():
    with open("timetable_data.xlsx", "rb") as f:
        contents = f.read()
    xls = pd.ExcelFile(io.BytesIO(contents))
    
    def read_sheet(sheet_name):
        if sheet_name in xls.sheet_names:
            return pd.read_excel(xls, sheet_name=sheet_name)
        return None

    df_depts = read_sheet("Departments")
    df_rooms = read_sheet("Classrooms")
    df_subs = read_sheet("Subjects")
    df_slots = read_sheet("Time Slots")
    df_staff = read_sheet("Staff")
    df_secs = read_sheet("Sections")
    df_sec_subs = read_sheet("Section Subjects")

    async with AsyncSessionLocal() as db:
        await db.execute(text("PRAGMA foreign_keys = OFF"))
        
        tables_to_clear = [
            "substitutions", "timetable_details", "timetables", "academic_calendar",
            "section_subjects", "staff_subject", "students", "staff", "sections",
            "classrooms", "timeslots", "subjects", "departments", "pre_allocated_slots"
        ]
        for table in tables_to_clear:
            await db.execute(text(f"DELETE FROM {table}"))
        await db.execute(text("DELETE FROM users WHERE role != 'Admin'"))
        await db.flush()

        if df_depts is not None:
            for _, row in df_depts.iterrows():
                db.add(Department(id=int(row["id"]), name=str(row["name"])))
            await db.flush()

        if df_rooms is not None:
            for _, row in df_rooms.iterrows():
                db.add(Classroom(
                    id=int(row["id"]),
                    room_number=str(row["room_number"]),
                    building=str(row["building"]),
                    floor=int(row["floor"]),
                    capacity=int(row["capacity"]),
                    is_available=bool(row.get("is_available", True))
                ))
            await db.flush()

        if df_subs is not None:
            for _, row in df_subs.iterrows():
                db.add(Subject(
                    id=int(row["id"]),
                    code=str(row["code"]),
                    name=str(row["name"]),
                    credits=int(row["credits"]),
                    semester=int(row["semester"]),
                    department_id=int(row["department_id"]),
                    is_project=bool(row.get("is_project", False))
                ))
            await db.flush()

        if df_slots is not None:
            for _, row in df_slots.iterrows():
                start_time = row["start_time"]
                end_time = row["end_time"]
                if not isinstance(start_time, datetime.time):
                    start_time = pd.to_datetime(start_time).time()
                if not isinstance(end_time, datetime.time):
                    end_time = pd.to_datetime(end_time).time()
                db.add(TimeSlot(
                    id=int(row["id"]),
                    day_of_week=str(row["day_of_week"]),
                    period_number=int(row["period_number"]),
                    start_time=start_time,
                    end_time=end_time,
                    slot_type=str(row.get("slot_type", "Regular"))
                ))
            await db.flush()

        if df_staff is not None:
            for _, row in df_staff.iterrows():
                staff_id = int(row["id"])
                email = str(row.get("email", f"staff_{staff_id}@srmist.edu.in"))
                res_u = await db.execute(select(User).where(User.email == email))
                u = res_u.scalar_one_or_none()
                if not u:
                    u = User(email=email, password_hash=get_password_hash("Staff123!"), role="Staff")
                    db.add(u)
                    await db.flush()
                db.add(Staff(
                    id=staff_id,
                    user_id=u.id,
                    name=str(row["name"])
                ))
            await db.flush()

        if df_secs is not None:
            for _, row in df_secs.iterrows():
                db.add(Section(
                    id=int(row["id"]),
                    name=str(row["name"]),
                    program=str(row["program"]),
                    semester=int(row["semester"]),
                    strength=int(row["strength"]),
                    class_advisor_id=int(row["class_advisor_id"]) if pd.notna(row.get("class_advisor_id")) else None,
                    classroom_id=int(row["classroom_id"]) if pd.notna(row.get("classroom_id")) else None,
                    project_days=str(row.get("project_days", "Monday,Wednesday,Friday")),
                    enable_zero_free_periods=bool(row.get("enable_zero_free_periods", True)),
                    enable_daily_coverage=bool(row.get("enable_daily_coverage", True)),
                    enable_project_cadence=bool(row.get("enable_project_cadence", True))
                ))
            await db.flush()

        if df_sec_subs is not None:
            for _, row in df_sec_subs.iterrows():
                db.add(SectionSubject(
                    id=int(row["id"]),
                    section_id=int(row["section_id"]),
                    subject_id=int(row["subject_id"]),
                    assigned_staff_id=int(row["assigned_staff_id"])
                ))
            await db.flush()

        await db.commit()
        print("SUCCESS: Database populated from timetable_data.xlsx")

if __name__ == "__main__":
    asyncio.run(import_excel())
