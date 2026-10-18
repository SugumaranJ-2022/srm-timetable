from pydantic import BaseModel, Field, ConfigDict, field_validator, computed_field
from typing import List, Optional
from datetime import time, datetime
import re

# Flexible email type allowing dummy development domains like .local
EmailStr = str

# Token & Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None
    user_id: Optional[int] = None

class UserBase(BaseModel):
    email: str = Field(..., description="Email address, supports dev test domains like .local")

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email address format.")
        return v

class UserCreate(UserBase):
    password: str
    role: str = "Student"

class UserOut(UserBase):
    id: int
    role: str
    is_active: bool = True
    mfa_enabled: bool = False
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
    section_name: Optional[str] = None
    
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

class StaffUpdate(BaseModel):
    name: str
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    status: Optional[str] = "Active"
    profile_photo_url: Optional[str] = None
    subject_ids: Optional[List[int]] = []

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
    is_manual: Optional[bool] = False
    
    model_config = ConfigDict(from_attributes=True)

class TimetableOut(TimetableBase):
    id: int
    is_active: bool
    is_published: bool = False
    version: int
    details: List[TimetableDetailOut]
    
    model_config = ConfigDict(from_attributes=True)

class PreAllocatedSlotCreate(BaseModel):
    section_id: int
    subject_id: int
    staff_id: int
    timeslot_id: int
    classroom_id: Optional[int] = None

class PreAllocatedSlotOut(BaseModel):
    id: int
    section_id: int
    section_name: Optional[str] = None
    subject_id: int
    subject_name: Optional[str] = None
    subject_code: Optional[str] = None
    staff_id: int
    staff_name: Optional[str] = None
    timeslot_id: int
    day_of_week: Optional[str] = None
    period_number: Optional[int] = None
    classroom_id: Optional[int] = None
    room_number: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class PublishToggleRequest(BaseModel):
    semester: Optional[int] = None
    is_published: bool

class PublishStatusOut(BaseModel):
    is_published: bool
    published_count: int
    total_count: int

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


# Enterprise Security & Auth Schemas
class CaptchaResponse(BaseModel):
    captcha_id: str
    captcha_text: str
    expires_in: int


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)
    captcha_id: Optional[str] = None
    captcha_code: Optional[str] = None
    mfa_code: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"
    mfa_required: bool = False
    mfa_token: Optional[str] = None
    user: Optional[UserOut] = None


class MFASetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    recovery_codes: List[str]


class MFAVerifyRequest(BaseModel):
    code: str
    mfa_token: Optional[str] = None


class MFAEnableRequest(BaseModel):
    code: str
    secret: Optional[str] = None
    recovery_codes: Optional[List[str]] = None


class MFADisableRequest(BaseModel):
    password: Optional[str] = None
    recovery_code: Optional[str] = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


class OTPRequest(BaseModel):
    destination: Optional[str] = None
    identifier: Optional[str] = None
    channel: Optional[str] = "sms"
    purpose: str = "VERIFICATION"

    def get_destination(self) -> str:
        return (self.destination or self.identifier or "").strip()


class OTPVerifyRequest(BaseModel):
    destination: Optional[str] = None
    identifier: Optional[str] = None
    code: str
    purpose: str = "VERIFICATION"

    def get_destination(self) -> str:
        return (self.destination or self.identifier or "").strip()


class SecurityEventOut(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    severity: str
    ip_address: Optional[str] = None
    email: Optional[str] = None
    details: Optional[str] = None
    acknowledged: bool = False

    @computed_field
    def is_acknowledged(self) -> bool:
        return bool(self.acknowledged)

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class SecurityEventSummary(BaseModel):
    total_events: int
    critical_count: int
    warning_count: int
    info_count: int
    recent_events: List[SecurityEventOut]



