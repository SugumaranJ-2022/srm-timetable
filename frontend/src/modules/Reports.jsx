import React, { useState, useEffect } from 'react';
import { adminApi, timetableApi } from '../services/api';
import TimetableGrid from '../components/TimetableGrid';
import { useAuth } from '../context/AuthContext';
import { Printer, Download, BookOpen, AlertCircle, FileSpreadsheet } from 'lucide-react';

const Reports = () => {
  const { user, profile } = useAuth();
  
  const [sections, setSections] = useState([]);
  const [staff, setStaff] = useState([]);
  
  const [targetType, setTargetType] = useState('section'); // section or staff
  const [selectedId, setSelectedId] = useState('');
  
  const [scheduleData, setScheduleData] = useState([]);
  const [timeslots, setTimeslots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initial load
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [secs, listStaff] = await Promise.all([
          adminApi.getSections(),
          adminApi.getStaff()
        ]);
        setSections(secs);
        setStaff(listStaff);
      } catch (e) {
        console.error(e);
      }
    };
    loadFilters();
  }, []);

  // Auto-detect logged-in Staff member
  useEffect(() => {
    if (user && user.role === 'Staff' && profile?.staff?.id) {
      setTargetType('staff');
      setSelectedId(String(profile.staff.id));
    }
  }, [user, profile]);

  // Fetch timetable data
  const fetchReportData = async () => {
    if (!selectedId) return;
    setLoading(true);
    setError('');
    try {
      if (targetType === 'section') {
        const res = await timetableApi.getSectionTimetable(selectedId);
        setScheduleData(res.details);
      } else {
        const res = await timetableApi.getStaffTimetable(selectedId);
        // Map staff schedule details into the unified format
        const mapped = res.map(d => ({
          timeslot_id: d.timeslot_id,
          subject_name: d.subject_name,
          subject_code: d.subject_code,
          staff_name: staff.find(s => s.id === parseInt(selectedId))?.name || profile?.staff?.name || 'Self',
          room_number: d.room_number,
          section_name: d.section_name
        }));
        setScheduleData(mapped);
      }

      // Generate timeslots list
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
      setError('No active timetable found for this selection.');
      setScheduleData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      fetchReportData();
    }
  }, [selectedId, targetType, staff]);

  // Export to CSV spreadsheet
  const handleExportCSV = () => {
    if (scheduleData.length === 0) return;
    
    // Construct CSV header
    const headers = ['Day', 'Period', 'Subject Code', 'Subject Name', 'Faculty Member', 'Room Location'];
    const rows = [];

    // Map each detail against timeslots
    timeslots.forEach(ts => {
      const detail = scheduleData.find(d => d.timeslot_id === ts.id);
      if (detail || ts.slot_type === 'Break') {
        rows.push([
          ts.day_of_week,
          ts.period_number,
          ts.slot_type === 'Break' ? 'BREAK' : detail.subject_code,
          ts.slot_type === 'Break' ? 'Institutional Break' : detail.subject_name,
          ts.slot_type === 'Break' ? '' : detail.staff_name,
          ts.slot_type === 'Break' ? '' : (detail.room_number || 'Online')
        ]);
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const name = targetType === 'section' 
      ? sections.find(s => s.id === parseInt(selectedId))?.name 
      : staff.find(s => s.id === parseInt(selectedId))?.name || profile?.staff?.name || 'staff';
    link.setAttribute("download", `timetable_${name.toLowerCase().replace(' ', '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Browser Print pdf trigger
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 md:space-y-8 print:p-0">
      {/* Title block */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {user?.role === 'Staff' ? 'Your Personal Roster' : 'Roster Export & Printing'}
          </h2>
          <p className="text-slate-550 dark:text-slate-400 mt-1 text-sm md:text-base">
            {user?.role === 'Staff' ? 'Export your schedule or save it as a print-ready PDF.' : 'Export high-fidelity spreadsheets and print-ready PDF matrices.'}
          </p>
        </div>
        
        {scheduleData.length > 0 && (
          <div className="flex flex-wrap sm:flex-nowrap gap-3 w-full md:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-750 dark:text-slate-200 font-semibold transition-all text-xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              Download Excel/CSV
            </button>
            
            <button
              onClick={handlePrint}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all text-xs shadow-md"
            >
              <Printer className="w-4 h-4 shrink-0" />
              Print / Save PDF
            </button>
          </div>
        )}
      </div>

      {/* Select Roster Targets - Hidden for Staff users */}
      {user?.role !== 'Staff' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 glass-panel p-6 rounded-3xl border border-slate-200 dark:border-slate-800 print:hidden">
          <div>
            <label className="block text-xs font-semibold text-slate-650 dark:text-slate-400 mb-1.5">Query Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setTargetType('section'); setSelectedId(''); setScheduleData([]); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  targetType === 'section' ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Section Roster
              </button>
              <button
                onClick={() => { setTargetType('staff'); setSelectedId(''); setScheduleData([]); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                  targetType === 'staff' ? 'bg-brand-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Faculty Roster
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-655 dark:text-slate-400 mb-1.5">Select Target Profile</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-slate-850 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            >
              <option value="">-- Choose Profile --</option>
              {targetType === 'section' ? (
                sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Semester {s.semester})</option>
                ))
              ) : (
                staff.map(s => (
                  <option key={s.id} value={s.id}>{s.name} (Faculty)</option>
                ))
              )}
            </select>
          </div>
        </div>
      )}

      {/* Roster Preview Area */}
      {selectedId ? (
        loading ? (
          <div className="text-center py-20 text-slate-550 dark:text-slate-400 animate-pulse print:hidden">Loading roster details...</div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 flex items-center gap-3 text-red-650 dark:text-red-400 text-sm print:hidden">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <div id="print-area" className="space-y-4 print:text-black">
            <div className="hidden print:block mb-6 border-b pb-4">
              <h1 className="text-2xl font-black uppercase text-center">Smart Timetable Management ERP</h1>
              <p className="text-xs text-center text-slate-600 mt-1">
                Generated Roster Report | Target: {
                  targetType === 'section' 
                    ? sections.find(s => s.id === parseInt(selectedId))?.name 
                    : staff.find(s => s.id === parseInt(selectedId))?.name || profile?.staff?.name || 'Self'
                }
              </p>
            </div>

            <TimetableGrid
              details={scheduleData}
              timeslots={timeslots}
              isEditable={false}
              projectDays={
                targetType === 'section' && selectedId && sections.find(s => s.id === parseInt(selectedId))?.project_days
                  ? sections.find(s => s.id === parseInt(selectedId)).project_days.split(',')
                  : ['Monday', 'Wednesday', 'Friday']
              }
            />
          </div>
        )
      ) : (
        <div className="text-center py-24 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-550 dark:text-slate-500 flex flex-col items-center justify-center gap-3 print:hidden">
          <BookOpen className="w-8 h-8 text-slate-400" />
          <span>Select a Target Profile to view and export the timetable calendar.</span>
        </div>
      )}
    </div>
  );
};

export default Reports;
