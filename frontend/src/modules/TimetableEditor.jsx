import React, { useState, useEffect } from 'react';
import { adminApi, timetableApi } from '../services/api';
import TimetableGrid from '../components/TimetableGrid';
import { 
  Sparkles, 
  Save, 
  HelpCircle, 
  AlertTriangle, 
  CheckCircle
} from 'lucide-react';

const TimetableEditor = () => {
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-27');
  const [semester, setSemester] = useState(1);

  // Loaded Timetable details
  const [timetable, setTimetable] = useState(null);
  const [timeslots, setTimeslots] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [classroomsList, setClassroomsList] = useState([]);

  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [generationLog, setGenerationLog] = useState('');
  const [generationMetrics, setGenerationMetrics] = useState(null);

  // Manual Override States
  const [draftDetails, setDraftDetails] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [activeCellEdit, setActiveCellEdit] = useState(null); // { day, periodNum, timeslotId, detail, timeslotObj }
  const [isDirty, setIsDirty] = useState(false);

  // Form selections for editing single cell
  const [selectedSubId, setSelectedSubId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');

  // Initial load
  useEffect(() => {
    const loadBasics = async () => {
      try {
        const [secs, staff, subs, rooms] = await Promise.all([
          adminApi.getSections(),
          adminApi.getStaff(),
          adminApi.getSubjects(),
          adminApi.getClassrooms()
        ]);
        setSections(secs);
        setStaffList(staff);
        setSubjectsList(subs);
        setClassroomsList(rooms);
      } catch (e) {
        console.error(e);
        setError('Failed to load sections metadata.');
      }
    };
    loadBasics();
  }, []);

  // Fetch timetable for selected section
  const fetchSectionTimetable = async (sectionId) => {
    if (!sectionId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setConflicts([]);
    setIsDirty(false);
    try {
      const tt = await timetableApi.getSectionTimetable(sectionId);
      setTimetable(tt);
      setDraftDetails(tt.details);

      // Timeslots are constructed manually
      const baselineSlots = [];
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
      const slotTypes = {
        1: 'Regular', 2: 'Regular', 3: 'Regular',
        4: 'Break',
        5: 'Regular', 6: 'Regular'
      };
      const periodTimes = {
        1: { start: '08:15:00', end: '09:00:00' },
        2: { start: '09:00:00', end: '09:45:00' },
        3: { start: '09:45:00', end: '10:30:00' },
        4: { start: '10:30:00', end: '11:00:00' },
        5: { start: '11:00:00', end: '11:45:00' },
        6: { start: '11:45:00', end: '12:30:00' }
      };
      
      let currentId = 1;
      days.forEach(day => {
        for (let p = 1; p <= 6; p++) {
          baselineSlots.push({
            id: currentId++,
            day_of_week: day,
            period_number: p,
            start_time: periodTimes[p].start,
            end_time: periodTimes[p].end,
            slot_type: slotTypes[p]
          });
        }
      });
      setTimeslots(baselineSlots);

    } catch (err) {
      console.error(err);
      setError('No active timetable generated yet for this section. Click auto-generate.');
      setTimetable(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSectionId) {
      fetchSectionTimetable(selectedSectionId);
    }
  }, [selectedSectionId]);

  // Trigger CP-SAT Algorithmic Generation
  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    setGenerationLog('Connecting to OR-Tools CSP Engine...');
    try {
      const res = await timetableApi.generate(academicYear, semester);
      setSuccess(res.message);
      setGenerationMetrics(res.metrics);
      setGenerationLog('Solver solved successfully. Timetables saved.');
      if (selectedSectionId) {
        fetchSectionTimetable(selectedSectionId);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Timetable optimization solver failed.');
      setGenerationLog('Constraint checking failed: Infeasible resource limit.');
    } finally {
      setLoading(false);
    }
  };

  // Perform Dry-run override validation check
  const runDryRunValidation = async (proposedDetails) => {
    if (!timetable) return;
    try {
      const valReq = proposedDetails.map(d => ({
        timeslot_id: d.timeslot_id,
        subject_id: d.subject_id,
        staff_id: d.staff_id,
        classroom_id: d.classroom_id
      }));

      const res = await timetableApi.validateOverride(timetable.id, valReq);
      setConflicts(res.conflicts);
      if (!res.is_valid) {
        setError('Dry-run check: Conflict warning flags raised.');
      } else {
        setError('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Cell Interaction click - opens Modal
  const handleCellClick = ({ day, periodNum, timeslotId, detail, timeslotObj }) => {
    setActiveCellEdit({ day, periodNum, timeslotId, detail, timeslotObj });
    if (detail) {
      setSelectedSubId(detail.subject_id);
      setSelectedStaffId(detail.staff_id);
      setSelectedRoomId(detail.classroom_id || '');
    } else {
      setSelectedSubId('');
      setSelectedStaffId('');
      setSelectedRoomId('');
    }
  };

  // Apply cell changes to local draft details and trigger dry-run check
  const handleApplyCellEdit = (e) => {
    e.preventDefault();
    if (!activeCellEdit) return;

    const { timeslotId } = activeCellEdit;
    
    // Find subject name & code for UI rendering
    const subObj = subjectsList.find(s => s.id === parseInt(selectedSubId));
    const staffObj = staffList.find(s => s.id === parseInt(selectedStaffId));
    const roomObj = classroomsList.find(r => r.id === parseInt(selectedRoomId));

    let updated = [...draftDetails];
    const existingIndex = updated.findIndex(d => d.timeslot_id === timeslotId);

    if (!selectedSubId) {
      // If no subject selected, delete class mapping
      if (existingIndex > -1) {
        updated.splice(existingIndex, 1);
      }
    } else {
      const newItem = {
        id: activeCellEdit.detail?.id || Math.random(), // temp id
        timeslot_id: timeslotId,
        subject_id: parseInt(selectedSubId),
        staff_id: parseInt(selectedStaffId),
        classroom_id: selectedRoomId ? parseInt(selectedRoomId) : null,
        subject_name: subObj ? subObj.name : 'Unknown',
        subject_code: subObj ? subObj.code : '',
        staff_name: staffObj ? staffObj.name : 'Unknown',
        room_number: roomObj ? roomObj.room_number : 'Online'
      };

      if (existingIndex > -1) {
        updated[existingIndex] = newItem;
      } else {
        updated.push(newItem);
      }
    }

    setDraftDetails(updated);
    setIsDirty(true);
    setActiveCellEdit(null);
    
    // Trigger validation on local proposed copy
    runDryRunValidation(updated);
  };

  // Save changes to DB
  const handleSaveOverrides = async () => {
    if (!timetable) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const valReq = draftDetails.map(d => ({
        timeslot_id: d.timeslot_id,
        subject_id: d.subject_id,
        staff_id: d.staff_id,
        classroom_id: d.classroom_id
      }));
      const res = await timetableApi.saveOverride(timetable.id, valReq);
      setSuccess(res.message);
      setIsDirty(false);
      fetchSectionTimetable(selectedSectionId);
    } catch (err) {
      setError(err.response?.data?.detail?.message || 'Failed to save timetable overrides.');
      if (err.response?.data?.detail?.conflicts) {
        setConflicts(err.response.data.detail.conflicts);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Title */}
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Interactive Timetable Editor</h2>
        <p className="text-slate-550 dark:text-slate-400 mt-1 text-sm md:text-base">Configure parameters, run CP-SAT algorithms, and drag-and-drop cell blocks manually.</p>
      </div>

      {/* Setup Config Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 glass-panel p-6 rounded-3xl items-end border border-slate-200 dark:border-slate-800">
        <div>
          <label className="block text-xs font-semibold text-slate-650 dark:text-slate-400 mb-1.5">Academic Year</label>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          >
            <option value="2026-27">2026 - 2027</option>
            <option value="2027-28">2027 - 2028</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-650 dark:text-slate-400 mb-1.5">Target Semester</label>
          <input
            type="number"
            value={semester}
            onChange={(e) => setSemester(parseInt(e.target.value))}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          />
        </div>

        <div>
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all text-sm shadow-md"
          >
            <Sparkles className="w-4.5 h-4.5 animate-pulse" />
            Auto-Solve Grid
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-650 dark:text-slate-400 mb-1.5">View Section</label>
          <select
            value={selectedSectionId}
            onChange={(e) => setSelectedSectionId(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
          >
            <option value="">Select Section</option>
            {sections.map(s => (
              <option key={s.id} value={s.id}>{s.name} (Sem {s.semester})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Logging output */}
      {generationLog && (
        <div className="p-3 bg-slate-200/40 dark:bg-slate-950/40 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] font-mono text-slate-550 dark:text-slate-400 max-h-24 overflow-y-auto">
          {generationLog}
        </div>
      )}

      {/* Solver Constraint Compliance Metrics Panel */}
      {generationMetrics && (
        <div className="glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 animate-fade-in">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
            <Sparkles className="w-4.5 h-4.5 text-brand-500 dark:text-brand-400" />
            Solver Compliance Metrics
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-100/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/60 p-4 rounded-2xl text-center">
              <div className="text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider">Zero Free Period</div>
              <div className="text-lg font-extrabold text-green-600 dark:text-green-400 mt-1">
                {generationMetrics.zero_free_period_compliance} / 13
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Sections compliant</div>
            </div>
            <div className="bg-slate-100/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/60 p-4 rounded-2xl text-center">
              <div className="text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider">Project Cadence</div>
              <div className="text-lg font-extrabold text-brand-600 dark:text-brand-400 mt-1">
                {generationMetrics.project_cadence_compliance} / 13
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Sections compliant</div>
            </div>
            <div className="bg-slate-100/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/60 p-4 rounded-2xl text-center">
              <div className="text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider">Daily Coverage</div>
              <div className="text-lg font-extrabold text-brand-600 dark:text-brand-400 mt-1">
                {generationMetrics.daily_coverage_compliance} / 13
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Sections compliant</div>
            </div>
            <div className="bg-slate-100/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/60 p-4 rounded-2xl text-center">
              <div className="text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider">Max Load/Day</div>
              <div className="text-lg font-extrabold text-yellow-600 dark:text-yellow-500 mt-1">
                {generationMetrics.max_daily_staff_load} periods
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Per staff member</div>
            </div>
            <div className="bg-slate-100/50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-800/60 p-4 rounded-2xl text-center col-span-1 sm:col-span-2 md:col-span-1">
              <div className="text-[10px] text-slate-550 dark:text-slate-400 font-bold uppercase tracking-wider">Staff Idle Gaps</div>
              <div className="text-lg font-extrabold text-green-600 dark:text-green-400 mt-1">
                {generationMetrics.total_staff_idle_gaps}
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5">Gaps minimized</div>
            </div>
          </div>
        </div>
      )}

      {/* Errors / Warnings / Conflicts Alert Area */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 flex flex-col gap-2 text-red-650 dark:text-red-400 text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          {conflicts.length > 0 && (
            <ul className="list-disc pl-8 mt-2 space-y-1 text-xs text-red-700 dark:text-red-300">
              {conflicts.map((c, idx) => (
                <li key={idx}>{c.description}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/30 flex items-center gap-3 text-green-700 dark:text-green-400 text-sm">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Actions (Save draft overrides) */}
      {isDirty && (
        <div className="flex flex-col sm:flex-row justify-end gap-3 p-4 bg-brand-500/5 dark:bg-brand-950/10 border border-brand-500/20 rounded-2xl animate-fade-in">
          <div className="text-xs text-brand-700 dark:text-brand-300 font-medium self-center mb-2 sm:mb-0 text-center sm:text-left">
            You have unsaved overrides. Please review dry-run alerts before saving.
          </div>
          <button
            onClick={handleSaveOverrides}
            disabled={loading || conflicts.length > 0}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs transition-all shadow-md w-full sm:w-auto"
          >
            <Save className="w-4 h-4" />
            Save Overrides (v{timetable?.version ? timetable.version + 1 : 2})
          </button>
        </div>
      )}

      {/* Main Grid View */}
      {selectedSectionId && timetable ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="text-md font-bold text-slate-800 dark:text-slate-200">
              Timetable Schedule for Section: <span className="text-brand-600 dark:text-brand-400 font-extrabold">{sections.find(s => s.id === parseInt(selectedSectionId))?.name}</span>
            </h3>
            <span className="text-xs text-slate-500">
              Version: {timetable.version} | Active status
            </span>
          </div>
          
          <TimetableGrid
            details={draftDetails}
            timeslots={timeslots}
            isEditable={true}
            onCellClick={handleCellClick}
            conflicts={conflicts}
            projectDays={
              sections.find(s => s.id === parseInt(selectedSectionId))?.project_days
                ? sections.find(s => s.id === parseInt(selectedSectionId)).project_days.split(',')
                : ['Monday', 'Wednesday', 'Friday']
            }
          />
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-500 flex flex-col items-center justify-center gap-3">
          <HelpCircle className="w-8 h-8 text-slate-400" />
          <span className="text-slate-650 dark:text-slate-450">Select a Section to load the timetable matrix, or click "Auto-Solve Grid" to generate.</span>
        </div>
      )}

      {/* Cell Editor Modal */}
      {activeCellEdit && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="glass-panel p-6 md:p-8 rounded-3xl w-full max-w-md border border-slate-200 dark:border-slate-800 space-y-6 animate-scale-in">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-wide">
                Edit Slot Schedule
              </h3>
              <p className="text-xs text-slate-550 dark:text-slate-400 mt-1">
                {activeCellEdit.day} - Period {activeCellEdit.periodNum} ({activeCellEdit.timeslotObj?.slot_type} Slot)
              </p>
            </div>

            <form onSubmit={handleApplyCellEdit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Subject</label>
                <select
                  value={selectedSubId}
                  onChange={(e) => setSelectedSubId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                >
                  <option value="">-- Free Slot (Clear) --</option>
                  {subjectsList.map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              {selectedSubId && (
                <>
                  <div>
                    <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Faculty Member</label>
                    <select
                      required
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                    >
                      <option value="">Select Instructor</option>
                      {staffList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {activeCellEdit.timeslotObj?.slot_type === 'Regular' && (
                    <div>
                      <label className="block text-xs text-slate-650 dark:text-slate-400 mb-1">Classroom Room</label>
                      <select
                        required
                        value={selectedRoomId}
                        onChange={(e) => setSelectedRoomId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                      >
                        <option value="">Select Room</option>
                        {classroomsList.map(r => (
                          <option key={r.id} value={r.id}>{r.room_number} (Cap: {r.capacity})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveCellEdit(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs transition-all shadow-md"
                >
                  Apply Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableEditor;
