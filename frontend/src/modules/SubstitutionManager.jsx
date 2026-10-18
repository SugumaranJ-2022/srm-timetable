import React, { useState, useEffect } from 'react';
import { adminApi, timetableApi } from '../services/api';
import {
  UserCheck,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  MapPin,
  Users,
  BookOpen,
  Trash2,
  AlertCircle,
  Zap,
  Sparkles,
  Cpu,
  Layers,
  Award,
  Check,
  X
} from 'lucide-react';

const SubstitutionManager = () => {
  const [facultyList, setFacultyList] = useState([]);
  const [selectedFacultyId, setSelectedFacultyId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [teacherSchedule, setTeacherSchedule] = useState([]);
  const [substitutionsLog, setSubstitutionsLog] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Mapping for selected substitute candidate per period
  const [selectedSubstitutes, setSelectedSubstitutes] = useState({}); // { period_id: staff_id }

  // AI Smart Substitution State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);

  // Load baseline faculty list
  useEffect(() => {
    const loadFaculty = async () => {
      try {
        const staff = await adminApi.getStaff();
        setFacultyList(staff.filter(s => s.status === 'Active'));
      } catch (e) {
        console.error(e);
        setError('Failed to load faculty roster.');
      }
    };
    loadFaculty();
  }, []);

  // Fetch substitutions log for the selected date
  const loadSubstitutionsLog = async () => {
    setLoadingLog(true);
    try {
      const logs = await timetableApi.getSubstitutionsByDate(selectedDate);
      setSubstitutionsLog(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLog(false);
    }
  };

  useEffect(() => {
    loadSubstitutionsLog();
    if (selectedFacultyId) {
      fetchTeacherSchedule();
    } else {
      setTeacherSchedule([]);
    }
  }, [selectedDate]);

  // Fetch the selected teacher's schedule and substitute candidates
  const fetchTeacherSchedule = async (staffId = selectedFacultyId) => {
    if (!staffId) return;
    setLoadingSchedule(true);
    setError('');
    try {
      const schedule = await timetableApi.getTeacherScheduleForAbsence(staffId, selectedDate);
      setTeacherSchedule(schedule);
      
      // Clear selected substitutes state
      setSelectedSubstitutes({});
    } catch (e) {
      console.error(e);
      setError('Failed to retrieve teacher schedule details.');
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleFacultyChange = (e) => {
    const id = e.target.value;
    setSelectedFacultyId(id);
    if (id) {
      fetchTeacherSchedule(id);
    } else {
      setTeacherSchedule([]);
    }
  };

  // Assign a substitute to a period slot
  const handleAssignSubstitute = async (period) => {
    const subId = selectedSubstitutes[period.timetable_detail_id];
    if (!subId) {
      setError('Please select a substitute teacher first.');
      return;
    }
    
    setError('');
    setSuccessMsg('');
    try {
      await timetableApi.createSubstitution({
        date: selectedDate,
        timeslot_id: period.timeslot_id,
        original_staff_id: parseInt(selectedFacultyId),
        substitute_staff_id: parseInt(subId),
        timetable_detail_id: period.timetable_detail_id
      });
      
      setSuccessMsg('Substitute teacher assigned successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      
      // Refresh
      fetchTeacherSchedule();
      loadSubstitutionsLog();
    } catch (e) {
      console.error(e);
      setError(e.response?.data?.detail || 'Failed to assign substitute.');
    }
  };

  // Release/Cancel a substitution
  const handleCancelSubstitution = async (subId) => {
    setError('');
    setSuccessMsg('');
    try {
      await timetableApi.deleteSubstitution(subId);
      setSuccessMsg('Substitution record released successfully.');
      setTimeout(() => setSuccessMsg(''), 4000);
      
      // Refresh
      fetchTeacherSchedule();
      loadSubstitutionsLog();
    } catch (e) {
      console.error(e);
      setError('Failed to release substitution.');
    }
  };

  // Auto-Cover All: assign least-loaded candidate to every uncovered slot
  const handleAutoCoverAll = async () => {
    const uncoveredPeriods = teacherSchedule.filter(p => !p.is_substituted && p.candidates.length > 0);
    if (uncoveredPeriods.length === 0) {
      setError('No uncovered slots with available candidates.');
      return;
    }

    setError('');
    setSuccessMsg('');
    let assigned = 0;
    for (const period of uncoveredPeriods) {
      // Pick the candidate with the lowest sub_count (workload-balanced)
      const best = [...period.candidates].sort((a, b) => (a.sub_count || 0) - (b.sub_count || 0))[0];
      if (!best) continue;
      try {
        await timetableApi.createSubstitution({
          date: selectedDate,
          timeslot_id: period.timeslot_id,
          original_staff_id: parseInt(selectedFacultyId),
          substitute_staff_id: best.id,
          timetable_detail_id: period.timetable_detail_id
        });
        assigned++;
      } catch (e) {
        console.error('Auto-assign error for period', period.period_number, e);
      }
    }
    setSuccessMsg(`Auto-covered ${assigned} slot${assigned !== 1 ? 's' : ''} successfully.`);
    setTimeout(() => setSuccessMsg(''), 5000);
    fetchTeacherSchedule();
    loadSubstitutionsLog();
  };

  // Run AI Optimization simulation
  const handleRunAiOptimization = async () => {
    if (!selectedFacultyId) {
      setError('Please select an absent faculty member first.');
      return;
    }
    setAiLoading(true);
    setError('');
    try {
      const data = await timetableApi.aiAutoSubstitute(parseInt(selectedFacultyId), selectedDate, false);
      setAiResult(data);
      setAiModalOpen(true);
    } catch (err) {
      console.error('AI Optimization error:', err);
      setError(err.response?.data?.detail || 'AI Optimization failed to evaluate substitute candidates.');
    } finally {
      setAiLoading(false);
    }
  };

  // 1-Click apply AI matches
  const handleApplyAiMatches = async () => {
    setAiLoading(true);
    try {
      const data = await timetableApi.aiAutoSubstitute(parseInt(selectedFacultyId), selectedDate, true);
      setSuccessMsg(`AI Auto-Assigned ${data.auto_assigned_count || 0} period(s) with workload rebalancing!`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setAiModalOpen(false);
      fetchTeacherSchedule();
      loadSubstitutionsLog();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to apply AI substitutions.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Status Toasts */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-green-550/15 border border-green-500/30 p-4 rounded-2xl text-green-700 dark:text-green-300 text-xs font-bold animate-fade-in">
          <CheckCircle className="w-4 h-4 text-green-550 shrink-0" />
          {successMsg}
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 p-4 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Control Panel Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Controls */}
        <div className="glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-glass flex flex-col gap-4 self-start">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800/80">
            <UserCheck className="w-4 h-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Absence Reporter</h3>
          </div>

          {/* Date Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Absence Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-xs bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white"
              />
            </div>
          </div>

          {/* Teacher Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Absent Faculty Member</label>
            <select
              value={selectedFacultyId}
              onChange={handleFacultyChange}
              className="w-full px-3 py-2 text-xs bg-slate-100/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 dark:text-white cursor-pointer"
            >
              <option value="">-- Choose Instructor --</option>
              {facultyList.map(fac => (
                <option key={fac.id} value={fac.id}>{fac.name}</option>
              ))}
            </select>
          </div>

          {selectedFacultyId && (
            <div className="p-3 rounded-xl bg-slate-100/30 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/40 text-[10px] text-slate-450 dark:text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700 dark:text-slate-350 block mb-0.5">Absence Policy</span>
              Marking an instructor absent loads their timetabled lectures for the date. You can assign coverage classes slot-by-slot from available recommended substitute candidates.
            </div>
          )}
        </div>

        {/* Right Side: Schedule & Candidates */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 shadow-glass flex flex-col min-h-[300px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Affected Periods schedule</h3>
            </div>
            {selectedFacultyId && (
              <span className="text-[10px] bg-red-500/10 text-red-650 dark:text-red-300 font-bold border border-red-500/20 px-2 py-0.5 rounded-full animate-pulse uppercase tracking-wider">
                Marked Absent
              </span>
            )}
          </div>

          {loadingSchedule ? (
            <div className="flex-1 flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-brand-500/20 border-t-brand-500" />
            </div>
          ) : !selectedFacultyId ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 space-y-2 text-slate-400">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-750" />
              <p className="text-xs font-bold">No instructor selected</p>
              <p className="text-[10px] text-slate-450 max-w-xs">Select an absent instructor on the left panel to review their teaching details and schedule substitute coverages.</p>
            </div>
          ) : teacherSchedule.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center p-8 space-y-2 text-slate-400">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">No Lectures Scheduled Today</p>
              <p className="text-[10px] text-slate-450">This instructor has a free schedule on this day of the week.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* AI & Quick Coverage Buttons */}
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <button
                  onClick={handleRunAiOptimization}
                  disabled={aiLoading}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 via-brand-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black tracking-wide uppercase shadow-lg shadow-brand-500/25 cursor-pointer active:scale-95 transition-all"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : 'animate-pulse text-amber-300'}`} />
                  {aiLoading ? 'Optimizing AI Weights...' : 'AI Smart Auto-Match & Rebalance'}
                </button>

                {teacherSchedule.some(p => !p.is_substituted && p.candidates.length > 0) && (
                  <button
                    onClick={handleAutoCoverAll}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-[10px] font-bold hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer active:scale-95 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500" />
                    Quick Auto-Cover
                  </button>
                )}
              </div>
              {teacherSchedule.map(period => (
                <div
                  key={period.timetable_detail_id}
                  className={`border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
                    period.is_substituted
                      ? 'bg-green-500/5 border-green-550/20'
                      : 'bg-slate-100/30 dark:bg-slate-900/10 border-slate-200 dark:border-slate-850'
                  }`}
                >
                  {/* Left: Session details */}
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-500 font-black text-xs flex items-center justify-center shrink-0">
                      H{period.period_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-white">{period.subject_name}</span>
                        <span className="text-[9px] font-bold text-slate-400 font-mono bg-slate-200/50 dark:bg-slate-800 px-1 py-0.2 rounded">{period.subject_code}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                        <span>Sec: <span className="font-bold text-slate-750 dark:text-slate-300">{period.section_name}</span></span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3 text-slate-400" />{period.room_number}</span>
                        <span>•</span>
                        <span>Time: {period.time_range}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions / Sub candidates dropdown */}
                  <div className="flex items-center gap-2 shrink-0 md:justify-end">
                    {period.is_substituted ? (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[9px] font-extrabold text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded uppercase block w-max ml-auto">COVERED</span>
                          <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 mt-1 block">Cover: {period.substitute_staff_name}</span>
                        </div>
                        <button
                          onClick={() => handleCancelSubstitution(period.substitution_id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl border border-red-500/10 hover:border-red-500/35 transition-all cursor-pointer"
                          title="Release Substitution Cover"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        {period.candidates.length > 0 ? (
                          <>
                            <select
                              value={selectedSubstitutes[period.timetable_detail_id] || ''}
                              onChange={(e) => setSelectedSubstitutes(prev => ({
                                ...prev,
                                [period.timetable_detail_id]: e.target.value
                              }))}
                              className="px-2.5 py-1.5 text-[10.5px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer max-w-[200px]"
                            >
                              <option value="">-- Available Substitute --</option>
                              {period.candidates.map(cand => (
                                <option key={cand.id} value={cand.id}>
                                  {cand.name} (Covers: {cand.sub_count || 0})
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleAssignSubstitute(period)}
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-[10px] font-bold shadow-md hover:shadow-brand-500/15 cursor-pointer active:scale-95 transition-all whitespace-nowrap"
                            >
                              Assign Cover
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/15 px-2.5 py-1 rounded-xl text-amber-600 dark:text-amber-400 text-[10px] font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            No Available Substitute (Conflict / Competency)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Substitution Log (Selected Date) */}
      <div className="glass-card p-6 rounded-3xl border border-slate-250 dark:border-slate-800/60 shadow-glass">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800/80 mb-5">
          <BookOpen className="w-4 h-4 text-brand-500" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Substitution Coverage Log</h3>
          <span className="ml-auto text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
            Date: {selectedDate}
          </span>
        </div>

        {loadingLog ? (
          <div className="flex justify-center items-center py-10">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-brand-500/20 border-t-brand-500" />
          </div>
        ) : substitutionsLog.length === 0 ? (
          <div className="text-center py-8 text-slate-450 dark:text-slate-500 text-xs">No active substitutions logged for this date.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 font-semibold">Class Section</th>
                  <th className="pb-3 font-semibold">Subject / Code</th>
                  <th className="pb-3 font-semibold">Room</th>
                  <th className="pb-3 font-semibold">Absent Instructor</th>
                  <th className="pb-3 font-semibold">Substitute Cover</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/40">
                {substitutionsLog.map(log => (
                  <tr key={log.id} className="text-slate-700 dark:text-slate-350 hover:bg-slate-50/50 dark:hover:bg-slate-800/5">
                    <td className="py-3 font-semibold">{log.section_name}</td>
                    <td className="py-3">
                      <span className="font-semibold">{log.subject_name}</span>
                      <span className="ml-1 text-[9px] font-bold text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/55 px-1 py-0.1 rounded">{log.subject_code}</span>
                    </td>
                    <td className="py-3 font-semibold">{log.room_number}</td>
                    <td className="py-3 text-red-500 font-medium">{log.original_staff_name}</td>
                    <td className="py-3 text-green-600 dark:text-green-400 font-bold">{log.substitute_staff_name}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleCancelSubstitution(log.id)}
                        className="px-2 py-1 bg-red-500/10 hover:bg-red-500/15 border border-red-550/15 text-red-650 dark:text-red-400 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Smart Substitution Optimization Modal */}
      {aiModalOpen && aiResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-brand-600 to-indigo-600 rounded-2xl text-white shadow-md shadow-brand-500/20">
                  <Cpu className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                    AI Smart Substitution Engine
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-mono font-bold border border-brand-500/20">
                      Multi-Constraint V2.4
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Target: <span className="font-bold text-slate-700 dark:text-slate-300">{aiResult.absent_faculty_name}</span> | Date: <span className="font-mono text-slate-700 dark:text-slate-300">{selectedDate}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAiModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* AI Optimization Criteria Banner */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-brand-500/10 via-purple-500/10 to-indigo-500/10 border border-brand-500/20 text-xs space-y-1.5">
              <div className="font-bold text-brand-600 dark:text-brand-300 flex items-center gap-1.5 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Algorithmic Objective Breakdown:
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-950/40 border border-brand-500/15">
                  <span className="text-slate-400 block">Subject Fit</span>
                  <span className="font-bold text-slate-900 dark:text-white">+40 pts (Specialist)</span>
                </div>
                <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-950/40 border border-brand-500/15">
                  <span className="text-slate-400 block">Workload Balance</span>
                  <span className="font-bold text-slate-900 dark:text-white">+35 pts (Min Loads)</span>
                </div>
                <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-950/40 border border-brand-500/15">
                  <span className="text-slate-400 block">Department Align</span>
                  <span className="font-bold text-slate-900 dark:text-white">+15 pts (Same Dept)</span>
                </div>
                <div className="p-2 rounded-xl bg-white/60 dark:bg-slate-950/40 border border-brand-500/15">
                  <span className="text-slate-400 block">Conflict Shield</span>
                  <span className="font-bold text-emerald-500">100% Slot Safe</span>
                </div>
              </div>
            </div>

            {/* Recommendations List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {aiResult.recommendations && aiResult.recommendations.length > 0 ? (
                aiResult.recommendations.map((rec, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-brand-600 dark:text-brand-400 font-mono">
                          Period {rec.period_number}
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {rec.subject_name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">({rec.section_name})</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Room: {rec.room_number || 'Designated Class'}
                      </div>
                    </div>

                    {rec.selected_candidate ? (
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center justify-end gap-1">
                            <Award className="w-3.5 h-3.5 text-amber-400" />
                            {rec.selected_candidate.name}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1.5 mt-0.5">
                            <span className="px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded font-bold font-mono">
                              {rec.selected_candidate.score}% Match
                            </span>
                            <span>{rec.selected_candidate.reason}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded-lg">
                        No free faculty candidate
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No affected periods for this instructor today.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
              <div className="text-xs text-slate-400">
                Coverage: <span className="font-bold text-emerald-500">{aiResult.coverage_rate || '100%'}</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyAiMatches}
                  disabled={aiLoading || !aiResult.recommendations?.some(r => r.selected_candidate)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white text-xs font-black tracking-wide uppercase transition-all shadow-md hover:shadow-brand-500/25 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 text-emerald-300" />
                  {aiLoading ? 'Auto-Assigning...' : '1-Click Auto-Assign All Matches'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubstitutionManager;
