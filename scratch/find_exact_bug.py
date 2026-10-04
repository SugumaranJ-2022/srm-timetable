import asyncio
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy.future import select
from backend.app.models.models import Section, Subject, Staff, SectionSubject, TimeSlot, Classroom, PreAllocatedSlot
from ortools.sat.python import cp_model
from collections import defaultdict

async def test_all_constraints():
    async with AsyncSessionLocal() as db:
        res_sec = await db.execute(select(Section).where(Section.semester == 1))
        sections = res_sec.scalars().all()
        section_ids = {s.id for s in sections}
        
        res_ss = await db.execute(select(SectionSubject))
        section_subjects = [ss for ss in res_ss.scalars().all() if ss.section_id in section_ids]

        res_ts = await db.execute(select(TimeSlot))
        timeslots = res_ts.scalars().all()

        res_cr = await db.execute(select(Classroom).where(Classroom.is_available == True))
        classrooms = res_cr.scalars().all()

        res_sub = await db.execute(select(Subject))
        subjects_dict = {sub.id: sub for sub in res_sub.scalars().all()}

        res_pre = await db.execute(select(PreAllocatedSlot).where(PreAllocatedSlot.section_id.in_(section_ids)))
        pre_allocated_slots = res_pre.scalars().all()

        sec_sub_map = defaultdict(list)
        for ss in section_subjects:
            sec_sub_map[ss.section_id].append(ss)

        fsh1_labs = [r.id for r in classrooms if "lab" in r.room_number.lower() or "lab" in r.building.lower()]
        fsh2_labs = fsh1_labs

        # We will test disabling each constraint group one by one
        tests = [
            'homeroom_z',
            'y_link',
            'pre_alloc',
            'zero_free',
            'staff_overlap',
            'room_contention',
            'physical_alloc',
            'credit_hours_target',
            'daily_coverage',
            'project_cadence'
        ]

        for skip in tests:
            model = cp_model.CpModel()
            X = {}
            X_theory = {}
            X_lab = {}
            Y = {}
            Z = {}

            for s in sections:
                for r in classrooms:
                    Z[(s.id, r.id)] = model.NewBoolVar(f"Z_{s.id}_{r.id}")

            for s in sections:
                ss_list = sec_sub_map[s.id]
                for t in timeslots:
                    for r in classrooms:
                        Y[(s.id, t.id, r.id)] = model.NewBoolVar(f"Y_{s.id}_{t.id}_{r.id}")

                    for ss in ss_list:
                        sub = subjects_dict.get(ss.subject_id)
                        if not sub: continue
                        x_var = model.NewBoolVar(f"X_{s.id}_{t.id}_{ss.subject_id}")
                        X[(s.id, t.id, ss.subject_id)] = x_var

                        if t.slot_type != "Break":
                            x_t = model.NewBoolVar(f"Xt_{s.id}_{t.id}_{ss.subject_id}")
                            x_l = model.NewBoolVar(f"Xl_{s.id}_{t.id}_{ss.subject_id}")
                            X_theory[(s.id, t.id, ss.subject_id)] = x_t
                            X_lab[(s.id, t.id, ss.subject_id)] = x_l
                            model.Add(x_var == x_t + x_l)

            # 1. Homeroom Z
            if skip != 'homeroom_z':
                for s in sections:
                    z_vars = [Z[(s.id, r.id)] for r in classrooms if (s.id, r.id) in Z]
                    if z_vars: model.Add(sum(z_vars) == 1)
                    if s.classroom_id is not None and (s.id, s.classroom_id) in Z:
                        model.Add(Z[(s.id, s.classroom_id)] == 1)
                unique_rooms = len(classrooms) >= len(sections)
                for r in classrooms:
                    z_vars = [Z[(s.id, r.id)] for s in sections if (s.id, r.id) in Z]
                    if z_vars and unique_rooms:
                        model.Add(sum(z_vars) <= 1)

            # 2. Y link
            if skip != 'y_link':
                for s in sections:
                    s_lab_room_ids = fsh1_labs or [r.id for r in classrooms]
                    active_slots = [t for t in timeslots if t.slot_type == "Regular"]
                    ss_list = sec_sub_map[s.id]
                    for t in active_slots:
                        pre_room_id = next((ps.classroom_id for ps in pre_allocated_slots if ps.section_id == s.id and ps.timeslot_id == t.id and ps.classroom_id is not None), None)
                        for ss in ss_list:
                            x_theory_var = X_theory[(s.id, t.id, ss.subject_id)]
                            x_lab_var = X_lab[(s.id, t.id, ss.subject_id)]
                            for r in classrooms:
                                if (s.id, t.id, r.id) in Y:
                                    if pre_room_id is not None:
                                        if r.id == pre_room_id:
                                            model.Add(Y[(s.id, t.id, r.id)] == 1).OnlyEnforceIf(x_theory_var)
                                        else:
                                            model.Add(Y[(s.id, t.id, r.id)] == 0).OnlyEnforceIf(x_theory_var)
                                    elif (s.id, r.id) in Z:
                                        model.Add(Y[(s.id, t.id, r.id)] == Z[(s.id, r.id)]).OnlyEnforceIf(x_theory_var)

                            for r in classrooms:
                                if (s.id, t.id, r.id) in Y:
                                    if r.id not in s_lab_room_ids:
                                        model.Add(Y[(s.id, t.id, r.id)] == 0).OnlyEnforceIf(x_lab_var)

                            lab_y_vars = [Y[(s.id, t.id, r_id)] for r_id in s_lab_room_ids if (s.id, t.id, r_id) in Y]
                            if lab_y_vars:
                                model.Add(sum(lab_y_vars) == 1).OnlyEnforceIf(x_lab_var)

            # 3. Pre alloc
            if skip != 'pre_alloc':
                for ps in pre_allocated_slots:
                    if (ps.section_id, ps.timeslot_id, ps.subject_id) in X:
                        model.Add(X[(ps.section_id, ps.timeslot_id, ps.subject_id)] == 1)

            # 4. Zero free
            if skip != 'zero_free':
                for s in sections:
                    active_slots = [t for t in timeslots if t.slot_type != "Break"]
                    ss_list = sec_sub_map[s.id]
                    for t in active_slots:
                        vars_list = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list if (s.id, t.id, ss.subject_id) in X]
                        if vars_list: model.Add(sum(vars_list) == 1)

            # 5. Staff overlap
            if skip != 'staff_overlap':
                staff_timeslot_vars = defaultdict(list)
                for (s_id, t_id, sub_id), var in X.items():
                    ss = next((x for x in section_subjects if x.section_id == s_id and x.subject_id == sub_id), None)
                    if ss: staff_timeslot_vars[(ss.assigned_staff_id, t_id)].append(var)
                for (staff_id, t_id), vars_list in staff_timeslot_vars.items():
                    model.AddAtMostOne(vars_list)

            # 6. Room contention
            if skip != 'room_contention':
                room_timeslot_vars = defaultdict(list)
                for (s_id, t_id, r_id), var in Y.items():
                    room_timeslot_vars[(r_id, t_id)].append(var)
                for (r_id, t_id), vars_list in room_timeslot_vars.items():
                    model.AddAtMostOne(vars_list)

            # 7. Physical alloc
            if skip != 'physical_alloc':
                for s in sections:
                    regular_slots = [t for t in timeslots if t.slot_type == "Regular"]
                    ss_list = sec_sub_map[s.id]
                    for t in regular_slots:
                        x_vars = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list]
                        y_vars = [Y[(s.id, t.id, r.id)] for r in classrooms if (s.id, t.id, r.id) in Y]
                        model.Add(sum(y_vars) == sum(x_vars))

            # 8. Credit hours target
            if skip != 'credit_hours_target':
                for s in sections:
                    ss_list = sec_sub_map[s.id]
                    sec_pre_slots = [ps for ps in pre_allocated_slots if ps.section_id == s.id]
                    num_sec_pre = len(sec_pre_slots)
                    free_slots_remaining = max(0, 25 - num_sec_pre)
                    pre_sub_ids = {ps.subject_id for ps in sec_pre_slots}
                    regular_ss_list = [ss for ss in ss_list if ss.subject_id not in pre_sub_ids]
                    total_reg_credits = sum(subjects_dict[ss.subject_id].credits for ss in regular_ss_list if ss.subject_id in subjects_dict)

                    targets = {}
                    if s.enable_zero_free_periods and regular_ss_list and free_slots_remaining > 0:
                        allocated = 0
                        for idx, ss in enumerate(regular_ss_list):
                            sub = subjects_dict.get(ss.subject_id)
                            if not sub: continue
                            if idx == len(regular_ss_list) - 1:
                                tgt = max(1, free_slots_remaining - allocated)
                            else:
                                prop = sub.credits / total_reg_credits if total_reg_credits > 0 else 1.0 / len(regular_ss_list)
                                tgt = max(1, int(round(prop * free_slots_remaining)))
                                allocated += tgt
                            targets[ss.subject_id] = tgt
                    else:
                        for ss in regular_ss_list:
                            sub = subjects_dict.get(ss.subject_id)
                            if sub: targets[ss.subject_id] = sub.credits

                    for ss in ss_list:
                        sub = subjects_dict.get(ss.subject_id)
                        if not sub: continue
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

            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 1.0
            st = solver.Solve(model)
            print(f"Skipping '{skip}': Status = {solver.StatusName(st)}")

if __name__ == "__main__":
    asyncio.run(test_all_constraints())
