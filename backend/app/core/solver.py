import logging
from collections import defaultdict
from ortools.sat.python import cp_model
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import (
    Section, Subject, Staff, Classroom, TimeSlot,
    SectionSubject, Timetable, TimetableDetail
)

logger = logging.getLogger(__name__)

async def generate_timetable_csp(
    db: AsyncSession,
    academic_year: str,
    semester: int
) -> dict:
    """
    Generates a conflict-free timetable for all sections in the given academic year and semester
    using Google OR-Tools CP-SAT Solver.
    """
    # 1. Fetch data from DB
    result_sections = await db.execute(
        select(Section).where(Section.semester == semester)
    )
    sections = result_sections.scalars().all()

    result_classrooms = await db.execute(
        select(Classroom).where(Classroom.is_available == True)
    )
    classrooms = result_classrooms.scalars().all()

    result_timeslots = await db.execute(select(TimeSlot))
    timeslots = result_timeslots.scalars().all()

    # Get SectionSubject associations (the instruction matrix)
    section_ids = [s.id for s in sections]
    result_sec_subs = await db.execute(
        select(SectionSubject).where(SectionSubject.section_id.in_(section_ids))
    )
    section_subjects = result_sec_subs.scalars().all()

    if not sections or not timeslots or not section_subjects:
        return {
            "success": False,
            "message": "Insufficient data (sections, timeslots, or section-subjects missing) to run the solver."
        }

    # Group SectionSubjects by section
    sec_sub_map = defaultdict(list)
    for ss in section_subjects:
        sec_sub_map[ss.section_id].append(ss)

    # Load subjects for quick lookup
    result_subjects = await db.execute(
        select(Subject).where(Subject.id.in_([ss.subject_id for ss in section_subjects]))
    )
    subjects_dict = {sub.id: sub for sub in result_subjects.scalars().all()}

    # Initialize CP-SAT Model
    model = cp_model.CpModel()

    # 2. Decision Variables
    # X[s, t, sub_id] = 1 if section s has subject sub_id at timeslot t
    X = {}
    # Y[s, t, r_id] = 1 if section s is in classroom r_id at timeslot t (only for Regular/Online where classroom is used)
    Y = {}

    # Define variables
    for s in sections:
        # Non-break timeslots
        active_slots = [t for t in timeslots if t.slot_type != "Break"]
        ss_list = sec_sub_map[s.id]
        
        for t in active_slots:
            for ss in ss_list:
                # Variable X[section, timeslot, subject]
                var_name = f"X_{s.id}_{t.id}_{ss.subject_id}"
                X[(s.id, t.id, ss.subject_id)] = model.NewBoolVar(var_name)
            
            # Classroom assignment variables (only for Regular slots)
            if t.slot_type == "Regular":
                for r in classrooms:
                    # Volumetric Check: section strength must fit classroom capacity
                    if s.strength <= r.capacity:
                        var_name = f"Y_{s.id}_{t.id}_{r.id}"
                        Y[(s.id, t.id, r.id)] = model.NewBoolVar(var_name)

    # 3. Hard Constraints

    # 3. Hard Constraints

    # Constraint 1 & 2: Section Overlap, Break Integrity, and Zero Free-Period (Rule 7)
    # For each section and timeslot, exactly 1 subject is scheduled if zero-free-period is enabled.
    for s in sections:
        active_slots = [t for t in timeslots if t.slot_type != "Break"]
        ss_list = sec_sub_map[s.id]
        for t in active_slots:
            vars_list = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list if (s.id, t.id, ss.subject_id) in X]
            if vars_list:
                if s.enable_zero_free_periods:
                    model.Add(sum(vars_list) == 1)
                else:
                    model.Add(sum(vars_list) <= 1)

    # Constraint 3: Staff Overlap
    # A staff member cannot teach more than 1 section at the same timeslot
    staff_timeslot_vars = defaultdict(list)
    for (s_id, t_id, sub_id), var in X.items():
        ss = next((x for x in section_subjects if x.section_id == s_id and x.subject_id == sub_id), None)
        if ss:
            staff_timeslot_vars[(ss.assigned_staff_id, t_id)].append(var)

    for (staff_id, t_id), vars_list in staff_timeslot_vars.items():
        model.AddAtMostOne(vars_list)

    # Constraint 4: Room Contention
    # A classroom cannot hold more than 1 section at the same timeslot
    room_timeslot_vars = defaultdict(list)
    for (s_id, t_id, r_id), var in Y.items():
        room_timeslot_vars[(r_id, t_id)].append(var)

    for (r_id, t_id), vars_list in room_timeslot_vars.items():
        model.AddAtMostOne(vars_list)

    # Constraint 5: Physical Allocation
    # Regular timeslots: if a class is scheduled, a room must be assigned
    for s in sections:
        regular_slots = [t for t in timeslots if t.slot_type == "Regular"]
        ss_list = sec_sub_map[s.id]
        for t in regular_slots:
            x_vars = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list]
            y_vars = [Y[(s.id, t.id, r.id)] for r in classrooms if (s.id, t.id, r.id) in Y]
            model.Add(sum(y_vars) == sum(x_vars))

    # Constraint 6: Volumetric Check is already handled by not creating Y variables where strength > capacity.

    # Constraint 8: Credit Hours Target
    # For each section and subject, schedule exactly the required credits (hours)
    for s in sections:
        ss_list = sec_sub_map[s.id]
        for ss in ss_list:
            sub = subjects_dict[ss.subject_id]
            possible_slots = [t for t in timeslots if t.slot_type != "Break"]
            sub_vars = [X[(s.id, t.id, ss.subject_id)] for t in possible_slots if (s.id, t.id, ss.subject_id) in X]
            model.Add(sum(sub_vars) == sub.credits)

    # Group timeslots by day for daily constraints
    day_groups = defaultdict(list)
    for t in timeslots:
        if t.slot_type != "Break":
            day_groups[t.day_of_week].append(t)

    # Constraint 9: Daily Coverage Rule (Rule 8) & At most once per day
    for s in sections:
        ss_list = sec_sub_map[s.id]
        for day, slots in day_groups.items():
            for ss in ss_list:
                sub = subjects_dict[ss.subject_id]
                day_sub_vars = [X[(s.id, t.id, ss.subject_id)] for t in slots if (s.id, t.id, ss.subject_id) in X]
                if not day_sub_vars:
                    continue

                if not sub.is_project:
                    if s.enable_daily_coverage:
                        # Rule 8: Every non-project subject must appear at least once every day
                        model.Add(sum(day_sub_vars) >= 1)
                    else:
                        # Fallback: At most once per day if credits <= 5 days
                        if sub.credits <= len(day_groups):
                            model.AddAtMostOne(day_sub_vars)

    # Constraint 10: Project Cadence Rule (Rule 9)
    # The "Project" subject must be scheduled on exactly the configured weekdays, one period per scheduled day.
    for s in sections:
        ss_list = sec_sub_map[s.id]
        project_ss = next((ss for ss in ss_list if subjects_dict[ss.subject_id].is_project), None)
        if not project_ss:
            continue

        configured_project_days = [d.strip() for d in s.project_days.split(",") if d.strip()]
        for day, slots in day_groups.items():
            project_vars_on_day = [X[(s.id, t.id, project_ss.subject_id)] for t in slots if (s.id, t.id, project_ss.subject_id) in X]
            if not project_vars_on_day:
                continue

            if s.enable_project_cadence:
                if day in configured_project_days:
                    # Exactly 1 period of Project on this day
                    model.Add(sum(project_vars_on_day) == 1)
                else:
                    # 0 periods of Project on this day
                    model.Add(sum(project_vars_on_day) == 0)

    # 4. Soft Constraints (Optimization Objectives)

    # A: Cognitive Saturation Control - Avoid scheduling same subject multiple times a day
    day_penalties = []
    for s in sections:
        ss_list = sec_sub_map[s.id]
        for day, slots in day_groups.items():
            for ss in ss_list:
                day_sub_vars = [X[(s.id, t.id, ss.subject_id)] for t in slots if (s.id, t.id, ss.subject_id) in X]
                if len(day_sub_vars) > 1:
                    penalty = model.NewIntVar(0, len(day_sub_vars), f"pen_{s.id}_{day}_{ss.subject_id}")
                    model.Add(penalty >= sum(day_sub_vars) - 1)
                    day_penalties.append(penalty)

    # B: Workload Distribution - Smooth staff workload across days
    staff_ids = list({ss.assigned_staff_id for ss in section_subjects})
    max_daily_staff_load = model.NewIntVar(0, len(timeslots), "max_daily_staff_load")
    
    # Pre-group section-subjects by assigned staff
    staff_ss_map = defaultdict(list)
    for ss in section_subjects:
        staff_ss_map[ss.assigned_staff_id].append(ss)

    for staff_id in staff_ids:
        for day, slots in day_groups.items():
            daily_vars = []
            for t in slots:
                for ss in staff_ss_map[staff_id]:
                    if (ss.section_id, t.id, ss.subject_id) in X:
                        daily_vars.append(X[(ss.section_id, t.id, ss.subject_id)])
            if daily_vars:
                model.Add(max_daily_staff_load >= sum(daily_vars))

    # C: Staff Continuity Rule (NEW) - Minimize daily idle gaps in staff schedule
    staff_day_gaps = []
    for staff_id in staff_ids:
        for day, slots in day_groups.items():
            sorted_slots = sorted(slots, key=lambda slot: slot.period_number)
            S = []
            for t in sorted_slots:
                slot_vars = []
                for ss in staff_ss_map[staff_id]:
                    if (ss.section_id, t.id, ss.subject_id) in X:
                        slot_vars.append(X[(ss.section_id, t.id, ss.subject_id)])
                
                if slot_vars:
                    S_t = model.NewBoolVar(f"S_teach_{staff_id}_{t.id}")
                    model.Add(S_t == sum(slot_vars))
                    S.append(S_t)
                else:
                    S.append(0)
            
            n_slots = len(S)
            for i in range(n_slots):
                for j in range(i + 1, n_slots):
                    for k in range(j + 1, n_slots):
                        gap_var = model.NewBoolVar(f"gap_{staff_id}_{day}_{i}_{j}_{k}")
                        model.Add(gap_var >= S[i] + S[k] - S[j] - 1)
                        staff_day_gaps.append(gap_var)

    # D: Project designated slot preference (NEW) - Prefer Period 5 (which is period_number == 6)
    project_position_penalties = []
    for s in sections:
        ss_list = sec_sub_map[s.id]
        project_ss = next((ss for ss in ss_list if subjects_dict[ss.subject_id].is_project), None)
        if project_ss:
            configured_project_days = [d.strip() for d in s.project_days.split(",") if d.strip()]
            for day in configured_project_days:
                t_p5 = next((t for t in timeslots if t.day_of_week == day and t.period_number == 6), None)
                if t_p5 and (s.id, t_p5.id, project_ss.subject_id) in X:
                    pen = model.NewBoolVar(f"proj_pen_{s.id}_{day}")
                    model.Add(pen == 1 - X[(s.id, t_p5.id, project_ss.subject_id)])
                    project_position_penalties.append(pen)

    # Objective: Minimize cognitive saturation penalties, staff load imbalance, staff daily idle gaps, and project position deviation
    model.Minimize(
        sum(day_penalties) * 20 + 
        max_daily_staff_load * 10 + 
        sum(staff_day_gaps) * 4 + 
        sum(project_position_penalties) * 3
    )

    # 5. Run Solver
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 15.0  # Limit run time
    status = solver.Solve(model)

    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        # Save generated timetable
        for s in sections:
            existing_timetables_res = await db.execute(
                select(Timetable).where(
                    Timetable.section_id == s.id,
                    Timetable.academic_year == academic_year,
                    Timetable.semester == semester
                )
            )
            for et in existing_timetables_res.scalars().all():
                await db.delete(et)
        
        await db.flush()

        saved_timetables = []
        for s in sections:
            timetable = Timetable(
                section_id=s.id,
                academic_year=academic_year,
                semester=semester,
                is_active=True,
                version=1
            )
            db.add(timetable)
            await db.flush()

            ss_list = sec_sub_map[s.id]
            for t in timeslots:
                if t.slot_type == "Break":
                    continue

                scheduled_sub_id = None
                for ss in ss_list:
                    if solver.Value(X[(s.id, t.id, ss.subject_id)]) == 1:
                        scheduled_sub_id = ss.subject_id
                        break

                if scheduled_sub_id:
                    assigned_room_id = None
                    if t.slot_type == "Regular":
                        for r in classrooms:
                            if (s.id, t.id, r.id) in Y and solver.Value(Y[(s.id, t.id, r.id)]) == 1:
                                assigned_room_id = r.id
                                break

                    ss = next(x for x in ss_list if x.subject_id == scheduled_sub_id)
                    
                    detail = TimetableDetail(
                        timetable_id=timetable.id,
                        timeslot_id=t.id,
                        subject_id=scheduled_sub_id,
                        staff_id=ss.assigned_staff_id,
                        classroom_id=assigned_room_id
                    )
                    db.add(detail)

            saved_timetables.append(timetable)

        # Calculate metrics
        metrics = {
            "zero_free_period_compliance": 0,
            "project_cadence_compliance": 0,
            "daily_coverage_compliance": 0,
            "total_staff_idle_gaps": 0,
            "max_daily_staff_load": int(solver.Value(max_daily_staff_load))
        }

        total_gaps = 0
        for gap_var in staff_day_gaps:
            total_gaps += int(solver.Value(gap_var))
        metrics["total_staff_idle_gaps"] = total_gaps

        for s in sections:
            ss_list = sec_sub_map[s.id]
            s_zero_free = True
            s_daily_cov = True
            project_days_count = 0
            
            active_slots = [t for t in timeslots if t.slot_type != "Break"]
            for t in active_slots:
                scheduled = False
                for ss in ss_list:
                    if solver.Value(X[(s.id, t.id, ss.subject_id)]) == 1:
                        scheduled = True
                        break
                if not scheduled:
                    s_zero_free = False
            
            if s_zero_free:
                metrics["zero_free_period_compliance"] += 1
                
            project_ss = next((ss for ss in ss_list if subjects_dict[ss.subject_id].is_project), None)
            for day, slots in day_groups.items():
                day_has_all_core = True
                for ss in ss_list:
                    sub = subjects_dict[ss.subject_id]
                    if not sub.is_project:
                        has_sub = False
                        for t in slots:
                            if solver.Value(X[(s.id, t.id, ss.subject_id)]) == 1:
                                has_sub = True
                                break
                        if not has_sub:
                            day_has_all_core = False
                if not day_has_all_core:
                    s_daily_cov = False
                
                if project_ss:
                    has_project = False
                    for t in slots:
                        if solver.Value(X[(s.id, t.id, project_ss.subject_id)]) == 1:
                            has_project = True
                            break
                    if has_project:
                        project_days_count += 1
                        
            if s_daily_cov:
                metrics["daily_coverage_compliance"] += 1
            
            configured_project_days = [d.strip() for d in s.project_days.split(",") if d.strip()]
            if project_days_count == len(configured_project_days):
                metrics["project_cadence_compliance"] += 1

        await db.commit()
        return {
            "success": True,
            "message": f"Successfully generated conflict-free timetables for {len(sections)} sections.",
            "timetables_count": len(saved_timetables),
            "metrics": metrics
        }
    else:
        return {
            "success": False,
            "message": "Solver failed to find a feasible solution. Check for resource constraints (e.g. not enough classrooms or staff overlap conflict)."
        }
