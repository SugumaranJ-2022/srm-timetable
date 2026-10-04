import asyncio
from backend.app.core.database import AsyncSessionLocal
from sqlalchemy.future import select
from backend.app.models.models import Section, Subject, Staff, SectionSubject, TimeSlot, Classroom, PreAllocatedSlot
from ortools.sat.python import cp_model
from collections import defaultdict

async def find_failing():
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

        for disable_test in ['none', 'homeroom_z', 'y_link', 'room_contention', 'physical_alloc', 'project_cadence']:
            model = cp_model.CpModel()
            X = {}
            X_theory = {}
            X_lab = {}
            Y = {}
            Z = {}

            # 1. Z vars
            for s in sections:
                for r in classrooms:
                    Z[(s.id, r.id)] = model.NewBoolVar(f"Z_{s.id}_{r.id}")

            # 2. X and Y vars
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

            # Homeroom
            if disable_test != 'homeroom_z':
                for s in sections:
                    z_vars = [Z[(s.id, r.id)] for r in classrooms if (s.id, r.id) in Z]
                    if z_vars: model.Add(sum(z_vars) == 1)
                    if s.classroom_id is not None and (s.id, s.classroom_id) in Z:
                        model.Add(Z[(s.id, s.classroom_id)] == 1)

            # Y Link
            if disable_test != 'y_link':
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

            # Pre alloc
            for ps in pre_allocated_slots:
                if (ps.section_id, ps.timeslot_id, ps.subject_id) in X:
                    model.Add(X[(ps.section_id, ps.timeslot_id, ps.subject_id)] == 1)

            # Zero free
            for s in sections:
                active_slots = [t for t in timeslots if t.slot_type != "Break"]
                ss_list = sec_sub_map[s.id]
                for t in active_slots:
                    vars_list = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list if (s.id, t.id, ss.subject_id) in X]
                    if vars_list: model.Add(sum(vars_list) == 1)

            # Staff overlap
            staff_timeslot_vars = defaultdict(list)
            for (s_id, t_id, sub_id), var in X.items():
                ss = next((x for x in section_subjects if x.section_id == s_id and x.subject_id == sub_id), None)
                if ss: staff_timeslot_vars[(ss.assigned_staff_id, t_id)].append(var)
            for (staff_id, t_id), vars_list in staff_timeslot_vars.items():
                model.AddAtMostOne(vars_list)

            # Room contention
            if disable_test != 'room_contention':
                room_timeslot_vars = defaultdict(list)
                for (s_id, t_id, r_id), var in Y.items():
                    room_timeslot_vars[(r_id, t_id)].append(var)
                for (r_id, t_id), vars_list in room_timeslot_vars.items():
                    model.AddAtMostOne(vars_list)

            # Physical alloc
            if disable_test != 'physical_alloc':
                for s in sections:
                    regular_slots = [t for t in timeslots if t.slot_type == "Regular"]
                    ss_list = sec_sub_map[s.id]
                    for t in regular_slots:
                        x_vars = [X[(s.id, t.id, ss.subject_id)] for ss in ss_list]
                        y_vars = [Y[(s.id, t.id, r.id)] for r in classrooms if (s.id, t.id, r.id) in Y]
                        model.Add(sum(y_vars) == sum(x_vars))

            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 3.0
            st = solver.Solve(model)
            print(f"Test disable '{disable_test}': Status = {solver.StatusName(st)}")

if __name__ == "__main__":
    asyncio.run(find_failing())
