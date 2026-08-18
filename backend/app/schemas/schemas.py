from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional
from datetime import time, datetime

# Token & Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None

class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str
    role: str = "Student"

class UserOut(UserBase):
    id: int
    role: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class StaffOut(BaseModel):
    id: int
    user_id: int
    name: str
    phone: Optional[str] = None
    status: str
    profile_photo_url: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class StudentOut(BaseModel):
    id: int
    user_id: int
    register_number: str
    section_id: Optional[int] = None
    semester: int
    
    model_config = ConfigDict(from_attributes=True)

class UserProfile(BaseModel):
    user: UserOut
    staff: Optional[StaffOut] = None
    student: Optional[StudentOut] = None

# Base Entity Schemas for CRUD
class DepartmentBase(BaseModel):
    name: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentOut(DepartmentBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class SubjectBase(BaseModel):
    code: str
    name: str
    credits: int
    semester: int
    department_id: int
    is_project: bool = False

class SubjectCreate(SubjectBase):
    pass

class SubjectOut(SubjectBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class StaffCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    status: str = "Active"
    profile_photo_url: Optional[str] = None
    subject_ids: List[int] = []

class StudentCreate(BaseModel):
    email: EmailStr
    password: str
    register_number: str
    section_id: Optional[int] = None
    semester: int

class SectionBase(BaseModel):
    name: str
    program: str
    semester: int
    strength: int
    class_advisor_id: Optional[int] = None
    classroom_id: Optional[int] = None
    project_days: Optional[str] = "Monday,Wednesday,Friday"
    enable_zero_free_periods: Optional[bool] = True
    enable_daily_coverage: Optional[bool] = True
    enable_project_cadence: Optional[bool] = True

class SectionCreate(SectionBase):
    pass

class SectionOut(SectionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class SectionSubjectCreate(BaseModel):
    section_id: int
    subject_id: int
    assigned_staff_id: int

class SectionSubjectOut(BaseModel):
    id: int
    section_id: int
    subject_id: int
    assigned_staff_id: int
    model_config = ConfigDict(from_attributes=True)

class ClassroomBase(BaseModel):
    room_number: str
    building: str
    floor: int
    capacity: int
    is_available: bool = True

class ClassroomCreate(ClassroomBase):
    pass

class ClassroomOut(ClassroomBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

class TimeSlotBase(BaseModel):
    day_of_week: str
    period_number: int
    start_time: time
    end_time: time
    slot_type: str = "Regular" # Regular, Break, Online

class TimeSlotCreate(TimeSlotBase):
    pass

class TimeSlotOut(TimeSlotBase):
    id: int
    model_config = ConfigDict(from_attributes=True)

# Timetable & Generation Schemas
class TimetableBase(BaseModel):
    section_id: int
    academic_year: str
    semester: int

class TimetableCreate(TimetableBase):
    pass

class TimetableDetailOut(BaseModel):
    id: int
    timeslot_id: int
    subject_id: int
    staff_id: int
    classroom_id: Optional[int] = None
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    staff_name: Optional[str] = None
    room_number: Optional[str] = None
    is_substituted: Optional[bool] = False
    original_staff_name: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class TimetableOut(TimetableBase):
    id: int
    is_active: bool
    version: int
    details: List[TimetableDetailOut]
    
    model_config = ConfigDict(from_attributes=True)

class TimetableGenerateRequest(BaseModel):
    academic_year: str
    semester: int

# Dry-run override validation schemas
class OverrideDetail(BaseModel):
    timeslot_id: int
    subject_id: int
    staff_id: int
    classroom_id: Optional[int] = None

class ValidateOverrideRequest(BaseModel):
    timetable_id: int
    details: List[OverrideDetail]

class ConflictDetail(BaseModel):
    type: str  # e.g., "StaffOverlap", "RoomContention", etc.
    description: str
    timeslot_id: int
    offending_ids: List[int]

class ValidateOverrideResponse(BaseModel):
    is_valid: bool
    conflicts: List[ConflictDetail]


class CalendarEventBase(BaseModel):
    date: str
    title: str
    type: str  # holiday, exam, event, announcement
    description: Optional[str] = None

class CalendarEventCreate(CalendarEventBase):
    pass

class CalendarEventOut(CalendarEventBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class SubstitutionCreate(BaseModel):
    date: str
    timeslot_id: int
    original_staff_id: int
    substitute_staff_id: int
    timetable_detail_id: int

class SubstitutionOut(BaseModel):
    id: int
    date: str
    timeslot_id: int
    original_staff_id: int
    substitute_staff_id: int
    timetable_detail_id: int
    original_staff_name: str
    substitute_staff_name: str
    subject_name: str
    subject_code: str
    room_number: str
    section_name: str

    model_config = ConfigDict(from_attributes=True)

class OngoingClassDetail(BaseModel):
    timeslot_id: int
    period_number: int
    section_id: int
    section_name: str
    subject_name: str
    subject_code: str
    staff_id: int
    staff_name: str
    classroom_id: Optional[int] = None
    room_number: str
    is_substituted: bool
    original_staff_name: Optional[str] = None

class ClassroomLiveStatus(BaseModel):
    id: int
    room_number: str
    building: str
    floor: int
    capacity: int
    is_occupied: bool
    utilization_pct: float = 0.0
    current_class: Optional[OngoingClassDetail] = None

class FacultyLiveStatus(BaseModel):
    id: int
    name: str
    status: str
    is_teaching: bool
    current_class: Optional[OngoingClassDetail] = None

class LiveStatusResponse(BaseModel):
    date: str
    day_of_week: str
    period_number: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_break: bool
    ongoing_classes: List[OngoingClassDetail]
    classrooms: List[ClassroomLiveStatus]
    faculty: List[FacultyLiveStatus]
    is_holiday: bool = False
    holiday_title: Optional[str] = None


