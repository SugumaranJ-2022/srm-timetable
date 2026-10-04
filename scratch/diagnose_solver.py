import asyncio
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy.future import select
from backend.app.models.models import Section, Subject, Staff, SectionSubject, TimeSlot, Classroom, PreAllocatedSlot
from ortools.sat.python import cp_model
from collections import defaultdict

async def debug_solver_run():
    async with AsyncSessionLocal() as db:
        res_sec = await db.execute(select(Section).where(Section.semester == 1))
        sections = res_sec.scalars().all()
        
        res_ss = await db.execute(select(SectionSubject))
        section_subjects = res_ss.scalars().all()

        res_ts = await db.execute(select(TimeSlot))
        timeslots = res_ts.scalars().all()

        res_cr = await db.execute(select(Classroom).where(Classroom.is_available == True))
        classrooms = res_cr.scalars().all()

        res_sub = await db.execute(select(Subject))
        subjects = res_sub.scalars().all()
        subjects_dict = {sub.id: sub for sub in subjects}

        res_pre = await db.execute(select(PreAllocatedSlot))
        pre_allocated_slots = res_pre.scalars().all()

        sec_ids = {s.id for s in sections}
        sec_sub_map = defaultdict(list)
        for ss in section_subjects:
            if ss.section_id in sec_ids:
                sec_sub_map[ss.section_id].append(ss)

        # Build solver model step by step to identify failing constraint
        model = cp_model.CpModel()
        X = {}
        X_theory = {}
        X_lab = {}
        Y = {}

        for s in sections:
            ss_list = sec_sub_map[s.id]
            for t in timeslots:
                for r in classrooms:
                    Y[(s.id, t.id, r.id)] = model.NewBoolVar(f"Y_{s.id}_{t.id}_{r.id}")

                for ss in ss_list:
                    sub = subjects_dict.get(ss.subject_id)
                    if not sub:
                        continue
                    x_var = model.NewBoolVar(f"X_{s.id}_{t.id}_{ss.subject_id}")
                    X[(s.id, t.id, ss.subject_id)] = x_var

                    if t.slot_type != "Break":
                        x_t = model.NewBoolVar(f"Xt_{s.id}_{t.id}_{ss.subject_id}")
                        x_l = model.NewBoolVar(f"Xl_{s.id}_{t.id}_{ss.subject_id}")
                        X_theory[(s.id, t.id, ss.subject_id)] = x_t
                        X_lab[(s.id, t.id, ss.subject_id)] = x_l
                        model.Add(x_var == x_t + x_l)
                    else:
                        model.Add(x_var == 0)

        # Pre-allocated slots
        for ps in pre_allocated_slots:
            if ps.section_id in sec_ids:
                if (ps.section_id, ps.timeslot_id, ps.subject_id) in X:
                    model.Add(X[(ps.section_id, ps.timeslot_id, ps.subject_id)] == 1)
                if ps.classroom_id and (ps.section_id, ps.timeslot_id, ps.classroom_id) in Y:
                    model.Add(Y[(ps.section_id, ps.timeslot_id, ps.classroom_id)] == 1)

        # Constraint 1 & 2: Section Overlap, Break Integrity, and Zero Free-Period
        for s in sections:
            active_slots = [t for t in timeslots if t.slot_type != "Break"]
            ss_list = sec_sub_map[s.id]
            for t in active_slots:
                vars_list = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list if (s.id, t.id, ss.subject_id) in X]
                if vars_list:
                    if s.enable_zero_free_periods:
                        model.Add(sum(vars_list) == 1)

        # Staff Overlap
        staff_timeslot_vars = defaultdict(list)
        for (s_id, t_id, sub_id), var in X.items():
            ss = next((x for x in section_subjects if x.section_id == s_id and x.subject_id == sub_id), None)
            if ss:
                staff_timeslot_vars[(ss.assigned_staff_id, t_id)].append(var)

        for (staff_id, t_id) in sorted(staff_timeslot_vars.keys()):
            vars_list = staff_timeslot_vars[(staff_id, t_id)]
            model.AddAtMostOne(vars_list)

        # Room Contention
        room_timeslot_vars = defaultdict(list)
        for (s_id, t_id, r_id), var in Y.items():
            room_timeslot_vars[(r_id, t_id)].append(var)

        for (r_id, t_id) in sorted(room_timeslot_vars.keys()):
            vars_list = room_timeslot_vars[(r_id, t_id)]
            model.AddAtMostOne(vars_list)

        # Physical Allocation
        for s in sections:
            regular_slots = [t for t in timeslots if t.slot_type == "Regular"]
            ss_list = sec_sub_map[s.id]
            for t in regular_slots:
                x_vars = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list]
                y_vars = [Y[(s.id, t.id, r.id)] for r in classrooms if (s.id, t.id, r.id) in Y]
                model.Add(sum(y_vars) == sum(x_vars))

        # Credit Hours Target
        for s in sections:
            ss_list = sec_sub_map[s.id]
            for ss in ss_list:
                sub = subjects_dict.get(ss.subject_id)
                if not sub:
                    continue
                possible_slots = [t for t in timeslots if t.slot_type != "Break"]
                theory_vars = [X_theory[(s.id, t.id, ss.subject_id)] for t in possible_slots if (s.id, t.id, ss.subject_id) in X_theory]
                lab_vars = [X_lab[(s.id, t.id, ss.subject_id)] for t in possible_slots if (s.id, t.id, ss.subject_id) in X_lab]
                
                num_pre = sum(1 for ps in pre_allocated_slots if ps.section_id == s.id and ps.subject_id == ss.subject_id)
                
                if sub.is_project:
                    model.Add(sum(theory_vars) == 3)
                    model.Add(sum(lab_vars) == 0)
                elif sub.credits == 2:
                    model.Add(sum(theory_vars) == 2)
                    model.Add(sum(lab_vars) == 0)
                elif sub.credits == 3:
                    model.Add(sum(theory_vars) == 3)
                    model.Add(sum(lab_vars) == 0)
                elif sub.credits == 4:
                    model.Add(sum(theory_vars) == 4)
                    model.Add(sum(lab_vars) == 0)
                else:
                    if num_pre > 0:
                        model.Add(sum(theory_vars) + sum(lab_vars) == sub.credits)
                    else:
                        model.Add(sum(theory_vars) == 3)
                        model.Add(sum(lab_vars) == 2)

        day_groups = defaultdict(list)
        for t in timeslots:
            if t.slot_type != "Break":
                day_groups[t.day_of_week].append(t)

        # Daily Coverage
        for s in sections:
            ss_list = sec_sub_map[s.id]
            for day in sorted(day_groups.keys()):
                slots = day_groups[day]
                for ss in ss_list:
                    sub = subjects_dict[ss.subject_id]
                    day_sub_vars = [X[(s.id, t.id, ss.subject_id)] for t in slots if (s.id, t.id, ss.subject_id) in X]
                    if not day_sub_vars:
                        continue

                    if not sub.is_project and sub.credits >= 5:
                        if s.enable_daily_coverage:
                            model.Add(sum(day_sub_vars) >= 1)
                        else:
                            if sub.credits <= len(day_groups):
                                model.AddAtMostOne(day_sub_vars)

        # Project Cadence
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
                        model.Add(sum(project_vars_on_day) == 1)
                    else:
                        model.Add(sum(project_vars_on_day) == 0)

        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 10.0
        status = solver.Solve(model)
        print("SOLVER STATUS:", solver.StatusName(status))

asyncio.run(debug_solver_run())
