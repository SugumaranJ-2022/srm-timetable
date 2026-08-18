from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any, Optional
import datetime

from backend.app.core.database import get_db
from backend.app.api.auth import get_current_user, get_current_admin, get_current_staff
from backend.app.models.models import (
    User, Timetable, TimetableDetail, Section, Subject, Staff, Classroom, TimeSlot, SectionSubject, Substitution
)
from backend.app.schemas.schemas import (
    TimetableOut, TimetableGenerateRequest, ValidateOverrideRequest, ValidateOverrideResponse, ConflictDetail,
    SubstitutionCreate, SubstitutionOut, LiveStatusResponse, ClassroomLiveStatus, FacultyLiveStatus, OngoingClassDetail
)
from backend.app.core.solver import generate_timetable_csp

router = APIRouter(prefix="/timetables", tags=["timetables"])

@router.post("/generate", status_code=status.HTTP_200_OK)
async def generate_timetable(
    req: TimetableGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    result = await generate_timetable_csp(db, req.academic_year, req.semester)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.get("/section/{section_id}", response_model=TimetableOut)
async def get_section_timetable(
    section_id: int,
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Fetch timetable
    stmt = (
        select(Timetable)
        .where(Timetable.section_id == section_id, Timetable.is_active == True)
        .order_by(Timetable.id.desc())
        .options(selectinload(Timetable.details))
    )
    result = await db.execute(stmt)
    timetable = result.scalars().first()
    
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found for this section.")

    # Fetch substitutions if date is provided
    substitutions_map = {}
    if date:
        sub_stmt = select(Substitution).where(
            Substitution.date == date,
            Substitution.timetable_detail_id.in_([d.id for d in timetable.details])
        )
        sub_res = await db.execute(sub_stmt)
        for sub in sub_res.scalars().all():
            substitutions_map[sub.timetable_detail_id] = sub

    # Enrich details with names for UI consumption
    enriched_details = []
    for detail in timetable.details:
        sub_res = await db.execute(select(Subject).where(Subject.id == detail.subject_id))
        subject = sub_res.scalar_one_or_none()
        
        staff_res = await db.execute(select(Staff).where(Staff.id == detail.staff_id))
        staff = staff_res.scalar_one_or_none()
        
        room_res = await db.execute(select(Classroom).where(Classroom.id == detail.classroom_id)) if detail.classroom_id else None
        classroom = room_res.scalar_one_or_none() if room_res else None

        # Check for substitution
        is_sub = False
        orig_name = None
        current_staff_id = detail.staff_id
        current_staff_name = staff.name if staff else "Unknown"

        if detail.id in substitutions_map:
            sub = substitutions_map[detail.id]
            is_sub = True
            orig_name = staff.name if staff else "Unknown"
            
            sub_staff_res = await db.execute(select(Staff).where(Staff.id == sub.substitute_staff_id))
            sub_staff = sub_staff_res.scalar_one_or_none()
            if sub_staff:
                current_staff_id = sub.substitute_staff_id
                current_staff_name = sub_staff.name

        enriched_details.append({
            "id": detail.id,
            "timeslot_id": detail.timeslot_id,
            "subject_id": detail.subject_id,
            "staff_id": current_staff_id,
            "classroom_id": detail.classroom_id,
            "subject_name": subject.name if subject else "Unknown",
            "subject_code": subject.code if subject else "",
            "staff_name": current_staff_name,
            "room_number": classroom.room_number if classroom else "Online",
            "is_substituted": is_sub,
            "original_staff_name": orig_name
        })

    return {
        "id": timetable.id,
        "section_id": timetable.section_id,
        "academic_year": timetable.academic_year,
        "semester": timetable.semester,
        "is_active": timetable.is_active,
        "version": timetable.version,
        "details": enriched_details
    }

@router.get("/staff/{staff_id}", response_model=List[Any])
async def get_staff_timetable(
    staff_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    stmt = (
        select(TimetableDetail)
        .where(TimetableDetail.staff_id == staff_id)
        .options(selectinload(TimetableDetail.timetable))
    )
    result = await db.execute(stmt)
    details = result.scalars().all()

    enriched_details = []
    for d in details:
        # Check if the parent timetable is active
        if not d.timetable.is_active:
            continue
            
        sub_res = await db.execute(select(Subject).where(Subject.id == d.subject_id))
        subject = sub_res.scalar_one_or_none()
        
        sec_res = await db.execute(select(Section).where(Section.id == d.timetable.section_id))
        section = sec_res.scalar_one_or_none()

        room_res = await db.execute(select(Classroom).where(Classroom.id == d.classroom_id)) if d.classroom_id else None
        classroom = room_res.scalar_one_or_none() if room_res else None

        timeslot_res = await db.execute(select(TimeSlot).where(TimeSlot.id == d.timeslot_id))
        timeslot = timeslot_res.scalar_one_or_none()

        enriched_details.append({
            "id": d.id,
            "timeslot_id": d.timeslot_id,
            "day_of_week": timeslot.day_of_week if timeslot else "",
            "period_number": timeslot.period_number if timeslot else 0,
            "section_name": section.name if section else "Unknown",
            "subject_name": subject.name if subject else "Unknown",
            "subject_code": subject.code if subject else "",
            "room_number": classroom.room_number if classroom else "Online"
        })

    return enriched_details

@router.post("/validate-override", response_model=ValidateOverrideResponse)
async def validate_override(
    req: ValidateOverrideRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_staff)
):
    # Fetch target timetable info
    t_res = await db.execute(select(Timetable).where(Timetable.id == req.timetable_id))
    target_timetable = t_res.scalar_one_or_none()
    if not target_timetable:
        raise HTTPException(status_code=404, detail="Target timetable not found")

    sec_res = await db.execute(select(Section).where(Section.id == target_timetable.section_id))
    target_section = sec_res.scalar_one_or_none()
    
    # Fetch all active timeslots
    ts_res = await db.execute(select(TimeSlot))
    timeslots_map = {ts.id: ts for ts in ts_res.scalars().all()}

    # Fetch classrooms
    cr_res = await db.execute(select(Classroom))
    classrooms_map = {cr.id: cr for cr in cr_res.scalars().all()}

    # Fetch other active timetables for comparison (same sem/academic_year, different sections)
    other_t_res = await db.execute(
        select(Timetable)
        .where(
            Timetable.id != req.timetable_id,
            Timetable.academic_year == target_timetable.academic_year,
            Timetable.semester == target_timetable.semester,
            Timetable.is_active == True
        )
        .options(selectinload(Timetable.details))
    )
    other_timetables = other_t_res.scalars().all()

    conflicts = []

    # Map the current requested overrides for quick inspection
    proposed_details_by_slot = {}
    for d in req.details:
        proposed_details_by_slot[d.timeslot_id] = d

    # 1. Staff Overlap: Is the assigned staff member teaching another section in the same timeslot?
    for timeslot_id, prop_d in proposed_details_by_slot.items():
        ts = timeslots_map.get(timeslot_id)
        if not ts:
            continue
            
        staff_id = prop_d.staff_id
        
        # Check against other timetables in DB
        for other_t in other_timetables:
            for other_d in other_t.details:
                if other_d.timeslot_id == timeslot_id and other_d.staff_id == staff_id:
                    # Fetch other section name for description
                    other_sec_res = await db.execute(select(Section).where(Section.id == other_t.section_id))
                    other_sec = other_sec_res.scalar_one_or_none()
                    sec_name = other_sec.name if other_sec else "another section"
                    conflicts.append(ConflictDetail(
                        type="StaffOverlap",
                        description=f"Staff member is already scheduled to teach {sec_name} during {ts.day_of_week} Period {ts.period_number}.",
                        timeslot_id=timeslot_id,
                        offending_ids=[staff_id]
                    ))

    # 2. Room Contention: Is the room already occupied at the same timeslot by another section?
    for timeslot_id, prop_d in proposed_details_by_slot.items():
        if not prop_d.classroom_id:
            continue # Online classes have no classroom contention
            
        room = classrooms_map.get(prop_d.classroom_id)
        ts = timeslots_map.get(timeslot_id)
        if not ts or not room:
            continue

        # Check against other timetables in DB
        for other_t in other_timetables:
            for other_d in other_t.details:
                if other_d.timeslot_id == timeslot_id and other_d.classroom_id == prop_d.classroom_id:
                    other_sec_res = await db.execute(select(Section).where(Section.id == other_t.section_id))
                    other_sec = other_sec_res.scalar_one_or_none()
                    sec_name = other_sec.name if other_sec else "another section"
                    conflicts.append(ConflictDetail(
                        type="RoomContention",
                        description=f"Classroom {room.room_number} is already occupied by {sec_name} during {ts.day_of_week} Period {ts.period_number}.",
                        timeslot_id=timeslot_id,
                        offending_ids=[prop_d.classroom_id]
                    ))

    # 3. Volumetric Check: Is room capacity smaller than section strength?
    for timeslot_id, prop_d in proposed_details_by_slot.items():
        if not prop_d.classroom_id or not target_section:
            continue
            
        room = classrooms_map.get(prop_d.classroom_id)
        if room and target_section.strength > room.capacity:
            conflicts.append(ConflictDetail(
                type="VolumetricCheck",
                description=f"Classroom {room.room_number} capacity ({room.capacity}) is insufficient for Section {target_section.name} strength ({target_section.strength}).",
                timeslot_id=timeslot_id,
                offending_ids=[prop_d.classroom_id]
            ))

    # 3.5. Homeroom Mismatch Check: Must remain in designated classroom
    for timeslot_id, prop_d in proposed_details_by_slot.items():
        ts = timeslots_map.get(timeslot_id)
        if ts and ts.slot_type == "Regular" and target_section and target_section.classroom_id is not None:
            if prop_d.classroom_id != target_section.classroom_id:
                room = classrooms_map.get(target_section.classroom_id)
                room_num = room.room_number if room else "designated classroom"
                conflicts.append(ConflictDetail(
                    type="HomeroomMismatch",
                    description=f"Homeroom Mismatch: Section {target_section.name} students must remain in their designated classroom {room_num}.",
                    timeslot_id=timeslot_id,
                    offending_ids=[prop_d.classroom_id] if prop_d.classroom_id else []
                ))

    # 4. Break Integrity Rule: Break timeslots must remain empty
    for timeslot_id, prop_d in proposed_details_by_slot.items():
        ts = timeslots_map.get(timeslot_id)
        if ts and ts.slot_type == "Break":
            conflicts.append(ConflictDetail(
                type="BreakIntegrity",
                description=f"Cannot schedule class during institutional break time ({ts.day_of_week} Period {ts.period_number}).",
                timeslot_id=timeslot_id,
                offending_ids=[]
            ))

    # 5. Virtual Isolation Rule: Online slot type must be a remote session (no classroom allowed)
    for timeslot_id, prop_d in proposed_details_by_slot.items():
        ts = timeslots_map.get(timeslot_id)
        if ts and ts.slot_type == "Online" and prop_d.classroom_id is not None:
            conflicts.append(ConflictDetail(
                type="VirtualIsolation",
                description=f"Online slots ({ts.day_of_week} Period {ts.period_number}) must run virtually without a physical classroom allocation.",
                timeslot_id=timeslot_id,
                offending_ids=[prop_d.classroom_id]
            ))
        elif ts and ts.slot_type == "Regular" and prop_d.classroom_id is None:
            conflicts.append(ConflictDetail(
                type="VirtualIsolation",
                description=f"Regular physical slots ({ts.day_of_week} Period {ts.period_number}) require a classroom assignment.",
                timeslot_id=timeslot_id,
                offending_ids=[]
            ))

    # 6. Allocation Competency Matrix: Check if staff is verified in SectionSubject map
    for timeslot_id, prop_d in proposed_details_by_slot.items():
        ss_res = await db.execute(
            select(SectionSubject)
            .where(
                SectionSubject.section_id == target_timetable.section_id,
                SectionSubject.subject_id == prop_d.subject_id,
                SectionSubject.assigned_staff_id == prop_d.staff_id
            )
        )
        if not ss_res.scalar_one_or_none():
            conflicts.append(ConflictDetail(
                type="CompetencyMatrix",
                description=f"Selected staff member is not officially assigned to teach this subject for this section.",
                timeslot_id=timeslot_id,
                offending_ids=[prop_d.staff_id]
            ))

    # 7. Zero Free-Period Rule (NEW)
    if target_section and target_section.enable_zero_free_periods:
        active_ts_ids = {ts.id for ts in timeslots_map.values() if ts.slot_type == "Regular"}
        proposed_ts_ids = {d.timeslot_id for d in req.details}
        missing_ts_ids = active_ts_ids - proposed_ts_ids
        for ts_id in missing_ts_ids:
            ts = timeslots_map[ts_id]
            conflicts.append(ConflictDetail(
                type="ZeroFreePeriod",
                description=f"Zero Free-Period Rule: Every teaching period must be filled. Period {ts.period_number} on {ts.day_of_week} is empty.",
                timeslot_id=ts_id,
                offending_ids=[]
            ))

    # 8. Daily Coverage Rule (NEW) & Project Cadence Rule (NEW)
    if target_section:
        sec_subs_res = await db.execute(
            select(SectionSubject).where(SectionSubject.section_id == target_timetable.section_id)
        )
        sec_subs = sec_subs_res.scalars().all()
        sub_ids = [ss.subject_id for ss in sec_subs]
        
        if sub_ids:
            sub_models_res = await db.execute(
                select(Subject).where(Subject.id.in_(sub_ids))
            )
            sub_models_map = {sub.id: sub for sub in sub_models_res.scalars().all()}
            
            non_project_sub_ids = {sub_id for sub_id, sub in sub_models_map.items() if not sub.is_project}
            project_sub_id = next((sub_id for sub_id, sub in sub_models_map.items() if sub.is_project), None)
            
            configured_project_days = [d.strip() for d in target_section.project_days.split(",") if d.strip()]
            
            for day in ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]:
                day_ts = [ts for ts in timeslots_map.values() if ts.day_of_week == day and ts.slot_type == "Regular"]
                day_ts_ids = {ts.id for ts in day_ts}
                
                # Check Daily Coverage
                if target_section.enable_daily_coverage and non_project_sub_ids:
                    scheduled_subs_on_day = {d.subject_id for d in req.details if d.timeslot_id in day_ts_ids}
                    missing_subs = non_project_sub_ids - scheduled_subs_on_day
                    if missing_subs:
                        day_ts_id = next((ts.id for ts in day_ts), 0)
                        for sub_id in missing_subs:
                            sub = sub_models_map[sub_id]
                            conflicts.append(ConflictDetail(
                                type="DailyCoverage",
                                description=f"Daily Coverage Rule: Non-project subject {sub.name} ({sub.code}) must appear at least once on {day}.",
                                timeslot_id=day_ts_id,
                                offending_ids=[sub_id]
                            ))
                
                # Check Project Cadence
                if target_section.enable_project_cadence and project_sub_id:
                    project_count = sum(1 for d in req.details if d.timeslot_id in day_ts_ids and d.subject_id == project_sub_id)
                    day_ts_id = next((ts.id for ts in day_ts), 0)
                    
                    if day in configured_project_days:
                        if project_count != 1:
                            conflicts.append(ConflictDetail(
                                type="ProjectCadence",
                                description=f"Project Cadence Rule: Project must be scheduled exactly once on project day {day} (currently scheduled {project_count} times).",
                                timeslot_id=day_ts_id,
                                offending_ids=[project_sub_id]
                            ))
                    else:
                        if project_count != 0:
                            conflicts.append(ConflictDetail(
                                type="ProjectCadence",
                                description=f"Project Cadence Rule: Project cannot be scheduled on non-project day {day}.",
                                timeslot_id=day_ts_id,
                                offending_ids=[project_sub_id]
                            ))

    return ValidateOverrideResponse(
        is_valid=len(conflicts) == 0,
        conflicts=conflicts
    )

@router.put("/save-override", status_code=status.HTTP_200_OK)
async def save_override(
    req: ValidateOverrideRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_staff)
):
    # Perform validation dry-run first
    val_resp = await validate_override(req, db, current_user)
    if not val_resp.is_valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Cannot save override. Constraints are violated.", "conflicts": [c.model_dump() for c in val_resp.conflicts]}
        )

    # Fetch timetable
    t_res = await db.execute(select(Timetable).where(Timetable.id == req.timetable_id))
    timetable = t_res.scalar_one_or_none()
    if not timetable:
        raise HTTPException(status_code=404, detail="Timetable not found")

    # Increment version
    timetable.version += 1

    # Delete existing details for this timetable
    existing_details_res = await db.execute(
        select(TimetableDetail).where(TimetableDetail.timetable_id == timetable.id)
    )
    for ed in existing_details_res.scalars().all():
        await db.delete(ed)

    await db.flush()

    # Re-insert updated details
    for d in req.details:
        new_detail = TimetableDetail(
            timetable_id=timetable.id,
            timeslot_id=d.timeslot_id,
            subject_id=d.subject_id,
            staff_id=d.staff_id,
            classroom_id=d.classroom_id
        )
        db.add(new_detail)

    await db.commit()
    return {"message": "Timetable overrides saved successfully.", "version": timetable.version}

@router.post("/wipe", status_code=status.HTTP_200_OK)
async def wipe_timetables(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    from sqlalchemy import text
    # Disable foreign keys for SQLite bulk clear
    await db.execute(text("PRAGMA foreign_keys = OFF"))
    
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
        await db.execute(text(f"DELETE FROM {table}"))
        
    # Delete non-admin users
    await db.execute(text("DELETE FROM users WHERE role != 'Admin'"))
    
    # Re-enable foreign keys
    await db.execute(text("PRAGMA foreign_keys = ON"))
    await db.commit()
    
    return {"message": "All timetables and master registry database records have been successfully wiped."}


@router.get("/analytics/staff-load")
async def get_staff_load_analytics(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    """Return weekly teaching load distribution per faculty member."""
    from backend.app.models.models import Classroom, Staff
    from sqlalchemy import func

    # Get all active timetable details grouped by staff
    stmt = (
        select(
            TimetableDetail.staff_id,
            Staff.name,
            TimeSlot.day_of_week,
            func.count(TimetableDetail.id).label("period_count")
        )
        .join(Timetable, TimetableDetail.timetable_id == Timetable.id)
        .join(Staff, TimetableDetail.staff_id == Staff.id)
        .join(TimeSlot, TimetableDetail.timeslot_id == TimeSlot.id)
        .where(Timetable.is_active == True, TimeSlot.slot_type != "Break")
        .group_by(TimetableDetail.staff_id, Staff.name, TimeSlot.day_of_week)
        .order_by(Staff.name)
    )
    res = await db.execute(stmt)
    rows = res.all()

    # Aggregate into per-staff totals + daily breakdown
    staff_map = {}
    for staff_id, staff_name, day, count in rows:
        if staff_id not in staff_map:
            staff_map[staff_id] = {"staff_id": staff_id, "staff_name": staff_name, "total_periods": 0, "daily": {}}
        staff_map[staff_id]["total_periods"] += count
        staff_map[staff_id]["daily"][day] = count

    return list(staff_map.values())


@router.get("/live-status", response_model=LiveStatusResponse)
async def get_live_status(
    date: str,
    time: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    try:
        parsed_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        day_of_week = parsed_date.strftime("%A")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # Check if today is a Holiday in the Academic Calendar
    from backend.app.models.models import AcademicCalendarEvent, Classroom, Staff
    cal_stmt = select(AcademicCalendarEvent).where(
        AcademicCalendarEvent.date == date,
        AcademicCalendarEvent.type == "holiday"
    )
    cal_res = await db.execute(cal_stmt)
    holiday_event = cal_res.scalar_one_or_none()
    
    if holiday_event:
        # Load all active classrooms and active staff as free/not-teaching
        cr_stmt = select(Classroom).where(Classroom.is_available == True).order_by(Classroom.room_number)
        cr_res = await db.execute(cr_stmt)
        classrooms_list = cr_res.scalars().all()
        
        staff_stmt = select(Staff).where(Staff.status == "Active").order_by(Staff.name)
        staff_res = await db.execute(staff_stmt)
        staff_list = staff_res.scalars().all()
        
        return LiveStatusResponse(
            date=date,
            day_of_week=day_of_week,
            period_number=None,
            start_time=None,
            end_time=None,
            is_break=False,
            ongoing_classes=[],
            classrooms=[
                ClassroomLiveStatus(
                    id=cr.id,
                    room_number=cr.room_number,
                    building=cr.building,
                    floor=cr.floor,
                    capacity=cr.capacity,
                    is_occupied=False,
                    current_class=None
                ) for cr in classrooms_list
            ],
            faculty=[
                FacultyLiveStatus(
                    id=st.id,
                    name=st.name,
                    status=st.status,
                    is_teaching=False,
                    current_class=None
                ) for st in staff_list
            ],
            is_holiday=True,
            holiday_title=holiday_event.title
        )
        
    try:
        t_parts = list(map(int, time.split(":")))
        if len(t_parts) == 2:
            parsed_time = datetime.time(t_parts[0], t_parts[1])
        elif len(t_parts) == 3:
            parsed_time = datetime.time(t_parts[0], t_parts[1], t_parts[2])
        else:
            raise ValueError()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid time format. Use HH:MM or HH:MM:SS.")

    # Find the timeslot that covers this time on this day of week
    ts_stmt = select(TimeSlot)
    ts_res = await db.execute(ts_stmt)
    timeslots = ts_res.scalars().all()
    
    matching_slot = None
    target_time_mins = parsed_time.hour * 60 + parsed_time.minute
    
    for ts in timeslots:
        if ts.day_of_week.lower() == day_of_week.lower():
            start_mins = ts.start_time.hour * 60 + ts.start_time.minute
            end_mins = ts.end_time.hour * 60 + ts.end_time.minute
            if start_mins <= target_time_mins < end_mins:
                matching_slot = ts
                break
                
    period_num = None
    start_str = None
    end_str = None
    is_break = False
    
    if matching_slot:
        period_num = matching_slot.period_number
        start_str = matching_slot.start_time.strftime("%H:%M")
        end_str = matching_slot.end_time.strftime("%H:%M")
        is_break = (matching_slot.slot_type == "Break")

    # Fetch ongoing classes
    ongoing_classes = []
    
    # Check if there are active details for this slot (only if it's not a break and matching_slot exists)
    if matching_slot and not is_break:
        # Fetch active timetables details
        detail_stmt = (
            select(TimetableDetail)
            .join(Timetable, TimetableDetail.timetable_id == Timetable.id)
            .where(Timetable.is_active == True, TimetableDetail.timeslot_id == matching_slot.id)
            .options(
                selectinload(TimetableDetail.timetable),
                selectinload(TimetableDetail.subject),
                selectinload(TimetableDetail.staff),
                selectinload(TimetableDetail.classroom)
            )
        )
        detail_res = await db.execute(detail_stmt)
        details = detail_res.scalars().all()
        
        # Get substitutions for this date and timeslot
        sub_stmt = (
            select(Substitution)
            .where(Substitution.date == date, Substitution.timeslot_id == matching_slot.id)
            .options(selectinload(Substitution.substitute_staff))
        )
        sub_res = await db.execute(sub_stmt)
        subs = {sub.timetable_detail_id: sub for sub in sub_res.scalars().all()}
        
        for d in details:
            # Check if this class has a substitution
            is_sub = False
            orig_name = None
            current_staff_id = d.staff_id
            current_staff_name = d.staff.name if d.staff else "Unknown"
            
            if d.id in subs:
                sub = subs[d.id]
                is_sub = True
                orig_name = d.staff.name if d.staff else "Unknown"
                current_staff_id = sub.substitute_staff_id
                current_staff_name = sub.substitute_staff.name if sub.substitute_staff else "Unknown"
                
            # Fetch section name
            sec_res = await db.execute(select(Section).where(Section.id == d.timetable.section_id))
            section = sec_res.scalar_one_or_none()
            section_name = section.name if section else "Unknown"
            
            ongoing_classes.append(OngoingClassDetail(
                timeslot_id=d.timeslot_id,
                period_number=matching_slot.period_number,
                section_id=d.timetable.section_id,
                section_name=section_name,
                subject_name=d.subject.name if d.subject else "Unknown",
                subject_code=d.subject.code if d.subject else "",
                staff_id=current_staff_id,
                staff_name=current_staff_name,
                classroom_id=d.classroom_id,
                room_number=d.classroom.room_number if d.classroom else "Online",
                is_substituted=is_sub,
                original_staff_name=orig_name
            ))

    # Fetch all classrooms
    cr_res = await db.execute(select(Classroom).order_by(Classroom.room_number))
    classrooms_list = cr_res.scalars().all()
    classrooms_status = []

    # Compute weekly utilization per classroom (scheduled teaching slots / 25 total weekly teaching slots)
    from sqlalchemy import func as sa_func
    util_stmt = (
        select(
            TimetableDetail.classroom_id,
            sa_func.count(TimetableDetail.id).label("used_slots")
        )
        .join(Timetable, TimetableDetail.timetable_id == Timetable.id)
        .join(TimeSlot, TimetableDetail.timeslot_id == TimeSlot.id)
        .where(Timetable.is_active == True, TimeSlot.slot_type != "Break")
        .group_by(TimetableDetail.classroom_id)
    )
    util_res = await db.execute(util_stmt)
    util_map = {cid: slots for cid, slots in util_res.all()}
    total_weekly_slots = 25  # 5 days * 5 teaching periods

    for cr in classrooms_list:
        # Find if occupied
        current_class = next((oc for oc in ongoing_classes if oc.classroom_id == cr.id), None)
        used = util_map.get(cr.id, 0)
        pct = round((used / total_weekly_slots) * 100, 1) if total_weekly_slots > 0 else 0.0
        classrooms_status.append(ClassroomLiveStatus(
            id=cr.id,
            room_number=cr.room_number,
            building=cr.building,
            floor=cr.floor,
            capacity=cr.capacity,
            is_occupied=current_class is not None,
            utilization_pct=pct,
            current_class=current_class
        ))
        
    # Fetch all faculty
    staff_res = await db.execute(select(Staff).order_by(Staff.name))
    staff_list = staff_res.scalars().all()
    faculty_status = []
    
    for st in staff_list:
        current_class = next((oc for oc in ongoing_classes if oc.staff_id == st.id), None)
        faculty_status.append(FacultyLiveStatus(
            id=st.id,
            name=st.name,
            status=st.status,
            is_teaching=current_class is not None,
            current_class=current_class
        ))
        
    return LiveStatusResponse(
        date=date,
        day_of_week=day_of_week,
        period_number=period_num,
        start_time=start_str,
        end_time=end_str,
        is_break=is_break,
        ongoing_classes=ongoing_classes,
        classrooms=classrooms_status,
        faculty=faculty_status,
        is_holiday=False,
        holiday_title=None
    )


@router.get("/absence/schedule")
async def get_teacher_schedule_for_absence(
    staff_id: int,
    date: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    try:
        parsed_date = datetime.datetime.strptime(date, "%Y-%m-%d").date()
        day_of_week = parsed_date.strftime("%A")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    # 1. Fetch active timeslots for the day of week (regular only)
    ts_stmt = select(TimeSlot).where(TimeSlot.day_of_week == day_of_week, TimeSlot.slot_type == "Regular")
    ts_res = await db.execute(ts_stmt)
    timeslots = ts_res.scalars().all()
    timeslots_map = {ts.id: ts for ts in timeslots}
    
    if not timeslots:
        return [] # No classes scheduled on weekends

    # 2. Fetch the teacher's schedule for this day
    stmt = (
        select(TimetableDetail)
        .join(Timetable, TimetableDetail.timetable_id == Timetable.id)
        .where(
            Timetable.is_active == True,
            TimetableDetail.staff_id == staff_id,
            TimetableDetail.timeslot_id.in_(list(timeslots_map.keys()))
        )
        .options(
            selectinload(TimetableDetail.timetable),
            selectinload(TimetableDetail.subject),
            selectinload(TimetableDetail.classroom)
        )
    )
    result = await db.execute(stmt)
    details = result.scalars().all()

    # 3. Fetch existing substitutions on this date for this teacher
    sub_stmt = select(Substitution).where(
        Substitution.date == date,
        Substitution.original_staff_id == staff_id
    ).options(selectinload(Substitution.substitute_staff))
    sub_res = await db.execute(sub_stmt)
    existing_subs = {sub.timetable_detail_id: sub for sub in sub_res.scalars().all()}

    # 4. Fetch all active substitutions on this date to know who is already covering something else
    all_subs_stmt = select(Substitution).where(Substitution.date == date)
    all_subs_res = await db.execute(all_subs_stmt)
    all_date_subs = {sub.substitute_staff_id for sub in all_subs_res.scalars().all()}

    # 5. Fetch all faculty members and their subject qualifications (competency pools)
    all_staff_stmt = select(Staff).options(selectinload(Staff.subjects))
    all_staff_res = await db.execute(all_staff_stmt)
    all_staff = all_staff_res.scalars().all()

    # Get active timetables details on this day of week to check other teachers' schedules
    all_details_stmt = (
        select(TimetableDetail)
        .join(Timetable, TimetableDetail.timetable_id == Timetable.id)
        .where(
            Timetable.is_active == True,
            TimetableDetail.timeslot_id.in_(list(timeslots_map.keys()))
        )
    )
    all_details_res = await db.execute(all_details_stmt)
    all_details = all_details_res.scalars().all()
    
    # Create a schedule mapping: { (staff_id, timeslot_id): True }
    occupied_schedule = {}
    for d in all_details:
        occupied_schedule[(d.staff_id, d.timeslot_id)] = True

    # Count overall substitutions per staff member for workload balancing
    from sqlalchemy import func
    subs_counts_stmt = select(Substitution.substitute_staff_id, func.count(Substitution.id)).group_by(Substitution.substitute_staff_id)
    subs_counts_res = await db.execute(subs_counts_stmt)
    workload_map = {staff_id: count for staff_id, count in subs_counts_res.all() if staff_id is not None}

    response_data = []

    for d in details:
        ts = timeslots_map.get(d.timeslot_id)
        if not ts:
            continue
            
        sec_res = await db.execute(select(Section).where(Section.id == d.timetable.section_id))
        section = sec_res.scalar_one_or_none()
        section_name = section.name if section else "Unknown"

        sub_record = existing_subs.get(d.id)
        is_sub = sub_record is not None
        substitute_name = sub_record.substitute_staff.name if is_sub and sub_record.substitute_staff else None
        substitute_id = sub_record.substitute_staff_id if is_sub else None
        sub_id = sub_record.id if is_sub else None

        # Determine recommendations for substitutes
        candidates = []
        for st in all_staff:
            # Cannot substitute yourself
            if st.id == staff_id:
                continue
            # Check qualification: does teacher belong to competency pool or teach this subject code?
            qualified = False
            # Check subjects competency
            for sub_comp in st.subjects:
                if sub_comp.id == d.subject_id:
                    qualified = True
                    break
            
            if not qualified:
                # Fallback: check if the staff is assigned to this section-subject
                ss_stmt = select(SectionSubject).where(
                    SectionSubject.section_id == d.timetable.section_id,
                    SectionSubject.subject_id == d.subject_id,
                    SectionSubject.assigned_staff_id == st.id
                )
                ss_res = await db.execute(ss_stmt)
                if ss_res.scalar_one_or_none():
                    qualified = True

            if not qualified:
                continue

            # Check availability: is the teacher free in this timeslot?
            # 1) Not teaching their own classes
            is_teaching_own = occupied_schedule.get((st.id, d.timeslot_id), False)
            # 2) Not already covering another substitution in this timeslot
            is_covering_sub = st.id in all_date_subs
            
            if not is_teaching_own and not is_covering_sub:
                candidates.append({
                    "id": st.id,
                    "name": st.name,
                    "sub_count": workload_map.get(st.id, 0)
                })

        response_data.append({
            "timetable_detail_id": d.id,
            "timeslot_id": d.timeslot_id,
            "period_number": ts.period_number,
            "time_range": f"{ts.start_time.strftime('%H:%M')} - {ts.end_time.strftime('%H:%M')}",
            "section_name": section_name,
            "subject_name": d.subject.name if d.subject else "Unknown",
            "subject_code": d.subject.code if d.subject else "",
            "room_number": d.classroom.room_number if d.classroom else "Online",
            "is_substituted": is_sub,
            "substitute_staff_id": substitute_id,
            "substitute_staff_name": substitute_name,
            "substitution_id": sub_id,
            "candidates": candidates
        })

    return response_data


@router.post("/substitution", response_model=SubstitutionOut)
async def create_substitution(
    req: SubstitutionCreate,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    # Check if substitution already exists for this detail and date
    exist_stmt = select(Substitution).where(
        Substitution.date == req.date,
        Substitution.timetable_detail_id == req.timetable_detail_id
    )
    exist_res = await db.execute(exist_stmt)
    if exist_res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Substitution already exists for this slot on this date.")

    # Validate staff IDs
    orig_res = await db.execute(select(Staff).where(Staff.id == req.original_staff_id))
    orig_staff = orig_res.scalar_one_or_none()
    sub_res = await db.execute(select(Staff).where(Staff.id == req.substitute_staff_id))
    sub_staff = sub_res.scalar_one_or_none()
    
    if not orig_staff or not sub_staff:
        raise HTTPException(status_code=404, detail="Staff member not found.")

    # Validate detail ID
    det_res = await db.execute(
        select(TimetableDetail)
        .where(TimetableDetail.id == req.timetable_detail_id)
        .options(selectinload(TimetableDetail.timetable), selectinload(TimetableDetail.subject), selectinload(TimetableDetail.classroom))
    )
    detail = det_res.scalar_one_or_none()
    if not detail:
        raise HTTPException(status_code=404, detail="Timetable detail not found.")

    new_sub = Substitution(
        date=req.date,
        timeslot_id=req.timeslot_id,
        original_staff_id=req.original_staff_id,
        substitute_staff_id=req.substitute_staff_id,
        timetable_detail_id=req.timetable_detail_id
    )
    db.add(new_sub)
    await db.flush()

    # Fetch section name for schema serialization
    sec_res = await db.execute(select(Section).where(Section.id == detail.timetable.section_id))
    section = sec_res.scalar_one_or_none()
    section_name = section.name if section else "Unknown"

    await db.commit()

    return SubstitutionOut(
        id=new_sub.id,
        date=new_sub.date,
        timeslot_id=new_sub.timeslot_id,
        original_staff_id=new_sub.original_staff_id,
        substitute_staff_id=new_sub.substitute_staff_id,
        timetable_detail_id=new_sub.timetable_detail_id,
        original_staff_name=orig_staff.name,
        substitute_staff_name=sub_staff.name,
        subject_name=detail.subject.name if detail.subject else "Unknown",
        subject_code=detail.subject.code if detail.subject else "",
        room_number=detail.classroom.room_number if detail.classroom else "Online",
        section_name=section_name
    )


@router.delete("/substitution/{sub_id}")
async def delete_substitution(
    sub_id: int,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_admin)
):
    stmt = select(Substitution).where(Substitution.id == sub_id)
    res = await db.execute(stmt)
    sub = res.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="Substitution not found.")
        
    await db.delete(sub)
    await db.commit()
    return {"message": "Substitution deleted successfully."}


@router.get("/substitutions/date/{date}", response_model=List[SubstitutionOut])
async def get_substitutions_by_date(
    date: str,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    stmt = (
        select(Substitution)
        .where(Substitution.date == date)
        .options(
            selectinload(Substitution.original_staff),
            selectinload(Substitution.substitute_staff),
            selectinload(Substitution.timetable_detail).selectinload(TimetableDetail.timetable),
            selectinload(Substitution.timetable_detail).selectinload(TimetableDetail.subject),
            selectinload(Substitution.timetable_detail).selectinload(TimetableDetail.classroom)
        )
    )
    res = await db.execute(stmt)
    subs = res.scalars().all()

    out = []
    for sub in subs:
        sec_res = await db.execute(select(Section).where(Section.id == sub.timetable_detail.timetable.section_id))
        section = sec_res.scalar_one_or_none()
        section_name = section.name if section else "Unknown"
        
        out.append(SubstitutionOut(
            id=sub.id,
            date=sub.date,
            timeslot_id=sub.timeslot_id,
            original_staff_id=sub.original_staff_id,
            substitute_staff_id=sub.substitute_staff_id,
            timetable_detail_id=sub.timetable_detail_id,
            original_staff_name=sub.original_staff.name if sub.original_staff else "Unknown",
            substitute_staff_name=sub.substitute_staff.name if sub.substitute_staff else "Unknown",
            subject_name=sub.timetable_detail.subject.name if sub.timetable_detail.subject else "Unknown",
            subject_code=sub.timetable_detail.subject.code if sub.timetable_detail.subject else "",
            room_number=sub.timetable_detail.classroom.room_number if sub.timetable_detail.classroom else "Online",
            section_name=section_name
        ))
    return out


