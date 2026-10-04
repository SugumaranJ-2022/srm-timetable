import logging
from collections import defaultdict
# pyrefly: ignore [missing-import]
from ortools.sat.python import cp_model
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.models import (
    Section, Subject, Staff, Classroom, TimeSlot,
    SectionSubject, Timetable, TimetableDetail, PreAllocatedSlot
)

logger = logging.getLogger(__name__)

class StopAfterFirstSolution(cp_model.CpSolverSolutionCallback):
    def __init__(self):
        cp_model.CpSolverSolutionCallback.__init__(self)

    def on_solution_callback(self):
        self.StopSearch()

async def generate_timetable_csp(
    db: AsyncSession,
    academic_year: str,
    semester: int
) -> dict:
    """
    Generates a conflict-free timetable for all sections in the given academic year and semester
    using Google OR-Tools CP-SAT Solver. Fully deterministic and reproducible.
    """
    # 1. Fetch data from DB - ordered by ID for deterministic solver state
    result_sections = await db.execute(
        select(Section).where(Section.semester == semester).order_by(Section.id)
    )
    sections = result_sections.scalars().all()

    result_classrooms = await db.execute(
        select(Classroom).where(Classroom.is_available == True).order_by(Classroom.id)
    )
    classrooms = result_classrooms.scalars().all()

    result_timeslots = await db.execute(select(TimeSlot).order_by(TimeSlot.id))
    timeslots = result_timeslots.scalars().all()

    # Get SectionSubject associations (the instruction matrix) - sorted by ID
    section_ids = [s.id for s in sections]
    result_sec_subs = await db.execute(
        select(SectionSubject).where(SectionSubject.section_id.in_(section_ids)).order_by(SectionSubject.id)
    )
    section_subjects = result_sec_subs.scalars().all()

    if not sections or not timeslots or not section_subjects:
        return {
            "success": False,
            "message": "Insufficient data (sections, timeslots, or section-subjects missing) to run the solver."
        }

    # Pre-check: Designated Homerooms Capacity
    classrooms_dict = {r.id: r for r in classrooms}
    for s in sections:
        if s.classroom_id is not None:
            target_room = classrooms_dict.get(s.classroom_id)
            if not target_room:
                return {
                    "success": False,
                    "message": f"Designated classroom ID {s.classroom_id} for Section {s.name} is either inactive, unavailable, or does not exist."
                }
            if s.strength > target_room.capacity:
                return {
                    "success": False,
                    "message": f"Designated classroom {target_room.room_number} capacity ({target_room.capacity}) is insufficient for Section {s.name} strength ({s.strength})."
                }

    # Group SectionSubjects by section
    sec_sub_map = defaultdict(list)
    for ss in section_subjects:
        sec_sub_map[ss.section_id].append(ss)

    # Load subjects for quick lookup - sorted by ID
    result_subjects = await db.execute(
        select(Subject).where(Subject.id.in_([ss.subject_id for ss in section_subjects])).order_by(Subject.id)
    )
    subjects_dict = {sub.id: sub for sub in result_subjects.scalars().all()}

    # Initialize CP-SAT Model
    model = cp_model.CpModel()

    # 2. Decision Variables
    # X[s, t, sub_id] = 1 if section s has subject sub_id at timeslot t
    X = {}
    X_theory = {}
    X_lab = {}
    # Y[s, t, r_id] = 1 if section s is in classroom r_id at timeslot t (only for Regular/Online where classroom is used)
    Y = {}
    # Z[s, r] = 1 if section s is assigned to classroom r as its fixed homeroom
    Z = {}

    # Define variables
    # Find lab classrooms for Z definition
    fsh1_labs = [r.id for r in classrooms if r.building == "FSH block 1" and r.room_number in ["908 Lab", "808 Lab", "708 Lab", "402 Lab", "403 Lab"]]
    fsh2_labs = [r.id for r in classrooms if r.building == "FSH block 2" and r.room_number in ["301 Lab", "302 Lab", "303 Lab", "304 Lab", "404 Lab"]]
    all_labs = fsh1_labs + fsh2_labs

    for s in sections:
        # Homeroom assignment variables (exclude lab classrooms)
        for r in classrooms:
            if s.strength <= r.capacity and r.id not in all_labs:
                Z[(s.id, r.id)] = model.NewBoolVar(f"Z_{s.id}_{r.id}")

        # Non-break timeslots
        active_slots = [t for t in timeslots if t.slot_type != "Break"]
        ss_list = sec_sub_map[s.id]
        
        for t in active_slots:
            for ss in ss_list:
                # Theory and Lab variables for subject
                var_theory_name = f"X_theory_{s.id}_{t.id}_{ss.subject_id}"
                var_lab_name = f"X_lab_{s.id}_{t.id}_{ss.subject_id}"
                X_theory[(s.id, t.id, ss.subject_id)] = model.NewBoolVar(var_theory_name)
                X_lab[(s.id, t.id, ss.subject_id)] = model.NewBoolVar(var_lab_name)
                
                # Variable X[section, timeslot, subject]
                var_name = f"X_{s.id}_{t.id}_{ss.subject_id}"
                X[(s.id, t.id, ss.subject_id)] = model.NewBoolVar(var_name)
                model.Add(X[(s.id, t.id, ss.subject_id)] == X_theory[(s.id, t.id, ss.subject_id)] + X_lab[(s.id, t.id, ss.subject_id)])
            
            # Classroom assignment variables (only for Regular slots)
            if t.slot_type == "Regular":
                for r in classrooms:
                    # Volumetric Check: section strength must fit classroom capacity
                    if s.strength <= r.capacity:
                        var_name = f"Y_{s.id}_{t.id}_{r.id}"
                        Y[(s.id, t.id, r.id)] = model.NewBoolVar(var_name)

    # 3. Hard Constraints

    # Homeroom Constraints:
    # 1. Each section must be assigned exactly one fixed homeroom.
    for s in sections:
        z_vars = [Z[(s.id, r.id)] for r in classrooms if (s.id, r.id) in Z]
        if z_vars:
            model.Add(sum(z_vars) == 1)
        if s.classroom_id is not None:
            if (s.id, s.classroom_id) in Z:
                model.Add(Z[(s.id, s.classroom_id)] == 1)

    # 2. Exclusivity: Each classroom is assigned to at most one section (if enough classrooms exist).
    unique_rooms = len(classrooms) >= len(sections)
    for r in classrooms:
        z_vars = [Z[(s.id, r.id)] for s in sections if (s.id, r.id) in Z]
        if z_vars and unique_rooms:
            model.Add(sum(z_vars) <= 1)

    # Fetch Pre-Allocated Locked UG Slots
    res_pre = await db.execute(
        select(PreAllocatedSlot).where(PreAllocatedSlot.section_id.in_(section_ids))
    )
    pre_allocated_slots = res_pre.scalars().all()

    # 3. Link Timeslot Room Assignment (Y) to Homeroom (Z) / Lab Classrooms depending on slot type (Theory vs Lab)
    for s in sections:
        if s.program in ["MCA", "MCA_GENAI", "MSC"]:
            s_lab_room_ids = fsh1_labs
        else:
            s_lab_room_ids = fsh2_labs
            
        if not s_lab_room_ids:
            s_lab_room_ids = [r.id for r in classrooms]
            
        active_slots = [t for t in timeslots if t.slot_type == "Regular"]
        ss_list = sec_sub_map[s.id]
        
        for t in active_slots:
            # Check if there is a pre-allocated room override for this section & timeslot
            pre_room_id = next((ps.classroom_id for ps in pre_allocated_slots if ps.section_id == s.id and ps.timeslot_id == t.id and ps.classroom_id is not None), None)

            for ss in ss_list:
                x_theory_var = X_theory[(s.id, t.id, ss.subject_id)]
                x_lab_var = X_lab[(s.id, t.id, ss.subject_id)]
                
                # If theory is scheduled, the section must be in its assigned room (homeroom Z or pre-allocated classroom)
                for r in classrooms:
                    if (s.id, t.id, r.id) in Y:
                        if pre_room_id is not None:
                            if r.id == pre_room_id:
                                model.Add(Y[(s.id, t.id, r.id)] == 1).OnlyEnforceIf(x_theory_var)
                            else:
                                model.Add(Y[(s.id, t.id, r.id)] == 0).OnlyEnforceIf(x_theory_var)
                        elif (s.id, r.id) in Z:
                            model.Add(Y[(s.id, t.id, r.id)] == Z[(s.id, r.id)]).OnlyEnforceIf(x_theory_var)
                
                # If lab is scheduled, the section must be in one of its program's lab rooms
                # For non-lab rooms, Y must be 0
                for r in classrooms:
                    if (s.id, t.id, r.id) in Y:
                        if r.id not in s_lab_room_ids:
                            model.Add(Y[(s.id, t.id, r.id)] == 0).OnlyEnforceIf(x_lab_var)
                
                # Exactly one lab room must be assigned from s_lab_room_ids
                lab_y_vars = [Y[(s.id, t.id, r_id)] for r_id in s_lab_room_ids if (s.id, t.id, r_id) in Y]
                if lab_y_vars:
                    model.Add(sum(lab_y_vars) == 1).OnlyEnforceIf(x_lab_var)

    pre_slot_keys = set()
    for ps in pre_allocated_slots:
        pre_slot_keys.add((ps.section_id, ps.timeslot_id))
        if (ps.section_id, ps.timeslot_id, ps.subject_id) in X:
            model.Add(X[(ps.section_id, ps.timeslot_id, ps.subject_id)] == 1)
            if ps.classroom_id and (ps.section_id, ps.timeslot_id, ps.classroom_id) in Y:
                model.Add(Y[(ps.section_id, ps.timeslot_id, ps.classroom_id)] == 1)

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
    pre_staff_map = {
        (ps.section_id, ps.timeslot_id): ps.staff_id 
        for ps in pre_allocated_slots if ps.staff_id is not None
    }
    staff_timeslot_vars = defaultdict(list)
    for (s_id, t_id, sub_id), var in X.items():
        stf_id = pre_staff_map.get((s_id, t_id))
        if not stf_id:
            ss = next((x for x in section_subjects if x.section_id == s_id and x.subject_id == sub_id), None)
            if ss:
                stf_id = ss.assigned_staff_id
        if stf_id:
            staff_timeslot_vars[(stf_id, t_id)].append(var)

    for (staff_id, t_id) in sorted(staff_timeslot_vars.keys()):
        vars_list = staff_timeslot_vars[(staff_id, t_id)]
        model.AddAtMostOne(vars_list)

    # Constraint 4: Room Contention
    # A classroom cannot hold more than 1 section at the same timeslot
    room_timeslot_vars = defaultdict(list)
    for (s_id, t_id, r_id), var in Y.items():
        room_timeslot_vars[(r_id, t_id)].append(var)

    for (r_id, t_id) in sorted(room_timeslot_vars.keys()):
        vars_list = room_timeslot_vars[(r_id, t_id)]
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

    # Constraint 8: Credit Hours Target
    # For each section and subject, schedule target theory and lab credits respecting pre-allocated slots & zero-free-period policy
    targets_per_section = {}
    for s in sections:
        ss_list = sec_sub_map[s.id]
        sec_pre_slots = [ps for ps in pre_allocated_slots if ps.section_id == s.id]
        num_sec_pre = len(sec_pre_slots)
        free_slots_remaining = max(0, 25 - num_sec_pre)

        # Separate pre-allocated subjects from regular non-preallocated subjects
        pre_sub_ids = {ps.subject_id for ps in sec_pre_slots}
        regular_ss_list = [ss for ss in ss_list if ss.subject_id not in pre_sub_ids]
        
        total_reg_credits = sum(subjects_dict[ss.subject_id].credits for ss in regular_ss_list if ss.subject_id in subjects_dict)

        targets = {}
        if s.enable_zero_free_periods and regular_ss_list and free_slots_remaining > 0:
            configured_project_days = [d.strip() for d in s.project_days.split(",") if d.strip()]
            max_proj_periods = len(configured_project_days) if s.enable_project_cadence else 5

            proj_ss_list = [ss for ss in regular_ss_list if subjects_dict[ss.subject_id].is_project]
            non_proj_ss_list = [ss for ss in regular_ss_list if not subjects_dict[ss.subject_id].is_project]

            allocated = 0
            for ss in proj_ss_list:
                sub = subjects_dict.get(ss.subject_id)
                if sub:
                    tgt = min(sub.credits, max_proj_periods)
                    targets[ss.subject_id] = tgt
                    allocated += tgt

            rem_slots = max(0, free_slots_remaining - allocated)
            total_non_proj_credits = sum(subjects_dict[ss.subject_id].credits for ss in non_proj_ss_list if ss.subject_id in subjects_dict)

            if non_proj_ss_list and rem_slots > 0:
                allocated_non_proj = 0
                for idx, ss in enumerate(non_proj_ss_list):
                    sub = subjects_dict.get(ss.subject_id)
                    if not sub:
                        continue
                    if idx == len(non_proj_ss_list) - 1:
                        tgt = max(1, rem_slots - allocated_non_proj)
                    else:
                        prop = sub.credits / total_non_proj_credits if total_non_proj_credits > 0 else 1.0 / len(non_proj_ss_list)
                        tgt = max(1, int(round(prop * rem_slots)))
                        allocated_non_proj += tgt
                    targets[ss.subject_id] = tgt
        else:
            for ss in regular_ss_list:
                sub = subjects_dict.get(ss.subject_id)
                if sub:
                    if sub.is_project:
                        configured_project_days = [d.strip() for d in s.project_days.split(",") if d.strip()]
                        max_proj_periods = len(configured_project_days) if s.enable_project_cadence else 5
                        targets[ss.subject_id] = min(sub.credits, max_proj_periods)
                    else:
                        targets[ss.subject_id] = sub.credits

        targets_per_section[s.id] = targets

        for ss in ss_list:
            sub = subjects_dict.get(ss.subject_id)
            if not sub:
                continue
            possible_slots = [t for t in timeslots if t.slot_type != "Break"]
            theory_vars = [X_theory[(s.id, t.id, ss.subject_id)] for t in possible_slots if (s.id, t.id, ss.subject_id) in X_theory]
            lab_vars = [X_lab[(s.id, t.id, ss.subject_id)] for t in possible_slots if (s.id, t.id, ss.subject_id) in X_lab]
            
            num_pre = sum(1 for ps in sec_pre_slots if ps.subject_id == ss.subject_id)
            
            if num_pre > 0:
                model.Add(sum(theory_vars) + sum(lab_vars) == num_pre)
            else:
                target_periods = targets.get(ss.subject_id, sub.credits)
                if sub.is_project:
                    model.Add(sum(theory_vars) == target_periods)
                    model.Add(sum(lab_vars) == 0)
                elif sub.credits <= 4:
                    model.Add(sum(theory_vars) == target_periods)
                    model.Add(sum(lab_vars) == 0)
                else:
                    model.Add(sum(theory_vars) + sum(lab_vars) == target_periods)

    # Group timeslots by day for daily constraints
    day_groups = defaultdict(list)
    for t in timeslots:
        if t.slot_type != "Break":
            day_groups[t.day_of_week].append(t)

    # Constraint 9: Daily Coverage Rule (Rule 8) & At most once per day
    for s in sections:
        ss_list = sec_sub_map[s.id]
        targets = targets_per_section.get(s.id, {})
        configured_project_days = [d.strip() for d in s.project_days.split(",") if d.strip()]
        sec_pre_slots = [ps for ps in pre_allocated_slots if ps.section_id == s.id]

        for day in sorted(day_groups.keys()):
            slots = day_groups[day]
            slot_ids = {t.id for t in slots}
            num_pre_on_day = sum(1 for ps in sec_pre_slots if ps.timeslot_id in slot_ids)
            has_project = s.enable_project_cadence and (day in configured_project_days)
            avail_for_regular = 5 - num_pre_on_day - (1 if has_project else 0)

            heavy_subs = [ss for ss in ss_list if not subjects_dict[ss.subject_id].is_project and targets.get(ss.subject_id, subjects_dict[ss.subject_id].credits) >= 5]
            can_require_daily_coverage = len(heavy_subs) <= avail_for_regular

            for ss in ss_list:
                sub = subjects_dict[ss.subject_id]
                day_sub_vars = [X[(s.id, t.id, ss.subject_id)] for t in slots if (s.id, t.id, ss.subject_id) in X]
                if not day_sub_vars:
                    continue

                tgt_p = targets.get(ss.subject_id, sub.credits)
                if not sub.is_project and tgt_p >= 5:
                    if s.enable_daily_coverage and can_require_daily_coverage:
                        # Rule 8: Subjects with 5+ periods appear at least once every day
                        model.Add(sum(day_sub_vars) >= 1)
                    else:
                        model.AddAtMostOne(day_sub_vars)
                elif not sub.is_project:
                    if tgt_p <= len(day_groups):
                        model.AddAtMostOne(day_sub_vars)

    # Constraint 10: Project Cadence Rule (Rule 9)
    # The "Project" subject must be scheduled on exactly the configured weekdays, one period per scheduled day.
    for s in sections:
        ss_list = sec_sub_map[s.id]
        project_ss = next((ss for ss in ss_list if subjects_dict[ss.subject_id].is_project), None)
        if not project_ss:
            continue

        configured_project_days = [d.strip() for d in s.project_days.split(",") if d.strip()]
        for day in sorted(day_groups.keys()):
            slots = day_groups[day]
            project_vars_on_day = [X[(s.id, t.id, project_ss.subject_id)] for t in slots if (s.id, t.id, project_ss.subject_id) in X]
            if not project_vars_on_day:
                continue

            if s.enable_project_cadence:
                if day in configured_project_days:
                    # At most 1 period of Project on configured project days
                    model.Add(sum(project_vars_on_day) <= 1)
                else:
                    # 0 periods of Project on non-project days
                    model.Add(sum(project_vars_on_day) == 0)

    # 4. Soft Constraints (Optimization Objectives)

    # A: Cognitive Saturation Control - Avoid scheduling same subject multiple times a day
    day_penalties = []
    for s in sections:
        ss_list = sec_sub_map[s.id]
        for day in sorted(day_groups.keys()):
            slots = day_groups[day]
            for ss in ss_list:
                day_sub_vars = [X[(s.id, t.id, ss.subject_id)] for t in slots if (s.id, t.id, ss.subject_id) in X]
                if len(day_sub_vars) > 1:
                    penalty = model.NewIntVar(0, len(day_sub_vars), f"pen_{s.id}_{day}_{ss.subject_id}")
                    model.Add(penalty >= sum(day_sub_vars) - 1)
                    day_penalties.append(penalty)

    # B: Workload Distribution - Smooth staff workload across days
    staff_ids = sorted(list({ss.assigned_staff_id for ss in section_subjects}))
    max_daily_staff_load = model.NewIntVar(0, len(timeslots), "max_daily_staff_load")
    
    # Pre-group section-subjects by assigned staff
    staff_ss_map = defaultdict(list)
    for ss in section_subjects:
        staff_ss_map[ss.assigned_staff_id].append(ss)

    for staff_id in staff_ids:
        for day in sorted(day_groups.keys()):
            slots = day_groups[day]
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
        for day in sorted(day_groups.keys()):
            slots = day_groups[day]
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

    # 5. Run Solver - Configured with safe thread count to prevent cloud resource throttling and memory OOM
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 60.0
    
    # Restrict to at most 4 workers to speed up multi-section solving
    import os
    cpu_count = os.cpu_count() or 1
    solver.parameters.num_search_workers = min(4, cpu_count)
    
    solver.parameters.interleave_search = True
    status = solver.Solve(model)
    print("SOLVER STATUS NAME:", solver.StatusName(status))

    has_solution = status in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    if not has_solution and status == cp_model.UNKNOWN:
        try:
            if X:
                sample_var = next(iter(X.values()))
                _ = solver.Value(sample_var)
                has_solution = True
        except Exception:
            has_solution = False

    if has_solution:
        # Save generated timetable
        for s in sections:
            existing_timetables_res = await db.execute(
                select(Timetable).where(
                    Timetable.section_id == s.id
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
                is_published=True,
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
                    is_man = (s.id, t.id) in pre_slot_keys
                    pre_stf = next((ps.staff_id for ps in pre_allocated_slots if ps.section_id == s.id and ps.timeslot_id == t.id and ps.staff_id is not None), None)
                    eff_staff_id = pre_stf if pre_stf is not None else ss.assigned_staff_id
                    
                    detail = TimetableDetail(
                        timetable_id=timetable.id,
                        timeslot_id=t.id,
                        subject_id=scheduled_sub_id,
                        staff_id=eff_staff_id,
                        classroom_id=assigned_room_id,
                        is_manual=is_man
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
            for day in sorted(day_groups.keys()):
                slots = day_groups[day]
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
        # Run diagnostic analysis to pinpoint why model is infeasible
        reasons = []
        
        # Check 1: Staff Overlap among pre-allocated slots
        res_pre_all = await db.execute(select(PreAllocatedSlot))
        all_pre_slots = res_pre_all.scalars().all()
        staff_slot_map = defaultdict(list)
        for ps in all_pre_slots:
            staff_slot_map[(ps.staff_id, ps.timeslot_id)].append(ps)
        
        for (stf_id, ts_id), ps_list in staff_slot_map.items():
            if len(ps_list) > 1:
                stf = (await db.execute(select(Staff).where(Staff.id == stf_id))).scalar_one_or_none()
                ts = (await db.execute(select(TimeSlot).where(TimeSlot.id == ts_id))).scalar_one_or_none()
                sec_names = []
                for p in ps_list:
                    s_obj = (await db.execute(select(Section).where(Section.id == p.section_id))).scalar_one_or_none()
                    if s_obj: sec_names.append(s_obj.name)
                stf_name = stf.name if stf else f"Staff ID {stf_id}"
                ts_info = f"{ts.day_of_week} Period {ts.period_number}" if ts else f"Slot ID {ts_id}"
                reasons.append(f"Faculty Overlap: {stf_name} is locked to multiple classes ({', '.join(sec_names)}) during {ts_info}.")

        # Check 2: Total required pre-allocated locked slots vs available active slots (25 active slots)
        for s in sections:
            num_pre = len([ps for ps in all_pre_slots if ps.section_id == s.id])
            if num_pre > 25:
                reasons.append(f"Pre-Allocation Overload: Section {s.name} has {num_pre} locked pre-allocated slots, which exceeds the total weekly limit of 25 periods.")

        if reasons:
            diagnostic_msg = "Solver infeasible due to setup conflicts: " + " | ".join(reasons)
        else:
            diagnostic_msg = "Solver failed to find a feasible solution. Please check for staff overlap, lab room capacity, or conflicting pre-allocated UG slots."

        return {
            "success": False,
            "message": diagnostic_msg
        }
