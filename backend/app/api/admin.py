import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any

from backend.app.core.database import get_db
from backend.app.core.security import get_password_hash
from backend.app.api.auth import get_current_admin, get_current_user
from backend.app.models.models import (
    User, Department, Subject, Staff, Student, Section, Classroom,
    staff_subject_association, SectionSubject
)
from backend.app.schemas.schemas import (
    DepartmentOut, DepartmentCreate, SubjectOut, SubjectCreate,
    ClassroomOut, ClassroomCreate, SectionOut, SectionCreate,
    StaffOut, StaffCreate, StudentOut, StudentCreate, SectionSubjectCreate, SectionSubjectOut,
    CalendarEventCreate, CalendarEventOut
)

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/download-template")
async def download_template(current_user = Depends(get_current_admin)):
    import os
    from fastapi.responses import FileResponse
    file_path = r"c:\Users\Welcome\Desktop\timetable-management\timetable_data.xlsx"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Template file not found.")
    return FileResponse(
        file_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="timetable_template.xlsx"
    )

# Departments CRUD
@router.get("/departments", response_model=List[DepartmentOut])
async def get_departments(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(select(Department))
    return result.scalars().all()

@router.post("/departments", response_model=DepartmentOut)
async def create_department(dept: DepartmentCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    # Check if a department with this name already exists to prevent unique constraint violation
    existing_res = await db.execute(select(Department).where(Department.name == dept.name))
    existing_dept = existing_res.scalar_one_or_none()
    if existing_dept:
        return existing_dept

    db_dept = Department(name=dept.name)
    db.add(db_dept)
    await db.commit()
    await db.refresh(db_dept)
    return db_dept

# Subjects CRUD
@router.get("/subjects", response_model=List[SubjectOut])
async def get_subjects(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(select(Subject))
    return result.scalars().all()

@router.post("/subjects", response_model=SubjectOut)
async def create_subject(sub: SubjectCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    db_sub = Subject(
        code=sub.code,
        name=sub.name,
        credits=sub.credits,
        semester=sub.semester,
        department_id=sub.department_id,
        is_project=sub.is_project
    )
    db.add(db_sub)
    await db.commit()
    await db.refresh(db_sub)
    return db_sub

# Classrooms CRUD
@router.get("/classrooms", response_model=List[ClassroomOut])
async def get_classrooms(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(select(Classroom))
    return result.scalars().all()

@router.post("/classrooms", response_model=ClassroomOut)
async def create_classroom(room: ClassroomCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    db_room = Classroom(
        room_number=room.room_number,
        building=room.building,
        floor=room.floor,
        capacity=room.capacity,
        is_available=room.is_available
    )
    db.add(db_room)
    await db.commit()
    await db.refresh(db_room)
    return db_room

# Sections CRUD
@router.get("/sections", response_model=List[SectionOut])
async def get_sections(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(select(Section))
    return result.scalars().all()

@router.post("/sections", response_model=SectionOut)
async def create_section(sec: SectionCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    db_sec = Section(
        name=sec.name,
        program=sec.program,
        semester=sec.semester,
        strength=sec.strength,
        class_advisor_id=sec.class_advisor_id,
        classroom_id=sec.classroom_id,
        project_days=sec.project_days,
        enable_zero_free_periods=sec.enable_zero_free_periods,
        enable_daily_coverage=sec.enable_daily_coverage,
        enable_project_cadence=sec.enable_project_cadence
    )
    db.add(db_sec)
    await db.commit()
    await db.refresh(db_sec)
    return db_sec

# Staff CRUD
@router.get("/staff", response_model=List[StaffOut])
async def get_staff(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(select(Staff))
    return result.scalars().all()

@router.post("/staff", response_model=StaffOut)
async def create_staff(staff_in: StaffCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    # Check if user email exists
    result = await db.execute(select(User).where(User.email == staff_in.email))
    user = result.scalar_one_or_none()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Create User
    new_user = User(
        email=staff_in.email,
        password_hash=get_password_hash(staff_in.password),
        role="Staff"
    )
    db.add(new_user)
    await db.flush()

    # Create Staff
    new_staff = Staff(
        user_id=new_user.id,
        name=staff_in.name,
        phone=staff_in.phone,
        status=staff_in.status,
        profile_photo_url=staff_in.profile_photo_url
    )
    db.add(new_staff)
    await db.flush()

    # Handle subjects mappings (competency pools)
    if staff_in.subject_ids:
        for sub_id in staff_in.subject_ids:
            # Check subject exists
            sub_res = await db.execute(select(Subject).where(Subject.id == sub_id))
            sub = sub_res.scalar_one_or_none()
            if sub:
                # Add relationship to association table
                stmt = staff_subject_association.insert().values(
                    staff_id=new_staff.id,
                    subject_id=sub_id
                )
                await db.execute(stmt)
    
    await db.commit()
    await db.refresh(new_staff)
    return new_staff

# Students CRUD
@router.get("/students", response_model=List[StudentOut])
async def get_students(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(select(Student))
    return result.scalars().all()

@router.post("/students", response_model=StudentOut)
async def create_student(student_in: StudentCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    result = await db.execute(select(User).where(User.email == student_in.email))
    user = result.scalar_one_or_none()
    if user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    new_user = User(
        email=student_in.email,
        password_hash=get_password_hash(student_in.password),
        role="Student"
    )
    db.add(new_user)
    await db.flush()

    new_student = Student(
        user_id=new_user.id,
        register_number=student_in.register_number,
        section_id=student_in.section_id,
        semester=student_in.semester
    )
    db.add(new_student)
    await db.commit()
    await db.refresh(new_student)
    return new_student

# SectionSubject association CRUD (Maps which staff teaches which subject in which section)
@router.get("/section-subjects", response_model=List[SectionSubjectOut])
async def get_section_subjects(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    result = await db.execute(select(SectionSubject))
    return result.scalars().all()

@router.post("/section-subjects", response_model=SectionSubjectOut)
async def create_section_subject(
    ss: SectionSubjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    db_ss = SectionSubject(
        section_id=ss.section_id,
        subject_id=ss.subject_id,
        assigned_staff_id=ss.assigned_staff_id
    )
    db.add(db_ss)
    await db.commit()
    await db.refresh(db_ss)
    return db_ss

# Bulk Import CSV / Excel Endpoint
@router.post("/import")
async def bulk_import(
    type: str, # "staff", "classrooms", "subjects", "students", "sections"
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    contents = await file.read()
    
    # Read file using pandas
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        elif file.filename.endswith((".xls", ".xlsx")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Must be CSV or Excel.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")

    imported_count = 0

    if type == "classrooms":
        # Columns: room_number, building, floor, capacity
        for _, row in df.iterrows():
            room = Classroom(
                room_number=str(row["room_number"]),
                building=str(row["building"]),
                floor=int(row["floor"]),
                capacity=int(row["capacity"]),
                is_available=True
            )
            db.add(room)
            imported_count += 1

    elif type == "departments":
        # Columns: name
        for _, row in df.iterrows():
            dept = Department(name=str(row["name"]))
            db.add(dept)
            imported_count += 1

    elif type == "subjects":
        # Columns: code, name, credits, semester, department_id, is_project
        for _, row in df.iterrows():
            is_proj = bool(row.get("is_project")) if pd.notna(row.get("is_project")) else False
            subject = Subject(
                code=str(row["code"]),
                name=str(row["name"]),
                credits=int(row["credits"]),
                semester=int(row["semester"]),
                department_id=int(row["department_id"]),
                is_project=is_proj
            )
            db.add(subject)
            imported_count += 1

    elif type == "sections":
        # Columns: name, semester, strength, class_advisor_id (optional), classroom_id (optional), program, project_days (optional)
        for _, row in df.iterrows():
            advisor_id = int(row["class_advisor_id"]) if pd.notna(row.get("class_advisor_id")) else None
            classroom_id = int(row["classroom_id"]) if pd.notna(row.get("classroom_id")) else None
            section = Section(
                name=str(row["name"]),
                program=str(row.get("program", "MCA")),
                semester=int(row["semester"]),
                strength=int(row["strength"]),
                class_advisor_id=advisor_id,
                classroom_id=classroom_id,
                project_days=str(row.get("project_days", "Monday,Wednesday,Friday")),
                enable_zero_free_periods=True,
                enable_daily_coverage=True,
                enable_project_cadence=True
            )
            db.add(section)
            imported_count += 1

    elif type == "staff":
        # Columns: email, password, name, phone
        for _, row in df.iterrows():
            email = str(row["email"])
            res = await db.execute(select(User).where(User.email == email))
            if res.scalar_one_or_none():
                continue # Skip existing
            
            password = str(row.get("password", "StaffPassword123!"))
            user = User(
                email=email,
                password_hash=get_password_hash(password),
                role="Staff"
            )
            db.add(user)
            await db.flush()

            staff = Staff(
                user_id=user.id,
                name=str(row["name"]),
                phone=str(row.get("phone", "")),
                status="Active"
            )
            db.add(staff)
            imported_count += 1

    elif type == "students":
        # Columns: email, password, register_number, section_id, semester
        for _, row in df.iterrows():
            email = str(row["email"])
            res = await db.execute(select(User).where(User.email == email))
            if res.scalar_one_or_none():
                continue
            
            password = str(row.get("password", "StudentPassword123!"))
            user = User(
                email=email,
                password_hash=get_password_hash(password),
                role="Student"
            )
            db.add(user)
            await db.flush()

            section_id = int(row["section_id"]) if pd.notna(row.get("section_id")) else None
            student = Student(
                user_id=user.id,
                register_number=str(row["register_number"]),
                section_id=section_id,
                semester=int(row["semester"])
            )
            db.add(student)
            imported_count += 1

    elif type == "calendar":
        # Columns: date, title, type, description (optional)
        from backend.app.models.models import AcademicCalendarEvent
        for _, row in df.iterrows():
            new_event = AcademicCalendarEvent(
                date=str(row["date"]),
                title=str(row["title"]),
                type=str(row["type"]),
                description=str(row["description"]) if pd.notna(row.get("description")) else None
            )
            db.add(new_event)
            imported_count += 1
            
    else:
         raise HTTPException(status_code=400, detail="Invalid import type specified.")

    await db.commit()
    return {"message": f"Successfully imported {imported_count} records.", "count": imported_count}

@router.post("/import-master")
async def import_master(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    import datetime
    from sqlalchemy import text
    from backend.app.core.solver import generate_timetable_csp
    from backend.app.models.models import (
        User, Department, Subject, Staff, Student, Section, Classroom, TimeSlot, SectionSubject
    )
    
    contents = await file.read()
    try:
        xls = pd.ExcelFile(io.BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading Excel file: {str(e)}")

    # Helper function to read sheet safely
    def read_sheet(sheet_name):
        if sheet_name in xls.sheet_names:
            return pd.read_excel(xls, sheet_name=sheet_name)
        return None

    # Load sheets
    df_depts = read_sheet("Departments")
    df_rooms = read_sheet("Classrooms")
    df_subs = read_sheet("Subjects")
    df_slots = read_sheet("Time Slots")
    df_staff = read_sheet("Staff")
    df_comp = read_sheet("Staff Competency")
    df_secs = read_sheet("Sections")
    df_sec_subs = read_sheet("Section Subjects")
    df_students = read_sheet("Students")
    df_calendar = read_sheet("Academic Calendar")

    # Detect database dialect for correct truncation strategy
    from backend.app.core.config import settings
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")

    if is_sqlite:
        await db.execute(text("PRAGMA foreign_keys = OFF"))

    # Truncate all tables
    tables_to_clear = [
        "substitutions",
        "timetable_details",
        "timetables",
        "academic_calendar",
        "section_subjects",
        "staff_subject",
        "students",
        "staff",
        "sections",
        "classrooms",
        "timeslots",
        "subjects",
        "departments"
    ]
    for table in tables_to_clear:
        if is_sqlite:
            await db.execute(text(f"DELETE FROM {table}"))
        else:
            await db.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
    
    # Delete non-admin users
    await db.execute(text("DELETE FROM users WHERE role != 'Admin'"))
    await db.flush()

    # 1. Insert Departments
    if df_depts is not None:
        for _, row in df_depts.iterrows():
            db.add(Department(id=int(row["id"]), name=str(row["name"])))
        await db.flush()

    # 2. Insert Classrooms
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

    # 3. Insert Subjects
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

    # 4. Insert Time Slots
    if df_slots is not None:
        for _, row in df_slots.iterrows():
            start_time = row["start_time"]
            end_time = row["end_time"]
            if isinstance(start_time, datetime.time):
                pass
            else:
                start_time = pd.to_datetime(start_time).time()

            if isinstance(end_time, datetime.time):
                pass
            else:
                end_time = pd.to_datetime(end_time).time()
            
            db.add(TimeSlot(
                id=int(row["id"]),
                day_of_week=str(row["day_of_week"]),
                period_number=int(row["period_number"]),
                start_time=start_time,
                end_time=end_time,
                slot_type=str(row["slot_type"])
            ))
        await db.flush()

    # 5. Insert Users and Staff
    if df_staff is not None:
        for _, row in df_staff.iterrows():
            user_id = int(row["user_id"])
            email = str(row["email"])
            db.add(User(
                id=user_id,
                email=email,
                password_hash=get_password_hash("Staff123!"),
                role="Staff"
            ))
            await db.flush()
            
            db.add(Staff(
                id=int(row["id"]),
                user_id=user_id,
                name=str(row["name"]),
                phone=str(row["phone"]) if pd.notna(row.get("phone")) else None,
                status=str(row.get("status", "Active")),
                profile_photo_url=str(row["profile_photo_url"]) if pd.notna(row.get("profile_photo_url")) else None
            ))
        await db.flush()

    # 6. Insert Staff Competency
    if df_comp is not None:
        for _, row in df_comp.iterrows():
            stmt = staff_subject_association.insert().values(
                staff_id=int(row["staff_id"]),
                subject_id=int(row["subject_id"])
            )
            await db.execute(stmt)
        await db.flush()

    # 7. Insert Sections
    if df_secs is not None:
        for _, row in df_secs.iterrows():
            advisor_id = int(row["class_advisor_id"]) if pd.notna(row.get("class_advisor_id")) else None
            classroom_id = int(row["classroom_id"]) if pd.notna(row.get("classroom_id")) else None
            db.add(Section(
                id=int(row["id"]),
                name=str(row["name"]),
                program=str(row["program"]),
                semester=int(row["semester"]),
                strength=int(row["strength"]),
                class_advisor_id=advisor_id,
                classroom_id=classroom_id,
                project_days=str(row.get("project_days", "Monday,Wednesday,Friday")),
                enable_zero_free_periods=bool(row.get("enable_zero_free_periods", True)),
                enable_daily_coverage=bool(row.get("enable_daily_coverage", True)),
                enable_project_cadence=bool(row.get("enable_project_cadence", True))
            ))
        await db.flush()

    # 8. Insert Section Subjects
    if df_sec_subs is not None:
        for _, row in df_sec_subs.iterrows():
            db.add(SectionSubject(
                id=int(row["id"]),
                section_id=int(row["section_id"]),
                subject_id=int(row["subject_id"]),
                assigned_staff_id=int(row["assigned_staff_id"])
            ))
        await db.flush()

    # 9. Insert Users and Students
    if df_students is not None:
        for _, row in df_students.iterrows():
            user_id = int(row["user_id"])
            email = str(row["email"])
            db.add(User(
                id=user_id,
                email=email,
                password_hash=get_password_hash("Student123!"),
                role="Student"
            ))
            await db.flush()
            
            db.add(Student(
                id=int(row["id"]),
                user_id=user_id,
                register_number=str(row["register_number"]),
                section_id=int(row["section_id"]) if pd.notna(row.get("section_id")) else None,
                semester=int(row["semester"])
            ))
        await db.flush()

    # Seed academic calendar events
    from backend.app.models.models import AcademicCalendarEvent
    if df_calendar is not None:
        for _, row in df_calendar.iterrows():
            db.add(AcademicCalendarEvent(
                date=str(row["date"]),
                title=str(row["title"]),
                type=str(row["type"]),
                description=str(row["description"]) if pd.notna(row.get("description")) else None
            ))
    else:
        # Seed default academic calendar events
        CALENDAR_EVENTS = [
            {"date": '2026-06-15', "title": 'Course Enrolment (II & III Year UG & II Year PG)', "type": 'event', "description": 'Course enrolment commences for II & III Year UG and II Year PG students.'},
            {"date": '2026-06-17', "title": 'Reopening for Faculty Members', "type": 'announcement', "description": 'Faculty members report back to campus after vacation.'},
            {"date": '2026-06-22', "title": 'Commencement of First Year Enrolment Process', "type": 'event', "description": 'First year UG & PG student enrolment process begins.'},
            {"date": '2026-06-24', "title": 'Commencement of Classes (II & III Year UG & II Year PG)', "type": 'event', "description": 'Classes commence for II & III Year UG and II Year PG students.'},
            {"date": '2026-06-26', "title": 'Moharam — Holiday', "type": 'holiday', "description": 'National/Religious Holiday — No classes.'},
            {"date": '2026-06-29', "title": 'Course Enrolment (First Year UG & PG)', "type": 'event', "description": 'Course enrolment for First Year UG & PG students.'},
            {"date": '2026-07-08', "title": 'Commencement of Classes — First Year UG & PG', "type": 'event', "description": 'Classes commence for all First Year UG & PG students.'},
            {"date": '2026-08-04', "title": 'Cycle Test – I (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Internal Assessment / Cycle Test I for II & III Year UG & II Year PG (Except First Year).'},
            {"date": '2026-08-05', "title": 'Cycle Test – I (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Cycle Test I continues — II & III Year UG & II Year PG (Except First Year).'},
            {"date": '2026-08-06', "title": 'Cycle Test – I (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Cycle Test I continues — II & III Year UG & II Year PG (Except First Year).'},
            {"date": '2026-08-07', "title": 'Cycle Test – I (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Cycle Test I continues — II & III Year UG & II Year PG (Except First Year).'},
            {"date": '2026-08-11', "title": 'Cycle Test – I (First Year UG & PG)', "type": 'exam', "description": 'Internal Assessment / Cycle Test I for First Year UG & PG students.'},
            {"date": '2026-08-12', "title": 'Cycle Test – I (First Year UG & PG)', "type": 'exam', "description": 'Cycle Test I continues — First Year UG & PG students.'},
            {"date": '2026-08-13', "title": 'Cycle Test – I (First Year UG & PG)', "type": 'exam', "description": 'Cycle Test I continues — First Year UG & PG students.'},
            {"date": '2026-08-14', "title": 'Cycle Test – I (First Year UG & PG)', "type": 'exam', "description": 'Cycle Test I continues — First Year UG & PG students.'},
            {"date": '2026-08-15', "title": 'Independence Day — Holiday', "type": 'holiday', "description": 'National Holiday — No classes on Independence Day.'},
            {"date": '2026-08-17', "title": 'Question Paper Setting Last Date (SRMIST Exams)', "type": 'announcement', "description": 'Last date for question paper setting for all SRMIST IST Examinations — ALL UG & PG.'},
            {"date": '2026-08-26', "title": 'Miladi Nabi — Holiday', "type": 'holiday', "description": 'Religious Holiday — Prophet\'s Birthday. No classes.'},
            {"date": '2026-09-05', "title": "Teachers' Day — Holiday", "type": 'holiday', "description": 'Teachers\' Day celebration. Holiday for all.'},
            {"date": '2026-09-14', "title": 'Vinayagar Chathurthi — Holiday', "type": 'holiday', "description": 'Vinayagar Chathurthi festival. National/Regional Holiday.'},
            {"date": '2026-09-15', "title": 'Cycle Test – II (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Cycle Test II begins for II & III Year UG & II Year PG (Except First Year).'},
            {"date": '2026-09-16', "title": 'Cycle Test – II (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Cycle Test II continues.'},
            {"date": '2026-09-17', "title": 'Cycle Test – II (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Cycle Test II continues.'},
            {"date": '2026-09-18', "title": 'Cycle Test – II (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Cycle Test II continues.'},
            {"date": '2026-09-21', "title": 'Cycle Test – II (First Year UG & PG)', "type": 'exam', "description": 'Cycle Test II for First Year UG & PG students.'},
            {"date": '2026-09-22', "title": 'Cycle Test – II (First Year UG & PG)', "type": 'exam', "description": 'Cycle Test II continues — First Year UG & PG.'},
            {"date": '2026-09-23', "title": 'Commencement of Model Practical Examination (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Model Practical Exam begins for II & III Year UG & II Year PG.'},
            {"date": '2026-09-25', "title": 'Commencement of Model Practical Examination (First Year UG & PG)', "type": 'exam', "description": 'Model Practical Exam commences for First Year UG & PG students.'},
            {"date": '2026-09-28', "title": 'Model Practical Examination', "type": 'exam', "description": 'Model Practical Examination continues for all UG & PG.'},
            {"date": '2026-09-29', "title": 'Model Practical Examination', "type": 'exam', "description": 'Model Practical Examination continues.'},
            {"date": '2026-09-30', "title": 'Model Practical Examination', "type": 'exam', "description": 'Model Practical Examination continues.'},
            {"date": '2026-10-01', "title": 'Model Practical Examination', "type": 'exam', "description": 'Model Practical Examination continues.'},
            {"date": '2026-10-02', "title": 'Gandhi Jayanthi — Holiday', "type": 'holiday', "description": 'National Holiday — Gandhi Jayanthi. No classes.'},
            {"date": '2026-10-05', "title": 'Model Practical Examination', "type": 'exam', "description": 'Model Practical Examination continues.'},
            {"date": '2026-10-06', "title": 'Commencement of Model Theory Examination (II & III Year UG & II Year PG)', "type": 'exam', "description": 'Model Theory Examination commences for II & III Year UG & II Year PG.'},
            {"date": '2026-10-08', "title": 'Commencement of Model Theory Examination (First Year UG & PG)', "type": 'exam', "description": 'Model Theory Examination commences for First Year UG & PG.'},
            {"date": '2026-10-14', "title": 'University Practical / Project Viva Voce Examination (ALL UG & PG, Except First Year)', "type": 'exam', "description": 'Commencement of University Practical / Project Viva Voce Examination.'},
            {"date": '2026-10-16', "title": 'University Practical / Project Viva Voce Examination (First Year UG & PG) — Last Working Day', "type": 'exam', "description": 'University Practical / Project Viva Voce Examination for First Year. Also Last Working Day for First Year.'},
            {"date": '2026-10-19', "title": 'Saraswathi Pooja — Holiday', "type": 'holiday', "description": 'Saraswathi Pooja Festival Holiday.'},
            {"date": '2026-10-20', "title": 'Vijayadasami — Holiday', "type": 'holiday', "description": 'Vijayadasami Festival Holiday. No classes.'},
            {"date": '2026-10-21', "title": 'Detention List Submission / Practical Examination', "type": 'announcement', "description": 'Detention List Submission deadline. University Practical Examination also continues.'},
            {"date": '2026-10-26', "title": 'Internal Marks Submission (ALL UG & PG)', "type": 'announcement', "description": 'Last date for Internal Marks Submission for all UG & PG programmes.'},
            {"date": '2026-11-02', "title": 'Commencement of University Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester University Theory Examinations begin for all UG & PG programmes.'},
            {"date": '2026-11-03', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-04', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-05', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-06', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-08', "title": 'Deepawali — Holiday', "type": 'holiday', "description": 'Deepawali Festival Holiday. No examinations.'},
            {"date": '2026-11-10', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations resume after Deepawali.'},
            {"date": '2026-11-11', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-12', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-13', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-14', "title": 'End Semester Theory Examination (ALL UG & PG)', "type": 'exam', "description": 'End Semester Theory Examinations continue.'},
            {"date": '2026-11-16', "title": 'Commencement of Central Valuation', "type": 'announcement', "description": 'Answer scripts central valuation commences for all UG & PG programmes.'},
            {"date": '2026-11-20', "title": 'Course Enrolment for Even Semester (ALL UG & PG)', "type": 'event', "description": 'Course Enrolment opens for Even Semester for all UG & PG students.'},
            {"date": '2026-11-30', "title": 'Commencement of Even Semester Classes (ALL UG & PG)', "type": 'event', "description": 'Even Semester classes begin for all UG & PG programmes.'},
            {"date": '2027-01-19', "title": 'Cycle Test – I (Even Semester)', "type": 'exam', "description": 'Cycle Test I for Even Semester — All UG & PG.'},
            {"date": '2027-01-29', "title": 'Question Paper Setting Last Date (Even Semester SRM IST Exams)', "type": 'announcement', "description": 'Last date for question paper setting for Even Semester SRMIST Examinations.'},
            {"date": '2027-03-02', "title": 'Cycle Test – II (Even Semester)', "type": 'exam', "description": 'Cycle Test II for Even Semester — All UG & PG.'},
            {"date": '2027-03-09', "title": 'Commencement of Model Practical Examinations (Even Sem)', "type": 'exam', "description": 'Model Practical Examinations commence for Even Semester.'},
            {"date": '2027-03-24', "title": 'Commencement of Model Theory Examination (Even Sem)', "type": 'exam', "description": 'Model Theory Examinations commence for Even Semester.'},
            {"date": '2027-04-02', "title": 'Last Working Day (Even Semester)', "type": 'announcement', "description": 'Last working day for Even Semester 2026-27.'},
            {"date": '2027-04-05', "title": 'Detention List Submission (Even Semester)', "type": 'announcement', "description": 'Detention list submission deadline for Even Semester.'},
            {"date": '2027-04-05', "title": 'University Practical Examination (Even Semester)', "type": 'exam', "description": 'Commencement of University Practical / Project Viva Voce Examinations — Even Semester.'},
            {"date": '2027-04-09', "title": 'Internal Marks Submission (Even Semester)', "type": 'announcement', "description": 'Last date for Internal Marks Submission for Even Semester.'},
            {"date": '2027-04-20', "title": 'Commencement of University Theory Examination (Even Sem)', "type": 'exam', "description": 'End Semester University Theory Examinations begin for Even Semester 2026-27.'},
            {"date": '2027-05-05', "title": 'Commencement of Central Valuation (Even Semester)', "type": 'announcement', "description": 'Central Valuation of answer scripts begins for Even Semester.'}
        ]
        for ev in CALENDAR_EVENTS:
            db.add(AcademicCalendarEvent(
                date=ev["date"],
                title=ev["title"],
                type=ev["type"],
                description=ev["description"]
            ))
    await db.flush()

    # Re-enable foreign keys (SQLite only)
    if is_sqlite:
        await db.execute(text("PRAGMA foreign_keys = ON"))
    await db.commit()

    # Automatically generate timetable for unique semesters
    res_secs = await db.execute(select(Section))
    all_sections = res_secs.scalars().all()
    semesters = {sec.semester for sec in all_sections}
    
    generation_results = []
    for sem in sorted(semesters):
        gen_res = await generate_timetable_csp(db, "2026-2027", sem)
        generation_results.append({
            "semester": sem,
            "success": gen_res.get("success", False),
            "message": gen_res.get("message", "")
        })

    return {
        "message": "Master Excel imported successfully. Timetables have been auto-generated.",
        "count": len(all_sections),
        "imported_sheets": list(xls.sheet_names),
        "generation_results": generation_results
    }


# --- Calendar Event CRUD ---
@router.get("/calendar-events", response_model=List[CalendarEventOut])
async def get_calendar_events(
    db: AsyncSession = Depends(get_db),
):
    from backend.app.models.models import AcademicCalendarEvent
    res = await db.execute(select(AcademicCalendarEvent))
    events = res.scalars().all()
    return events

@router.post("/calendar-events", response_model=CalendarEventOut, status_code=status.HTTP_201_CREATED)
async def create_calendar_event(
    req: CalendarEventCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    from backend.app.models.models import AcademicCalendarEvent
    new_event = AcademicCalendarEvent(
        date=req.date,
        title=req.title,
        type=req.type,
        description=req.description
    )
    db.add(new_event)
    await db.commit()
    await db.refresh(new_event)
    return new_event

@router.delete("/calendar-events-clear", status_code=status.HTTP_200_OK)
async def clear_all_calendar_events(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    from sqlalchemy import text
    await db.execute(text("DELETE FROM academic_calendar"))
    await db.commit()
    return {"message": "All academic calendar events have been wiped successfully."}

@router.delete("/calendar-events/{event_id}", status_code=status.HTTP_200_OK)
async def delete_calendar_event(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    from backend.app.models.models import AcademicCalendarEvent
    res = await db.execute(select(AcademicCalendarEvent).where(AcademicCalendarEvent.id == event_id))
    event = res.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    await db.delete(event)
    await db.commit()
    return {"message": "Event deleted successfully"}

