from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any

from backend.app.core.database import get_db
from backend.app.api.auth import get_current_user, get_current_admin, get_current_staff
from backend.app.models.models import (
    User, Timetable, TimetableDetail, Section, Subject, Staff, Classroom, TimeSlot, SectionSubject
)
from backend.app.schemas.schemas import (
    TimetableOut, TimetableGenerateRequest, ValidateOverrideRequest, ValidateOverrideResponse, ConflictDetail
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

    # Enrich details with names for UI consumption
    enriched_details = []
    for detail in timetable.details:
        sub_res = await db.execute(select(Subject).where(Subject.id == detail.subject_id))
        subject = sub_res.scalar_one_or_none()
        
        staff_res = await db.execute(select(Staff).where(Staff.id == detail.staff_id))
        staff = staff_res.scalar_one_or_none()
        
        room_res = await db.execute(select(Classroom).where(Classroom.id == detail.classroom_id)) if detail.classroom_id else None
        classroom = room_res.scalar_one_or_none() if room_res else None

        enriched_details.append({
            "id": detail.id,
            "timeslot_id": detail.timeslot_id,
            "subject_id": detail.subject_id,
            "staff_id": detail.staff_id,
            "classroom_id": detail.classroom_id,
            "subject_name": subject.name if subject else "Unknown",
            "subject_code": subject.code if subject else "",
            "staff_name": staff.name if staff else "Unknown",
            "room_number": classroom.room_number if classroom else "Online"
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
