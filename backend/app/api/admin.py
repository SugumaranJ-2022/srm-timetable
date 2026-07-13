import io
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any

from backend.app.core.database import get_db
from backend.app.core.security import get_password_hash
from backend.app.api.auth import get_current_admin
from backend.app.models.models import (
    User, Department, Subject, Staff, Student, Section, Classroom,
    staff_subject_association, SectionSubject
)
from backend.app.schemas.schemas import (
    DepartmentOut, DepartmentCreate, SubjectOut, SubjectCreate,
    ClassroomOut, ClassroomCreate, SectionOut, SectionCreate,
    StaffOut, StaffCreate, StudentOut, StudentCreate, SectionSubjectCreate, SectionSubjectOut
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
async def get_departments(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    result = await db.execute(select(Department))
    return result.scalars().all()

@router.post("/departments", response_model=DepartmentOut)
async def create_department(dept: DepartmentCreate, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
    db_dept = Department(name=dept.name)
    db.add(db_dept)
    await db.commit()
    await db.refresh(db_dept)
    return db_dept

# Subjects CRUD
@router.get("/subjects", response_model=List[SubjectOut])
async def get_subjects(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
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
async def get_classrooms(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
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
async def get_sections(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
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
async def get_staff(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
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
async def get_students(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
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
async def get_section_subjects(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_admin)):
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
        # Columns: name, semester, strength, class_advisor_id (optional), program, project_days (optional)
        for _, row in df.iterrows():
            advisor_id = int(row["class_advisor_id"]) if pd.notna(row.get("class_advisor_id")) else None
            section = Section(
                name=str(row["name"]),
                program=str(row.get("program", "MCA")),
                semester=int(row["semester"]),
                strength=int(row["strength"]),
                class_advisor_id=advisor_id,
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

    # Disable foreign keys in SQLite for bulk reload safety
    await db.execute(text("PRAGMA foreign_keys = OFF"))

    # Truncate all tables
    tables_to_clear = [
        "timetable_details",
        "timetables",
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
        await db.execute(text(f"DELETE FROM {table}"))
    
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
            db.add(Section(
                id=int(row["id"]),
                name=str(row["name"]),
                program=str(row["program"]),
                semester=int(row["semester"]),
                strength=int(row["strength"]),
                class_advisor_id=advisor_id,
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

    # Re-enable foreign keys
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
