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
    ("MCA-CQC", "Cryptography & Quantum Computing", 5, 1, False),
    ("MCA-BD", "Big Data", 5, 1, False),
    ("MCA-CV", "Computer Vision", 5, 1, False),
    ("MCA-PRJ", "Project", 3, 1, True),
    ("MCA-VAC", "Value Added Course", 2, 1, False),
    
    # MCA (Gen AI)
    ("MCAGAI-DCN", "Data Communication & Networks", 5, 1, False),
    ("MCAGAI-CQC", "Cryptography & Quantum Computing", 5, 1, False),
    ("MCAGAI-BD", "Big Data", 5, 1, False),
    ("MCAGAI-CV", "Computer Vision", 5, 1, False),
    ("MCAGAI-PRJ", "Project", 3, 1, True),
    ("MCAGAI-VAC", "Value Added Course", 2, 1, False),
    
    # M.Sc.
    ("MSC-DCN", "Data Communication & Networks", 5, 1, False),
    ("MSC-CQC", "Cryptography & Quantum Computing", 5, 1, False),
    ("MSC-BD", "Big Data", 5, 1, False),
    ("MSC-CV", "Computer Vision", 5, 1, False),
    ("MSC-PRJ", "Project", 3, 1, True),
    ("MSC-VAC", "Value Added Course", 2, 1, False),
    
    # BCA
    ("BCA-PF", "Programming Fundamentals", 5, 1, False),
    ("BCA-WD", "Web Development", 5, 1, False),
    ("BCA-DBMS", "Database Management Systems", 5, 1, False),
    ("BCA-CN", "Computer Networks", 5, 1, False),
    ("BCA-PRJ", "Project", 3, 1, True),
    ("BCA-VAC", "Value Added Course", 2, 1, False),
    
    # BCA (Gen AI)
    ("BCAGAI-PF", "Programming Fundamentals", 5, 1, False),
    ("BCAGAI-WD", "Web Development", 5, 1, False),
    ("BCAGAI-AI", "Artificial Intelligence & Generative AI", 5, 1, False),
    ("BCAGAI-CN", "Computer Networks", 5, 1, False),
    ("BCAGAI-PRJ", "Project", 3, 1, True),
    ("BCAGAI-VAC", "Value Added Course", 2, 1, False)
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
    ("BCA C", "BCA", 1, 42),
    ("BCA (Gen AI) A", "BCA_GENAI", 1, 40),
    ("BCA (Gen AI) B", "BCA_GENAI", 1, 42),
    ("BCA (Gen AI) C", "BCA_GENAI", 1, 38)
]

# 45 Custom Staff members
STAFF_ROSTER = [
    # MCA
    "Dr. Rajesh Kumar", "Dr. Priya Sharma", "Dr. Arun Alagappan", "Dr. Sandeep Goel",
    "Dr. Amit Patel", "Dr. Shalini Rao",
    # MCA Gen AI
    "Dr. Rajeev Nair", "Dr. Neha Kapoor", "Dr. Preeti Sen", "Dr. Manoj Verma",
    "Dr. Divya Iyer", "Dr. Harish Joshi",
    # MSC
    "Dr. Deepa Nair", "Dr. Surya Kumar", "Dr. Fahadh Faasil", "Dr. Mahesh Babu",
    "Mr. Anand Subramanian", "Mr. Vijay Kulkarni",
    # BCA
    "Mr. Nitin Gadkari", "Mr. Sanjay Dutt", "Mr. Rohan Bopanna", "Mr. Tarun Tahiliani",
    "Mr. Nani Ghose", "Mr. Dulquer Salmaan",
    # BCA Gen AI
    "Ms. Anitha Devi", "Ms. Meena Jasmine", "Ms. Kavitha Rao", "Ms. Anjali Patil",
    "Ms. Sneha Reddy", "Ms. Archana Puran"
]

CLASSROOMS_DATA = [
    # room_number, building, floor, capacity
    # First 10 in FSH block 1
    ("901", "FSH block 1", 9, 60),
    ("902", "FSH block 1", 9, 60),
    ("903", "FSH block 1", 9, 60),
    ("904", "FSH block 1", 9, 60),
    ("905", "FSH block 1", 9, 60),
    ("906", "FSH block 1", 9, 60),
    ("907", "FSH block 1", 9, 60),
    ("801", "FSH block 1", 8, 60),
    ("802", "FSH block 1", 8, 60),
    ("803", "FSH block 1", 8, 60),
    # Remaining classes in FSH block 2
    ("301", "FSH block 2", 3, 60),
    ("302", "FSH block 2", 3, 60),
    ("303", "FSH block 2", 3, 60),
    ("401", "FSH block 2", 4, 60),
    ("402", "FSH block 2", 4, 60),
    ("403", "FSH block 2", 4, 60),
    ("404", "FSH block 2", 4, 60),
    ("405", "FSH block 2", 4, 60),
    ("406", "FSH block 2", 4, 60),
    ("407", "FSH block 2", 4, 60),
    # Lab classrooms (MCA/MCA Gen AI/MSC in FSH block 1)
    ("908 Lab", "FSH block 1", 9, 60),
    ("808 Lab", "FSH block 1", 8, 60),
    ("708 Lab", "FSH block 1", 7, 60),
    ("402 Lab", "FSH block 1", 4, 60),
    ("403 Lab", "FSH block 1", 4, 60),
    # Lab classrooms (BCA/BCA Gen AI in FSH block 2)
    ("301 Lab", "FSH block 2", 3, 60),
    ("302 Lab", "FSH block 2", 3, 60),
    ("303 Lab", "FSH block 2", 3, 60),
    ("304 Lab", "FSH block 2", 3, 60),
    ("404 Lab", "FSH block 2", 4, 60)
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
            if idx <= 5:
                # MCA
                offset = 0
            elif idx <= 11:
                # MCA Gen AI
                offset = 6
            elif idx <= 17:
                # MSC
                offset = 12
            elif idx <= 23:
                # BCA
                offset = 18
            else:
                # BCA Gen AI
                offset = 24
            
            # All 6 subjects for this program are added to competency
            unique_sub_ids = [subject_list[offset + i].id for i in range(6)]
            staff_competency[staff.id] = unique_sub_ids
            
            for sub_id in unique_sub_ids:
                stmt = staff_subject_association.insert().values(staff_id=staff.id, subject_id=sub_id)
                await db.execute(stmt)
        await db.flush()

        # 8. Create Sections
        non_lab_rooms = [r for r in rooms if "Lab" not in r.room_number]
        sections_dict = {}
        for sname, prog, sem, strength in SECTIONS_DATA:
            # Assign advisor (take first few staff members as advisors)
            advisor = staff_list[len(sections_dict) % len(staff_list)]
            room = non_lab_rooms[len(sections_dict) % len(non_lab_rooms)]
            sec = Section(
                name=sname,
                program=prog,
                semester=sem,
                strength=strength,
                class_advisor_id=advisor.id,
                classroom_id=room.id,
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
        from collections import defaultdict
        section_staff_assigned = defaultdict(set)
        staff_tue_thu_load = {staff.id: 0 for staff in staff_list}
        
        # Collect all section-subjects to assign
        all_ss = []
        for sec_name, sec in sections_dict.items():
            # Assign appropriate subjects to sections based on program (6 subjects per program)
            if sec.program == "MCA":
                sec_subs = subject_list[0:6]
            elif sec.program == "MCA_GENAI":
                sec_subs = subject_list[6:12]
            elif sec.program == "MSC":
                sec_subs = subject_list[12:18]
            elif sec.program == "BCA":
                sec_subs = subject_list[18:24]
            elif sec.program == "BCA_GENAI":
                sec_subs = subject_list[24:30]
            else:
                sec_subs = []
            for sub in sec_subs:
                all_ss.append((sec, sub))

        # Sort: credits descending to assign heavier loads first
        all_ss.sort(key=lambda x: x[1].credits, reverse=True)

        for sec, sub in all_ss:
            # Get qualified teachers for this subject who are not already teaching in this section
            already_assigned_staff = section_staff_assigned[sec.id]
            qualified_staff = [staff for staff in staff_list if sub.id in staff_competency[staff.id] and staff.id not in already_assigned_staff]
            if not qualified_staff:
                qualified_staff = [staff for staff in staff_list if sub.id in staff_competency[staff.id]]
            
            # Select the qualified teacher with the minimum teaching credits, using a custom hash to break ties evenly
            assigned_staff = min(
                qualified_staff, 
                key=lambda s: (staff_tue_thu_load[s.id], staff_load[s.id], (s.id * 12345 + sec.id * 6789) % 10007)
            )
            staff_load[assigned_staff.id] += sub.credits
            section_staff_assigned[sec.id].add(assigned_staff.id)
            
            # Update Tue/Thu load: 5-credits -> 2, 2-credits -> 2, 3-credits -> 0
            if sub.credits == 5:
                staff_tue_thu_load[assigned_staff.id] += 2
            elif sub.credits == 2:
                staff_tue_thu_load[assigned_staff.id] += 2
            
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
