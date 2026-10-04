import pandas as pd
import openpyxl

excel_path = r'c:\Users\Welcome\Desktop\timetable-management\timetable_data.xlsx'

# 1. Departments
departments = [
    {'id': 1, 'name': 'Computer Applications'},
    {'id': 2, 'name': 'Department of Tamil'},
    {'id': 3, 'name': 'Department of English'},
    {'id': 4, 'name': 'Department of Mathematics'}
]
df_depts = pd.DataFrame(departments)

# 2. Classrooms
classrooms = []
c_id = 1
for r in ['901', '902', '903', '904', '905', '906', '907', '801', '802', '803']:
    classrooms.append({'id': c_id, 'room_number': r, 'building': 'FSH block 1', 'floor': int(r[0]), 'capacity': 60, 'is_available': 1})
    c_id += 1
for r in ['301', '302', '303', '401', '402', '403', '404', '405', '406', '407']:
    classrooms.append({'id': c_id, 'room_number': r, 'building': 'FSH block 2', 'floor': int(r[0]), 'capacity': 60, 'is_available': 1})
    c_id += 1
for r in ['908 Lab', '808 Lab', '708 Lab', '402 Lab', '403 Lab']:
    classrooms.append({'id': c_id, 'room_number': r, 'building': 'FSH block 1', 'floor': int(r[0]), 'capacity': 60, 'is_available': 1})
    c_id += 1
for r in ['301 Lab', '302 Lab', '303 Lab', '304 Lab', '404 Lab']:
    classrooms.append({'id': c_id, 'room_number': r, 'building': 'FSH block 2', 'floor': int(r[0]), 'capacity': 60, 'is_available': 1})
    c_id += 1
df_rooms = pd.DataFrame(classrooms)

# 3. Subjects
subjects = [
    # MCA (1-6)
    {'id': 1, 'code': 'MCA-DCN', 'name': 'Data Communication & Networks', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 2, 'code': 'MCA-CQC', 'name': 'Cryptography & Quantum Computing', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 3, 'code': 'MCA-BD', 'name': 'Big Data', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 4, 'code': 'MCA-CV', 'name': 'Computer Vision', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 5, 'code': 'MCA-PRJ', 'name': 'Project', 'credits': 3, 'semester': 1, 'department_id': 1, 'is_project': 1},
    {'id': 6, 'code': 'MCA-VAC', 'name': 'Value Added Course', 'credits': 2, 'semester': 1, 'department_id': 1, 'is_project': 0},
    
    # MCA Gen AI (7-12)
    {'id': 7, 'code': 'MCAGAI-DCN', 'name': 'Data Communication & Networks', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 8, 'code': 'MCAGAI-CQC', 'name': 'Cryptography & Quantum Computing', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 9, 'code': 'MCAGAI-BD', 'name': 'Big Data', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 10, 'code': 'MCAGAI-CV', 'name': 'Computer Vision', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 11, 'code': 'MCAGAI-PRJ', 'name': 'Project', 'credits': 3, 'semester': 1, 'department_id': 1, 'is_project': 1},
    {'id': 12, 'code': 'MCAGAI-VAC', 'name': 'Value Added Course', 'credits': 2, 'semester': 1, 'department_id': 1, 'is_project': 0},
    
    # MSC (13-18)
    {'id': 13, 'code': 'MSC-DCN', 'name': 'Data Communication & Networks', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 14, 'code': 'MSC-CQC', 'name': 'Cryptography & Quantum Computing', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 15, 'code': 'MSC-BD', 'name': 'Big Data', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 16, 'code': 'MSC-CV', 'name': 'Computer Vision', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 17, 'code': 'MSC-PRJ', 'name': 'Project', 'credits': 3, 'semester': 1, 'department_id': 1, 'is_project': 1},
    {'id': 18, 'code': 'MSC-VAC', 'name': 'Value Added Course', 'credits': 2, 'semester': 1, 'department_id': 1, 'is_project': 0},
    
    # UG Common Languages & Mathematics (19-21)
    {'id': 19, 'code': 'TAM101', 'name': 'General Tamil I', 'credits': 3, 'semester': 1, 'department_id': 2, 'is_project': 0},
    {'id': 20, 'code': 'ENG101', 'name': 'Communicative English I', 'credits': 3, 'semester': 1, 'department_id': 3, 'is_project': 0},
    {'id': 21, 'code': 'MAT101', 'name': 'Allied Mathematics I', 'credits': 4, 'semester': 1, 'department_id': 4, 'is_project': 0},
    
    # BCA (22-25)
    {'id': 22, 'code': 'BCA-PF', 'name': 'Programming Fundamentals', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 23, 'code': 'BCA-WD', 'name': 'Web Development', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 24, 'code': 'BCA-PRJ', 'name': 'Project', 'credits': 3, 'semester': 1, 'department_id': 1, 'is_project': 1},
    {'id': 25, 'code': 'BCA-VAC', 'name': 'Value Added Course', 'credits': 2, 'semester': 1, 'department_id': 1, 'is_project': 0},
    
    # BCA Gen AI (26-29)
    {'id': 26, 'code': 'BCAGAI-PF', 'name': 'Programming Fundamentals', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 27, 'code': 'BCAGAI-AI', 'name': 'Artificial Intelligence & Generative AI', 'credits': 5, 'semester': 1, 'department_id': 1, 'is_project': 0},
    {'id': 28, 'code': 'BCAGAI-PRJ', 'name': 'Project', 'credits': 3, 'semester': 1, 'department_id': 1, 'is_project': 1},
    {'id': 29, 'code': 'BCAGAI-VAC', 'name': 'Value Added Course', 'credits': 2, 'semester': 1, 'department_id': 1, 'is_project': 0}
]
df_subs = pd.DataFrame(subjects)

# 4. Time Slots
days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
timeslot_data = []
ts_id = 1
for day in days:
    timeslot_data.append({'id': ts_id, 'day_of_week': day, 'period_number': 1, 'start_time': '08:15:00', 'end_time': '09:00:00', 'slot_type': 'Regular'})
    ts_id += 1
    timeslot_data.append({'id': ts_id, 'day_of_week': day, 'period_number': 2, 'start_time': '09:00:00', 'end_time': '09:45:00', 'slot_type': 'Regular'})
    ts_id += 1
    timeslot_data.append({'id': ts_id, 'day_of_week': day, 'period_number': 3, 'start_time': '09:45:00', 'end_time': '10:30:00', 'slot_type': 'Regular'})
    ts_id += 1
    timeslot_data.append({'id': ts_id, 'day_of_week': day, 'period_number': 4, 'start_time': '10:30:00', 'end_time': '11:00:00', 'slot_type': 'Break'})
    ts_id += 1
    timeslot_data.append({'id': ts_id, 'day_of_week': day, 'period_number': 5, 'start_time': '11:00:00', 'end_time': '11:45:00', 'slot_type': 'Regular'})
    ts_id += 1
    timeslot_data.append({'id': ts_id, 'day_of_week': day, 'period_number': 6, 'start_time': '11:45:00', 'end_time': '12:30:00', 'slot_type': 'Regular'})
    ts_id += 1
df_slots = pd.DataFrame(timeslot_data)

# 5. Staff
staff_roster = [
    # MCA (1-6)
    "Dr. Rajesh Kumar", "Dr. Priya Sharma", "Dr. Arun Alagappan", "Dr. Sandeep Goel", "Dr. Amit Patel", "Dr. Shalini Rao",
    # MCA Gen AI (7-12)
    "Dr. Rajeev Nair", "Dr. Neha Kapoor", "Dr. Preeti Sen", "Dr. Manoj Verma", "Dr. Divya Iyer", "Dr. Harish Joshi",
    # MSC (13-18)
    "Dr. Deepa Nair", "Dr. Surya Kumar", "Dr. Fahadh Faasil", "Dr. Mahesh Babu", "Mr. Anand Subramanian", "Mr. Vijay Kulkarni",
    # BCA (19-24)
    "Mr. Nitin Gadkari", "Mr. Sanjay Dutt", "Mr. Rohan Bopanna", "Mr. Tarun Tahiliani", "Mr. Nani Ghose", "Mr. Dulquer Salmaan",
    # BCA Gen AI (25-30)
    "Ms. Anitha Devi", "Ms. Meena Jasmine", "Ms. Kavitha Rao", "Ms. Anjali Patil", "Ms. Sneha Reddy", "Ms. Archana Puran",
    # Language & Maths Cross Dept Staff (31-33)
    "Dr. S. Tamilselvan", "Dr. R. Elizabeth", "Dr. M. Ramanujan"
]
staff_data = []
for i, name in enumerate(staff_roster, start=1):
    clean = name.lower().replace('dr. ', '').replace('mr. ', '').replace('ms. ', '').replace(' ', '')
    email = f'{clean}@college.edu'
    staff_data.append({
        'id': i,
        'user_id': i + 1, # user_id 1 is admin
        'name': name,
        'email': email,
        'phone': f'+91 98400 {10000+i}',
        'status': 'Active',
        'profile_photo_url': None,
        'assigned_classes_and_rooms': None
    })
df_staff = pd.DataFrame(staff_data)

# 6. Staff Competency
staff_comp = []
# MCA staff
for stf in range(1, 7):
    for sub in range(1, 7):
        staff_comp.append({'staff_id': stf, 'subject_id': sub})
# MCA Gen AI staff
for stf in range(7, 13):
    for sub in range(7, 13):
        staff_comp.append({'staff_id': stf, 'subject_id': sub})
# MSC staff
for stf in range(13, 19):
    for sub in range(13, 19):
        staff_comp.append({'staff_id': stf, 'subject_id': sub})
# BCA staff
for stf in range(19, 25):
    for sub in [22, 23, 24, 25]:
        staff_comp.append({'staff_id': stf, 'subject_id': sub})
# BCA Gen AI staff
for stf in range(25, 31):
    for sub in [26, 27, 28, 29]:
        staff_comp.append({'staff_id': stf, 'subject_id': sub})
# Tamil Staff (31 -> TAM101)
staff_comp.append({'staff_id': 31, 'subject_id': 19})
# English Staff (32 -> ENG101)
staff_comp.append({'staff_id': 32, 'subject_id': 20})
# Maths Staff (33 -> MAT101)
staff_comp.append({'staff_id': 33, 'subject_id': 21})

df_comp = pd.DataFrame(staff_comp)

# 7. Sections (16 sections)
sections_list = [
    # name, program, semester, strength, room_id
    ("MCA A", "MCA", 1, 50, 1),
    ("MCA B", "MCA", 1, 48, 2),
    ("MCA C", "MCA", 1, 52, 3),
    ("MCA D", "MCA", 1, 45, 4),
    ("MCA E", "MCA", 1, 47, 5),
    ("MCA (Gen AI) A", "MCA_GENAI", 1, 40, 6),
    ("MCA (Gen AI) B", "MCA_GENAI", 1, 42, 7),
    ("MCA (Gen AI) C", "MCA_GENAI", 1, 38, 8),
    ("M.Sc. A", "MSC", 1, 45, 9),
    ("M.Sc. B", "MSC", 1, 48, 10),
    ("BCA A", "BCA", 1, 45, 11),
    ("BCA B", "BCA", 1, 48, 12),
    ("BCA C", "BCA", 1, 42, 13),
    ("BCA (Gen AI) A", "BCA_GENAI", 1, 40, 14),
    ("BCA (Gen AI) B", "BCA_GENAI", 1, 42, 15),
    ("BCA (Gen AI) C", "BCA_GENAI", 1, 38, 16)
]
sec_data = []
for i, (name, prog, sem, strgth, room_id) in enumerate(sections_list, start=1):
    sec_data.append({
        'id': i,
        'name': name,
        'program': prog,
        'semester': sem,
        'strength': strgth,
        'class_advisor_id': i,
        'classroom_id': room_id,
        'project_days': 'Monday,Wednesday,Friday',
        'enable_zero_free_periods': 1,
        'enable_daily_coverage': 1,
        'enable_project_cadence': 1
    })
df_secs = pd.DataFrame(sec_data)

# 8. Section Subjects
sec_subs_data = []
ss_id = 1
# MCA (sections 1-5, subs 1-6, staff 1-6)
for sec in range(1, 6):
    for sub in range(1, 7):
        stf = ((sec - 1 + sub - 1) % 6) + 1
        sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': sub, 'assigned_staff_id': stf})
        ss_id += 1

# MCA Gen AI (sections 6-8, subs 7-12, staff 7-12)
for idx, sec in enumerate(range(6, 9)):
    for sub in range(7, 13):
        stf = 7 + ((idx + sub - 7) % 6)
        sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': sub, 'assigned_staff_id': stf})
        ss_id += 1

# MSC (sections 9-10, subs 13-18, staff 13-18)
for idx, sec in enumerate(range(9, 11)):
    for sub in range(13, 19):
        stf = 13 + ((idx + sub - 13) % 6)
        sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': sub, 'assigned_staff_id': stf})
        ss_id += 1

# BCA (sections 11-13)
# Subjects: 19 (TAM101), 20 (ENG101), 21 (MAT101), 22 (PF), 23 (WD), 24 (PRJ), 25 (VAC)
for idx, sec in enumerate(range(11, 14)):
    # Tamil (19) -> Staff 31
    sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': 19, 'assigned_staff_id': 31})
    ss_id += 1
    # English (20) -> Staff 32
    sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': 20, 'assigned_staff_id': 32})
    ss_id += 1
    # Maths (21) -> Staff 33
    sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': 21, 'assigned_staff_id': 33})
    ss_id += 1
    # Core BCA subjects (22, 23, 24, 25) -> BCA staff (19-24)
    for sub_idx, sub in enumerate([22, 23, 24, 25]):
        stf = 19 + ((idx + sub_idx) % 6)
        sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': sub, 'assigned_staff_id': stf})
        ss_id += 1

# BCA Gen AI (sections 14-16)
# Subjects: 19 (TAM101), 20 (ENG101), 21 (MAT101), 26 (PF), 27 (AI), 28 (PRJ), 29 (VAC)
for idx, sec in enumerate(range(14, 17)):
    # Tamil (19) -> Staff 31
    sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': 19, 'assigned_staff_id': 31})
    ss_id += 1
    # English (20) -> Staff 32
    sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': 20, 'assigned_staff_id': 32})
    ss_id += 1
    # Maths (21) -> Staff 33
    sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': 21, 'assigned_staff_id': 33})
    ss_id += 1
    # Core BCA Gen AI subjects (26, 27, 28, 29) -> BCA Gen AI staff (25-30)
    for sub_idx, sub in enumerate([26, 27, 28, 29]):
        stf = 25 + ((idx + sub_idx) % 6)
        sec_subs_data.append({'id': ss_id, 'section_id': sec, 'subject_id': sub, 'assigned_staff_id': stf})
        ss_id += 1

df_sec_subs = pd.DataFrame(sec_subs_data)

# 9. Pre-Allocated Slots (UG Languages & Maths fixed periods)
pre_alloc_data = [
    # Section 11 (BCA A)
    {'section_id': 11, 'subject_id': 19, 'staff_id': 31, 'timeslot_id': 1, 'classroom_id': None},
    {'section_id': 11, 'subject_id': 20, 'staff_id': 32, 'timeslot_id': 14, 'classroom_id': None},
    {'section_id': 11, 'subject_id': 21, 'staff_id': 33, 'timeslot_id': 27, 'classroom_id': None},
    # Section 12 (BCA B)
    {'section_id': 12, 'subject_id': 19, 'staff_id': 31, 'timeslot_id': 7, 'classroom_id': None},
    {'section_id': 12, 'subject_id': 20, 'staff_id': 32, 'timeslot_id': 20, 'classroom_id': None},
    {'section_id': 12, 'subject_id': 21, 'staff_id': 33, 'timeslot_id': 3, 'classroom_id': None},
    # Section 13 (BCA C)
    {'section_id': 13, 'subject_id': 19, 'staff_id': 31, 'timeslot_id': 13, 'classroom_id': None},
    {'section_id': 13, 'subject_id': 20, 'staff_id': 32, 'timeslot_id': 26, 'classroom_id': None},
    {'section_id': 13, 'subject_id': 21, 'staff_id': 33, 'timeslot_id': 9, 'classroom_id': None},
    # Section 14 (BCA GenAI A)
    {'section_id': 14, 'subject_id': 19, 'staff_id': 31, 'timeslot_id': 19, 'classroom_id': None},
    {'section_id': 14, 'subject_id': 20, 'staff_id': 32, 'timeslot_id': 2, 'classroom_id': None},
    {'section_id': 14, 'subject_id': 21, 'staff_id': 33, 'timeslot_id': 15, 'classroom_id': None},
    # Section 15 (BCA GenAI B)
    {'section_id': 15, 'subject_id': 19, 'staff_id': 31, 'timeslot_id': 25, 'classroom_id': None},
    {'section_id': 15, 'subject_id': 20, 'staff_id': 32, 'timeslot_id': 8, 'classroom_id': None},
    {'section_id': 15, 'subject_id': 21, 'staff_id': 33, 'timeslot_id': 21, 'classroom_id': None},
    # Section 16 (BCA GenAI C)
    {'section_id': 16, 'subject_id': 19, 'staff_id': 31, 'timeslot_id': 5, 'classroom_id': None},
    {'section_id': 16, 'subject_id': 20, 'staff_id': 32, 'timeslot_id': 17, 'classroom_id': None},
    {'section_id': 16, 'subject_id': 21, 'staff_id': 33, 'timeslot_id': 29, 'classroom_id': None}
]
df_pre_alloc = pd.DataFrame(pre_alloc_data)

# 10. Students
students_data = []
stu_user_id = 35 # 1 admin + 33 staff = 34
for i, sec in enumerate(range(1, 17), start=1):
    name_clean = sections_list[i-1][0].lower().replace(' ', '').replace('.', '').replace('(', '').replace(')', '')
    students_data.append({
        'id': i,
        'user_id': stu_user_id,
        'email': f'student.{name_clean}@college.edu',
        'register_number': f'REG2026{i:04d}',
        'section_id': sec,
        'semester': 1
    })
    stu_user_id += 1
df_students = pd.DataFrame(students_data)

# Write to Excel workbook with all sheets
with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
    df_depts.to_excel(writer, sheet_name='Departments', index=False)
    df_rooms.to_excel(writer, sheet_name='Classrooms', index=False)
    df_subs.to_excel(writer, sheet_name='Subjects', index=False)
    df_slots.to_excel(writer, sheet_name='Time Slots', index=False)
    df_staff.to_excel(writer, sheet_name='Staff', index=False)
    df_comp.to_excel(writer, sheet_name='Staff Competency', index=False)
    df_secs.to_excel(writer, sheet_name='Sections', index=False)
    df_sec_subs.to_excel(writer, sheet_name='Section Subjects', index=False)
    df_pre_alloc.to_excel(writer, sheet_name='Pre-Allocated Slots', index=False)
    df_students.to_excel(writer, sheet_name='Students', index=False)

print('Master Excel timetable_data.xlsx successfully updated with Tamil, English, Maths, and pre-allocated slots!')
