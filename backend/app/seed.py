import asyncio
import datetime
from sqlalchemy.future import select
from backend.app.core.database import Base, engine, AsyncSessionLocal
from backend.app.core.security import get_password_hash
from backend.app.models.models import (
    User, Department, Subject, Staff, Student, Section, Classroom, TimeSlot,
    staff_subject_association, SectionSubject
)

# Baseline data definitions
DEPARTMENTS = ["Computer Applications"]

# Subjects and credits representing weekly class count
SUBJECTS_DATA = [
    # code, name, credits, semester, is_project
    # MCA
    ("MCA-DCN", "Data Communication & Networks", 5, 1, False),
    ("MCA-CQC", "Cryptography & Quantum Computing", 6, 1, False),
    ("MCA-BD", "Big Data", 5, 1, False),
    ("MCA-CV", "Computer Vision", 6, 1, False),
    ("MCA-PRJ", "Project", 3, 1, True),
    
    # MCA (Gen AI)
    ("MCAGAI-DCN", "Data Communication & Networks", 5, 1, False),
    ("MCAGAI-CQC", "Cryptography & Quantum Computing", 6, 1, False),
    ("MCAGAI-BD", "Big Data", 5, 1, False),
    ("MCAGAI-CV", "Computer Vision", 6, 1, False),
    ("MCAGAI-PRJ", "Project", 3, 1, True),
    
    # M.Sc.
    ("MSC-DCN", "Data Communication & Networks", 5, 1, False),
    ("MSC-CQC", "Cryptography & Quantum Computing", 6, 1, False),
    ("MSC-BD", "Big Data", 5, 1, False),
    ("MSC-CV", "Computer Vision", 6, 1, False),
    ("MSC-PRJ", "Project", 3, 1, True),
    
    # BCA
    ("BCA-PF", "Programming Fundamentals", 5, 1, False),
    ("BCA-WD", "Web Development", 6, 1, False),
    ("BCA-DBMS", "Database Management Systems", 5, 1, False),
    ("BCA-CN", "Computer Networks", 6, 1, False),
    ("BCA-PRJ", "Project", 3, 1, True)
]

SECTIONS_DATA = [
    # name, program, semester, strength
    ("MCA A", "MCA", 1, 50),
    ("MCA B", "MCA", 1, 48),
    ("MCA C", "MCA", 1, 52),
    ("MCA D", "MCA", 1, 45),
    ("MCA E", "MCA", 1, 47),
    ("MCA (Gen AI) A", "MCA_GENAI", 1, 40),
    ("MCA (Gen AI) B", "MCA_GENAI", 1, 42),
    ("MCA (Gen AI) C", "MCA_GENAI", 1, 38),
    ("M.Sc. A", "MSC", 1, 45),
    ("M.Sc. B", "MSC", 1, 48),
    ("BCA A", "BCA", 1, 45),
    ("BCA B", "BCA", 1, 48),
    ("BCA C", "BCA", 1, 42)
]

# 45 Custom Staff members
STAFF_ROSTER = [
    "Dr. Rajesh Kumar", "Dr. Priya Sharma", "Dr. Arun Alagappan", "Dr. Sandeep Goel",
    "Dr. Amit Patel", "Dr. Shalini Rao", "Dr. Vikram Seth", "Dr. Pooja Hegde",
    "Dr. Rajeev Nair", "Dr. Neha Kapoor", "Dr. Preeti Sen", "Dr. Manoj Verma",
    "Dr. Divya Iyer", "Dr. Harish Joshi", "Dr. Kirti Azad", "Dr. Vivek Oberoi",
    "Dr. Deepa Nair", "Dr. Surya Kumar", "Dr. Fahadh Faasil", "Dr. Mahesh Babu",
    "Mr. Anand Subramanian", "Mr. Vijay Kulkarni", "Mr. Rajesh Pillai", "Mr. Suresh Raina",
    "Mr. Nitin Gadkari", "Mr. Sanjay Dutt", "Mr. Rohan Bopanna", "Mr. Tarun Tahiliani",
    "Mr. Nani Ghose", "Mr. Dulquer Salmaan", "Mr. Nivin Pauly", "Mr. Karthi Sivakumar",
    "Ms. Anitha Devi", "Ms. Meena Jasmine", "Ms. Kavitha Rao", "Ms. Anjali Patil",
    "Ms. Sneha Reddy", "Ms. Archana Puran", "Ms. Gouri Kishan", "Ms. Keerthy Suresh",
    "Ms. Samantha Ruth", "Ms. Nazriya Nazim", "Ms. Sai Pallavi", "Ms. Parvathy Thiruvothu",
    "Ms. Jyothika Saravanan"
]

CLASSROOMS_DATA = [
    # room_number, building, floor, capacity
    # 20 classrooms to ensure no resource bottlenecks
    ("LH-101", "Science Block", 1, 60),
    ("LH-102", "Science Block", 1, 60),
    ("LH-103", "Science Block", 1, 60),
    ("LH-104", "Science Block", 1, 60),
    ("LH-105", "Science Block", 1, 60),
    ("LH-106", "Science Block", 1, 60),
    ("LH-107", "Science Block", 1, 60),
    ("LH-108", "Science Block", 1, 60),
    ("LH-109", "Science Block", 1, 60),
    ("LH-110", "Science Block", 1, 60),
    ("LH-201", "Main Block", 2, 60),
    ("LH-202", "Main Block", 2, 60),
    ("LH-203", "Main Block", 2, 60),
    ("LH-204", "Main Block", 2, 60),
    ("LH-205", "Main Block", 2, 60),
    ("LH-206", "Main Block", 2, 60),
    ("LH-207", "Main Block", 2, 60),
    ("LH-208", "Main Block", 2, 60),
    ("LH-209", "Main Block", 2, 60),
    ("LH-210", "Main Block", 2, 60)
]

# Time intervals (5 teaching periods/day + 1 Break = 6 slots total)
TIMESLOT_TEMPLATES = [
    # period, type, start, end
    (1, "Regular", datetime.time(8, 15), datetime.time(9, 0)),
    (2, "Regular", datetime.time(9, 0), datetime.time(9, 45)),
    (3, "Regular", datetime.time(9, 45), datetime.time(10, 30)),
    (4, "Break", datetime.time(10, 30), datetime.time(11, 0)),
    (5, "Regular", datetime.time(11, 0), datetime.time(11, 45)),
    (6, "Regular", datetime.time(11, 45), datetime.time(12, 30))
]

DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

async def seed_data():
    # Drop existing tables and recreate them to ensure a clean database state
    async with engine.begin() as conn:
        print("Dropping all existing tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        print("Seeding baseline data...")

        # 1. Create Admin User
        admin_user = User(
            email="admin@college.edu",
            password_hash=get_password_hash("Admin123!"),
            role="Admin"
        )
        db.add(admin_user)
        await db.flush()

        # 2. Create Departments
        depts_dict = {}
        for dname in DEPARTMENTS:
            dept = Department(name=dname)
            db.add(dept)
            await db.flush()
            depts_dict[dname] = dept.id

        # 3. Create Subjects
        subs_dict = {}
        for code, name, credits, semester, is_project in SUBJECTS_DATA:
            sub = Subject(
                code=code,
                name=name,
                credits=credits,
                semester=semester,
                department_id=depts_dict["Computer Applications"],
                is_project=is_project
            )
            db.add(sub)
            await db.flush()
            subs_dict[code] = sub

        # 4. Create Classrooms
        rooms = []
        for rm, bld, fl, cap in CLASSROOMS_DATA:
            room = Classroom(
                room_number=rm,
                building=bld,
                floor=fl,
                capacity=cap,
                is_available=True
            )
            db.add(room)
            rooms.append(room)
        await db.flush()

        # 5. Create TimeSlots (5 days * 6 periods = 30 slots)
        for day in DAYS_OF_WEEK:
            for period, stype, start, end in TIMESLOT_TEMPLATES:
                ts = TimeSlot(
                    day_of_week=day,
                    period_number=period,
                    start_time=start,
                    end_time=end,
                    slot_type=stype
                )
                db.add(ts)
        await db.flush()

        # 6. Create Staff Roster & Users
        staff_list = []
        for i, name in enumerate(STAFF_ROSTER):
            # Email clean
            email_pref = name.lower().replace(".", "").replace(" ", "")
            email = f"{email_pref}@college.edu"
            
            user = User(
                email=email,
                password_hash=get_password_hash("Staff123!"),
                role="Staff"
            )
            db.add(user)
            await db.flush()

            staff = Staff(
                user_id=user.id,
                name=name,
                phone=f"+9198765432{i:02d}",
                status="Active"
            )
            db.add(staff)
            staff_list.append(staff)
        await db.flush()

        # 7. Add StaffSubject associations (Competency pool)
        # We split the 45 staff members:
        # - Staff 0 to 10 (11 staff members) teach MCA subjects (indices 0 to 4 in subject_list)
        # - Staff 11 to 20 (10 staff members) teach MCA (Gen AI) subjects (indices 5 to 9 in subject_list)
        # - Staff 21 to 30 (10 staff members) teach M.Sc. subjects (indices 10 to 14 in subject_list)
        # - Staff 31 to 44 (14 staff members) teach BCA subjects (indices 15 to 19 in subject_list)
        subject_list = list(subs_dict.values())
        
        # Build local competency mapping for quick lookup
        staff_competency = {}
        for idx, staff in enumerate(staff_list):
            if idx <= 10:
                # MCA
                offset = 0
                idx_in_P = idx
            elif idx <= 20:
                # MCA Gen AI
                offset = 5
                idx_in_P = idx - 11
            elif idx <= 30:
                # MSC
                offset = 10
                idx_in_P = idx - 21
            else:
                # BCA
                offset = 15
                idx_in_P = idx - 31
            
            sub1 = subject_list[offset + (idx_in_P % 5)]
            sub2 = subject_list[offset + ((idx_in_P + 2) % 5)]
            staff_competency[staff.id] = [sub1.id, sub2.id]
            
            stmt1 = staff_subject_association.insert().values(staff_id=staff.id, subject_id=sub1.id)
            stmt2 = staff_subject_association.insert().values(staff_id=staff.id, subject_id=sub2.id)
            await db.execute(stmt1)
            await db.execute(stmt2)
        await db.flush()

        # 8. Create Sections
        sections_dict = {}
        for sname, prog, sem, strength in SECTIONS_DATA:
            # Assign advisor (take first few staff members as advisors)
            advisor = staff_list[len(sections_dict) % len(staff_list)]
            sec = Section(
                name=sname,
                program=prog,
                semester=sem,
                strength=strength,
                class_advisor_id=advisor.id,
                project_days="Monday,Wednesday,Friday",
                enable_zero_free_periods=True,
                enable_daily_coverage=True,
                enable_project_cadence=True
            )
            db.add(sec)
            await db.flush()
            sections_dict[sname] = sec

        # 9. Create SectionSubject mappings (with load balancing)
        staff_load = {staff.id: 0 for staff in staff_list}
        
        for sec_name, sec in sections_dict.items():
            # Assign appropriate subjects to sections based on program
            if sec.program == "MCA":
                sec_subs = subject_list[0:5]
            elif sec.program == "MCA_GENAI":
                sec_subs = subject_list[5:10]
            elif sec.program == "MSC":
                sec_subs = subject_list[10:15]
            elif sec.program == "BCA":
                sec_subs = subject_list[15:20]
            else:
                sec_subs = []
            
            for sub in sec_subs:
                # Get qualified teachers for this subject
                qualified_staff = [staff for staff in staff_list if sub.id in staff_competency[staff.id]]
                
                # Select the qualified teacher with the minimum teaching load
                assigned_staff = min(qualified_staff, key=lambda s: staff_load[s.id])
                staff_load[assigned_staff.id] += 1
                
                sec_sub = SectionSubject(
                    section_id=sec.id,
                    subject_id=sub.id,
                    assigned_staff_id=assigned_staff.id
                )
                db.add(sec_sub)
        await db.flush()

        # 10. Seed Mock Students
        for i, (sname, sec) in enumerate(sections_dict.items()):
            # Create a student user
            email = f"student.{sec.name.lower().replace(' ', '').replace('(', '').replace(')', '')}@college.edu"
            user = User(
                email=email,
                password_hash=get_password_hash("Student123!"),
                role="Student"
            )
            db.add(user)
            await db.flush()

            student = Student(
                user_id=user.id,
                register_number=f"REG2026{i:04d}",
                section_id=sec.id,
                semester=sec.semester
            )
            db.add(student)

        await db.commit()
        
        # 11. Auto-generate timetables for seeded sections
        from backend.app.core.solver import generate_timetable_csp
        print("Auto-generating timetables for seeded sections...")
        async with AsyncSessionLocal() as db_gen:
            res = await db_gen.execute(select(Section))
            sections_list = res.scalars().all()
            semesters = {sec.semester for sec in sections_list}
            for sem in sorted(semesters):
                gen_res = await generate_timetable_csp(db_gen, "2026-2027", sem)
                print(f"Generated semester {sem}: {gen_res['message']}")
                
        print("Data seeding and timetable generation completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
