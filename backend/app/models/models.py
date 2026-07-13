import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Table, Enum, Time, UniqueConstraint
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

# Many-to-Many helper for Staff and Subjects (competency pools)
staff_subject_association = Table(
    "staff_subject",
    Base.metadata,
    Column("staff_id", Integer, ForeignKey("staff.id", ondelete="CASCADE"), primary_key=True),
    Column("subject_id", Integer, ForeignKey("subjects.id", ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="Student")  # Admin, Staff, Student
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    staff_profile = relationship("Staff", back_populates="user", uselist=False, cascade="all, delete-orphan")
    student_profile = relationship("Student", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), unique=True, nullable=False)

    # Relationships
    subjects = relationship("Subject", back_populates="department", cascade="all, delete")


class Staff(Base):
    __tablename__ = "staff"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    name = Column(String(100), nullable=False)
    phone = Column(String(15), nullable=True)
    status = Column(String(50), default="Active")  # Active, Inactive
    profile_photo_url = Column(String(500), nullable=True)

    # Relationships
    user = relationship("User", back_populates="staff_profile")
    subjects = relationship("Subject", secondary=staff_subject_association, back_populates="staff_members")
    advised_sections = relationship("Section", back_populates="class_advisor")
    assigned_section_subjects = relationship("SectionSubject", back_populates="assigned_staff")
    timetable_details = relationship("TimetableDetail", back_populates="staff")


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    register_number = Column(String(50), unique=True, index=True, nullable=False)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="SET NULL"), nullable=True)
    semester = Column(Integer, nullable=False)

    # Relationships
    user = relationship("User", back_populates="student_profile")
    section = relationship("Section", back_populates="students")


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)  # e.g., "MCA A"
    program = Column(String(50), nullable=False)  # MCA, MCA_GENAI, MSC, BCA
    semester = Column(Integer, nullable=False)
    strength = Column(Integer, nullable=False)
    class_advisor_id = Column(Integer, ForeignKey("staff.id", ondelete="SET NULL"), nullable=True)
    project_days = Column(String(100), default="Monday,Wednesday,Friday")
    enable_zero_free_periods = Column(Boolean, default=True)
    enable_daily_coverage = Column(Boolean, default=True)
    enable_project_cadence = Column(Boolean, default=True)

    # Relationships
    class_advisor = relationship("Staff", back_populates="advised_sections")
    students = relationship("Student", back_populates="section")
    section_subjects = relationship("SectionSubject", back_populates="section", cascade="all, delete-orphan")
    timetables = relationship("Timetable", back_populates="section", cascade="all, delete-orphan")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    credits = Column(Integer, nullable=False)
    semester = Column(Integer, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    is_project = Column(Boolean, default=False)

    # Relationships
    department = relationship("Department", back_populates="subjects")
    staff_members = relationship("Staff", secondary=staff_subject_association, back_populates="subjects")
    section_subjects = relationship("SectionSubject", back_populates="subject", cascade="all, delete-orphan")
    timetable_details = relationship("TimetableDetail", back_populates="subject")


class SectionSubject(Base):
    __tablename__ = "section_subjects"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    assigned_staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)

    __table_args__ = (UniqueConstraint("section_id", "subject_id", name="uq_section_subject"),)

    # Relationships
    section = relationship("Section", back_populates="section_subjects")
    subject = relationship("Subject", back_populates="section_subjects")
    assigned_staff = relationship("Staff", back_populates="assigned_section_subjects")


class Classroom(Base):
    __tablename__ = "classrooms"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_number = Column(String(20), unique=True, nullable=False)
    building = Column(String(50), nullable=False)
    floor = Column(Integer, nullable=False)
    capacity = Column(Integer, nullable=False)
    is_available = Column(Boolean, default=True)

    # Relationships
    timetable_details = relationship("TimetableDetail", back_populates="classroom")


class TimeSlot(Base):
    __tablename__ = "timeslots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    day_of_week = Column(String(20), nullable=False)  # Monday, Tuesday, ...
    period_number = Column(Integer, nullable=False)    # 1 to 6
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    slot_type = Column(String(20), default="Regular")  # Regular, Break, Online

    __table_args__ = (UniqueConstraint("day_of_week", "period_number", name="uq_day_period"),)

    # Relationships
    timetable_details = relationship("TimetableDetail", back_populates="timeslot")


class Timetable(Base):
    __tablename__ = "timetables"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    academic_year = Column(String(20), nullable=False)
    semester = Column(Integer, nullable=False)
    is_active = Column(Boolean, default=True)
    version = Column(Integer, default=1)

    # Relationships
    section = relationship("Section", back_populates="timetables")
    details = relationship("TimetableDetail", back_populates="timetable", cascade="all, delete-orphan")


class TimetableDetail(Base):
    __tablename__ = "timetable_details"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timetable_id = Column(Integer, ForeignKey("timetables.id", ondelete="CASCADE"), nullable=False)
    timeslot_id = Column(Integer, ForeignKey("timeslots.id", ondelete="CASCADE"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False)
    staff_id = Column(Integer, ForeignKey("staff.id", ondelete="CASCADE"), nullable=False)
    classroom_id = Column(Integer, ForeignKey("classrooms.id", ondelete="SET NULL"), nullable=True)  # Nullable for Online

    # Relationships
    timetable = relationship("Timetable", back_populates="details")
    timeslot = relationship("TimeSlot", back_populates="timetable_details")
    subject = relationship("Subject", back_populates="timetable_details")
    staff = relationship("Staff", back_populates="timetable_details")
    classroom = relationship("Classroom", back_populates="timetable_details")
