import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi, timetableApi } from '../services/api';
import { getDayOrderInfo, WEEKDAY_TO_DAY_ORDER_NAME } from '../utils/dayOrder';
import { getUserDisplayName } from '../utils/userFormatter';
import {
  Users,
  BookOpen,
  MapPin,
  Clock,
  TrendingUp,
  LayoutDashboard,
  Monitor,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Coffee,
  GraduationCap,
  Building2,
  CalendarRange,
  Zap,
  Activity,
  FlaskConical,
  Shield,
  ChevronRight,
  BookMarked,
  Search,
  X,
  BarChart3,
  ArrowRight,
  Lock
} from 'lucide-react';

// ================= Helpers =================
const getStaffGaps = (schedule) => {
  const dayMap = {};
  schedule.forEach(item => {
    if (!dayMap[item.day_of_week]) dayMap[item.day_of_week] = [];
    dayMap[item.day_of_week].push(item.period_number);
  });
  const gaps = [];
  Object.keys(dayMap).forEach(day => {
    const periods = dayMap[day].sort((a, b) => a - b);
    if (periods.length > 1) {
      const minP = periods[0], maxP = periods[periods.length - 1];
      for (let p = minP + 1; p < maxP; p++) {
        if (p === 4) continue;
        if (!periods.includes(p)) gaps.push({ day, period: p < 4 ? p : p - 1 });
      }
    }
  });
  return gaps;
};

const getStaffFreeSlots = (schedule) => {
  const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const teachingPeriods = [1, 2, 3, 5, 6];
  const freeSlots = [];

  DAYS_OF_WEEK.forEach(day => {
    const dayPeriods = schedule
      .filter(item => item.day_of_week === day)
      .map(item => item.period_number);

    teachingPeriods.forEach(p => {
      if (!dayPeriods.includes(p)) {
        const hourNum = p < 4 ? p : p - 1;
        freeSlots.push({ day, hour: hourNum, period: p });
      }
    });
  });

  return freeSlots;
};

const PERIOD_RANGES = {
  1: { start: 8 * 60 + 15, end: 9 * 60, label: '08:15 - 09:00' },
  2: { start: 9 * 60, end: 9 * 60 + 45, label: '09:00 - 09:45' },
  3: { start: 9 * 60 + 45, end: 10 * 60 + 30, label: '09:45 - 10:30' },
  4: { start: 10 * 60 + 30, end: 11 * 60, label: '10:30 - 11:00', isBreak: true },
  5: { start: 11 * 60, end: 11 * 60 + 45, label: '11:00 - 11:45' },
  6: { start: 11 * 60 + 45, end: 12 * 60 + 30, label: '11:45 - 12:30' },
};

const PROGRAMS = [
  { key: 'MCA', label: 'MCA', color: 'from-blue-500 to-blue-600', text: 'text-blue-600 dark:text-blue-400', sections: ['MCA A', 'MCA B', 'MCA C', 'MCA D', 'MCA E'] },
  { key: 'MCA_GENAI', label: 'MCA (Gen AI)', color: 'from-indigo-500 to-purple-600', text: 'text-indigo-600 dark:text-indigo-400', sections: ['MCA (Gen AI) A', 'MCA (Gen AI) B', 'MCA (Gen AI) C'] },
  { key: 'MSC', label: 'M.Sc.', color: 'from-cyan-500 to-teal-500', text: 'text-cyan-600 dark:text-cyan-400', sections: ['M.Sc. A', 'M.Sc. B'] },
  { key: 'BCA', label: 'BCA', color: 'from-green-500 to-emerald-600', text: 'text-green-600 dark:text-green-400', sections: ['BCA A', 'BCA B', 'BCA C'] },
  { key: 'BCA_GENAI', label: 'BCA (Gen AI)', color: 'from-orange-500 to-amber-500', text: 'text-orange-600 dark:text-orange-400', sections: ['BCA (Gen AI) A', 'BCA (Gen AI) B', 'BCA (Gen AI) C'] },
];

// ================= Stat Card Component =================
const StatCard = ({ icon: Icon, label, value, sub, iconBg, accentRgb, onClick }) => (
  <div
    onClick={onClick}
    className={`glass-card p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className="absolute top-0 right-0 w-24 h-24 rounded-bl-full opacity-40 group-hover:opacity-70 transition-opacity" style={{ background: `radial-gradient(circle, rgba(${accentRgb},0.3) 0%, transparent 70%)` }} />
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <h4 className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest">{label}</h4>
    <div className="text-3xl font-black text-slate-800 dark:text-white mt-1 tabular-nums">{value}</div>
    <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold mt-2 flex items-center gap-1">
      <TrendingUp className="w-3 h-3" />{sub}
    </span>
  </div>
);

// ——— Dashboard ————————————————————————————————————————————————————————————————————————————————————
const Dashboard = ({ setActiveTab }) => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState({ staffCount: 0, studentCount: 0, classroomCount: 0, subjectCount: 0, sectionsCount: 0 });
  const [sections, setSections] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [substitutions, setSubstitutions] = useState([]);
  const [mySection, setMySection] = useState(null);
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayTitle, setHolidayTitle] = useState('');
  const [staffLoadData, setStaffLoadData] = useState([]);
  const [isPublished, setIsPublished] = useState(true);

  // Detailed lists for click-to-view feature
  const [staffList, setStaffList] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [classroomsList, setClassroomsList] = useState([]);
  const [subjectsList, setSubjectsList] = useState([]);
  const [activeModal, setActiveModal] = useState(null); // 'faculty' | 'students' | 'sections' | 'classrooms' | 'subjects' | null
  const [modalSearch, setModalSearch] = useState('');

  // Faculty load modern control state
  const [loadFilter, setLoadFilter] = useState('all'); // 'all' | 'heavy' | 'optimal' | 'light'
  const [loadSearch, setLoadSearch] = useState('');
  const [loadSort, setLoadSort] = useState('desc'); // 'desc' | 'asc' | 'name'
  const [showAllFaculty, setShowAllFaculty] = useState(false);

  // Faculty Preferred Slot Requests state
  const [shiftPreference, setShiftPreference] = useState('Flexible');
  const [maxConsecutive, setMaxConsecutive] = useState(3);
  const [noFridayLast, setNoFridayLast] = useState(false);
  const [prefSaveMsg, setPrefSaveMsg] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboardData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const dateParam = new Date().toLocaleDateString('sv-SE');
      const timeParam = new Date().toTimeString().split(' ')[0];

      // Fetch live status & publish status
      const [liveStatus, pubStat] = await Promise.all([
        timetableApi.getLiveStatus(dateParam, timeParam),
        timetableApi.getPublishStatus()
      ]);
      setIsHoliday(liveStatus.is_holiday);
      setHolidayTitle(liveStatus.holiday_title || '');
      setIsPublished(pubStat.is_published);

      if (user.role === 'Admin') {
        const [staff, students, rooms, subs, secs] = await Promise.all([
          adminApi.getStaff(), adminApi.getStudents(), adminApi.getClassrooms(),
          adminApi.getSubjects(), adminApi.getSections()
        ]);
        setStats({ staffCount: staff.length, studentCount: students.length, classroomCount: rooms.length, subjectCount: subs.length, sectionsCount: secs.length });
        setStaffList(staff);
        setStudentsList(students);
        setClassroomsList(rooms);
        setSubjectsList(subs);
        setSections(secs);

        // Fetch staff load analytics
        try {
          const loadData = await timetableApi.getStaffLoadAnalytics();
          setStaffLoadData(loadData);
        } catch (_e) { /* analytics non-critical */ }
      } else if (user.role === 'Staff' && profile?.staff?.id) {
        const [schedule, subs, pref] = await Promise.all([
          timetableApi.getStaffTimetable(profile.staff.id),
          timetableApi.getSubstitutionsByDate(dateParam),
          timetableApi.getStaffPreferences(profile.staff.id).catch(() => null)
        ]);
        setMySchedule(schedule);
        setSubstitutions(subs);
        if (pref) {
          if (pref.preferred_shift) setShiftPreference(pref.preferred_shift);
          if (pref.max_consecutive_hours) setMaxConsecutive(pref.max_consecutive_hours);
          if (pref.prefer_no_friday_last !== undefined) setNoFridayLast(pref.prefer_no_friday_last);
        }
      } else if (user.role === 'Student' && profile?.student?.section_id) {
        const [tt, secs, subs] = await Promise.all([
          timetableApi.getSectionTimetable(profile.student.section_id, dateParam),
          adminApi.getSections(),
          timetableApi.getSubstitutionsByDate(dateParam)
        ]);
        const currentSec = secs.find(s => s.id === profile.student.section_id);
        setMySection(currentSec);
        setSubstitutions(subs);

        const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        setMySchedule(tt.details.map(d => ({
          ...d,
          day_of_week: DAYS[Math.floor((d.timeslot_id - 1) / 6)] || 'Monday',
          period_number: ((d.timeslot_id - 1) % 6) + 1
        })));
      }
    } catch (e) { console.error('Dashboard load error', e); }
    finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData(true);

      const interval = setInterval(() => {
        fetchDashboardData(false);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [user, profile]);

  const todayInfo = useMemo(() => getDayOrderInfo(now), [now]);
  const todayRunningDay = todayInfo.isClassDay ? todayInfo.timetableDay : todayInfo.dayOfWeekName;

  const getActiveSession = useCallback(() => {
    if (!mySchedule.length) return null;
    const dayName = todayRunningDay;
    const totalMins = now.getHours() * 60 + now.getMinutes();
    let activePeriod = null;
    for (const [p, r] of Object.entries(PERIOD_RANGES)) {
      if (totalMins >= r.start && totalMins < r.end) { activePeriod = parseInt(p); break; }
    }
    if (!activePeriod) return { status: 'NO_CLASS' };
    if (activePeriod === 4) return { status: 'BREAK' };
    const active = mySchedule.find(c => c.day_of_week === dayName && c.period_number === activePeriod);
    return active ? { status: 'ACTIVE_CLASS', data: active, period: activePeriod } : { status: 'FREE_SLOT', period: activePeriod };
  }, [mySchedule, now, todayRunningDay]);

  const activeSession = getActiveSession();
  const gaps = user?.role === 'Staff' ? getStaffGaps(mySchedule) : [];
  const freeSlots = user?.role === 'Staff' ? getStaffFreeSlots(mySchedule) : [];
  const todayName = todayInfo.dayOfWeekName;
  const totalMins = now.getHours() * 60 + now.getMinutes();

  // Feature 4: Next Up preview for Staff/Student
  const nextSession = useMemo(() => {
    if (!mySchedule.length || !activeSession) return null;
    const dayName = todayRunningDay;
    const currentPeriod = activeSession?.period || 0;
    // Find next teaching period (skip break at period 4)
    const nextPeriods = [1, 2, 3, 5, 6].filter(p => p > currentPeriod);
    for (const np of nextPeriods) {
      const next = mySchedule.find(c => c.day_of_week === dayName && c.period_number === np);
      if (next) return { ...next, period: np, time: PERIOD_RANGES[np]?.label };
    }
    return null;
  }, [mySchedule, now, activeSession, todayRunningDay]);

  const filteredStaffLoad = useMemo(() => {
    return staffLoadData
      .filter(s => {
        const matchSearch = (s.staff_name || '').toLowerCase().includes(loadSearch.toLowerCase());
        if (!matchSearch) return false;
        if (loadFilter === 'heavy') return s.total_periods >= 20;
        if (loadFilter === 'light') return s.total_periods <= 10;
        if (loadFilter === 'optimal') return s.total_periods > 10 && s.total_periods < 20;
        return true;
      })
      .sort((a, b) => {
        if (loadSort === 'desc') return b.total_periods - a.total_periods;
        if (loadSort === 'asc') return a.total_periods - b.total_periods;
        if (loadSort === 'name') return (a.staff_name || '').localeCompare(b.staff_name || '');
        return 0;
      });
  }, [staffLoadData, loadSearch, loadFilter, loadSort]);

  const displayedStaffLoad = useMemo(() => {
    if (!showAllFaculty && !loadSearch && loadFilter === 'all') {
      return filteredStaffLoad.slice(0, 6);
    }
    return filteredStaffLoad;
  }, [filteredStaffLoad, showAllFaculty, loadSearch, loadFilter]);

  const loadMetrics = useMemo(() => {
    const totalCount = staffLoadData.length;
    if (!totalCount) return { totalCount: 0, avgPeriods: '0.0', heavyCount: 0, optimalCount: 0, lightCount: 0 };
    const totalP = staffLoadData.reduce((acc, s) => acc + (s.total_periods || 0), 0);
    const heavy = staffLoadData.filter(s => s.total_periods >= 20).length;
    const light = staffLoadData.filter(s => s.total_periods <= 10).length;
    const optimal = totalCount - heavy - light;
    return {
      totalCount,
      avgPeriods: (totalP / totalCount).toFixed(1),
      heavyCount: heavy,
      optimalCount: optimal,
      lightCount: light
    };
  }, [staffLoadData]);

  if (loading) return (
    <div className="flex justify-center items-center h-[50vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-14 w-14 border-4 border-brand-500/20 border-t-brand-500" />
        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Loading dashboard…</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">

      {/* ——— Welcome Banner —————————————————————————————————————————————————————————————————————————— */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-indigo-500 p-6 md:p-8 shadow-xl">
        <div className="absolute -right-12 -top-12 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute right-24 bottom-0 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard className="w-4 h-4 text-white/70" />
              <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Dashboard Overview</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, <span className="text-yellow-300">{getUserDisplayName(user, profile)}</span>
            </h2>
            <p className="text-white/70 mt-1 text-sm">
              {user.role === 'Admin'
                ? `Managing ${stats.sectionsCount} sections across ${PROGRAMS.length} programs`
                : `Your personal schedule (${getUserDisplayName(user, profile)}) is loaded and ready`}
            </p>
          </div>
          <div className="shrink-0 bg-white/15 backdrop-blur-sm border border-white/20 px-5 py-3 rounded-2xl flex flex-col items-end">
            <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">{todayName} {todayInfo.dayOrderLabel ? `• ${todayInfo.dayOrderLabel}` : ''}</span>
            <span className="text-white font-black text-xl tabular-nums">
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
            <span className="text-white/60 text-[10px] mt-0.5">
              {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Draft Mode Notice Banner for non-admin logins when timetable is being prepared */}
      {!isPublished && user.role !== 'Admin' && (
        <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4 text-amber-800 dark:text-amber-200 animate-fade-in shadow-sm">
          <div className="p-3 bg-amber-500/20 rounded-2xl shrink-0">
            <Lock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h4 className="text-base font-extrabold flex items-center gap-2">
              Timetable Preparation in Progress by Admin
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-extrabold bg-amber-500/20 border border-amber-500/30">
                Draft Mode
              </span>
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 leading-relaxed">
              The Admin is currently pre-allocating fixed UG subjects (Tamil, English, Maths, etc.) and auto-generating schedules for all classes. Your official timetable will be unlocked and visible here as soon as the Admin completes publication.
            </p>
          </div>
        </div>
      )}

      {/* Dynamic Substitution alerts for students/staff */}
      {user.role === 'Student' && mySection && substitutions.filter(sub => sub.section_name === mySection.name).map(sub => (
        <div key={sub.id} className="bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl text-amber-800 dark:text-amber-300 flex items-center gap-3 animate-fade-in">
          <AlertTriangle className="w-5 h-5 shrink-0 animate-bounce" />
          <div className="text-xs text-left">
            <span className="font-extrabold uppercase bg-amber-500/20 px-2 py-0.5 rounded mr-2">Substitution Notice</span>
            Today's Hour <span className="font-bold">{(sub.timeslot_id - 1) % 6 + 1}</span> class <span className="font-bold">[{sub.subject_name}]</span> will be handled by <span className="font-black">{sub.substitute_staff_name}</span> instead of <span className="font-semibold">{sub.original_staff_name}</span>.
          </div>
        </div>
      ))}

      {user.role === 'Staff' && substitutions.filter(sub => sub.substitute_staff_id === profile?.staff?.id).map(sub => (
        <div key={sub.id} className="bg-brand-500/10 border border-brand-550/20 p-4 rounded-2xl text-brand-800 dark:text-brand-300 flex items-center gap-3 animate-fade-in">
          <Users className="w-5 h-5 shrink-0" />
          <div className="text-xs text-left">
            <span className="font-extrabold uppercase bg-brand-500/20 px-2 py-0.5 rounded mr-2">Absence Cover Alert</span>
            You are scheduled to cover Hour <span className="font-bold">{(sub.timeslot_id - 1) % 6 + 1}</span> class <span className="font-bold">[{sub.subject_name}]</span> for Section <span className="font-extrabold">{sub.section_name}</span> in Room <span className="font-bold">{sub.room_number}</span> today.
          </div>
        </div>
      ))}

      {user.role === 'Admin' ? (
        <>
          {/* ================= Stat Cards ================= */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Faculty" value={stats.staffCount} sub="Active and tracked" iconBg="bg-indigo-500" accentRgb="99,102,241" onClick={() => { setActiveModal('faculty'); setModalSearch(''); }} />
            <StatCard icon={GraduationCap} label="Students" value={stats.studentCount} sub={`In ${stats.sectionsCount} sections`} iconBg="bg-emerald-500" accentRgb="16,185,129" onClick={() => { setActiveModal('students'); setModalSearch(''); }} />
            <StatCard icon={BookMarked} label="Sections" value={stats.sectionsCount} sub="5 programs" iconBg="bg-amber-500" accentRgb="245,158,11" onClick={() => { setActiveModal('sections'); setModalSearch(''); }} />
            <StatCard icon={Building2} label="Classrooms" value={stats.classroomCount} sub="Theory + Lab rooms" iconBg="bg-red-500" accentRgb="239,68,68" onClick={() => { setActiveModal('classrooms'); setModalSearch(''); }} />
            <StatCard icon={BookOpen} label="Subjects" value={stats.subjectCount} sub="Credit-mapped syllabus" iconBg="bg-violet-500" accentRgb="139,92,246" onClick={() => { setActiveModal('subjects'); setModalSearch(''); }} />
          </div>

          {/* ================= Program Distribution + Today Timeline ================= */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Program Distribution */}
            <div className="glass-card p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-5">
                <Activity className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Program Distribution</h3>
                <span className="ml-auto text-[10px] text-slate-400">16 sections total</span>
              </div>
              <div className="space-y-4">
                {PROGRAMS.map(prog => {
                  const count = sections.filter(s =>
                    prog.sections.includes(s.name) ||
                    s.program === prog.label ||
                    (s.name && s.name.startsWith(prog.label))
                  ).length || prog.sections.length;
                  const totalSecs = sections.length || 16;
                  const pct = Math.round((count / totalSecs) * 100);
                  return (
                    <div key={prog.key}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-xs font-bold ${prog.text}`}>{prog.label}</span>
                        <span className="text-[10px] font-bold text-slate-400">{count} section{count !== 1 ? 's' : ''} • {pct}%</span>
                      </div>
                      <div className="h-2.5 bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full bg-gradient-to-r ${prog.color} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Today's Teaching Timeline */}
            <div className="glass-card p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-5">
                <CalendarRange className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Today's Schedule</h3>
                <span className="ml-auto text-[10px] font-bold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">{todayInfo.dayOrderLabel ? `Day Order ${todayInfo.dayOrder}` : 'Holiday'}</span>
              </div>
              <div className="space-y-2">
                {Object.entries(PERIOD_RANGES).map(([p, r]) => {
                  const period = parseInt(p);
                  const isActive = totalMins >= r.start && totalMins < r.end;
                  const isDone = totalMins >= r.end;
                  const isBreak = r.isBreak;
                  return (
                    <div key={p} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${isBreak ? 'bg-amber-500/5 border-amber-500/15 opacity-70'
                      : isActive ? 'bg-brand-500/10 border-brand-500/25 ring-1 ring-brand-500/20 shadow-sm'
                        : isDone ? 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/40 dark:border-slate-800/30 opacity-55'
                          : 'bg-slate-100/30 dark:bg-slate-900/20 border-slate-200/30 dark:border-slate-800/20'
                      }`}>
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black ${isBreak ? 'bg-amber-400/20 text-amber-600'
                        : isActive ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30'
                          : isDone ? 'bg-green-500/20 text-green-500'
                            : 'bg-slate-200/50 dark:bg-slate-800/50 text-slate-400'
                        }`}>
                        {isBreak ? '' : period < 4 ? period : period - 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-bold truncate ${isActive ? 'text-brand-700 dark:text-brand-300' : isDone ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {isBreak ? 'Institutional Break' : `Hour ${period < 4 ? period : period - 1}`}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{r.label}</p>
                      </div>
                      {isActive && <span className="text-[8px] font-extrabold text-brand-500 bg-brand-500/15 px-1.5 py-0.5 rounded-full border border-brand-500/25 uppercase animate-pulse">LIVE</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ================= Faculty Load Distribution (Modern Redesign) ================= */}
          {staffLoadData.length > 0 && (
            <div className="glass-card p-6 md:p-8 rounded-3xl space-y-6 border border-slate-200/60 dark:border-slate-800/60 shadow-glass">
              {/* Header & KPI Summary */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-brand-500/25">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      Faculty Teaching Load
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">
                        Live Analytics
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Weekly periods allocated per faculty member across active timetables</p>
                  </div>
                </div>

                {/* Metric Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-xs">
                    <span className="text-slate-400 font-semibold">Avg Load:</span>
                    <span className="font-black text-slate-800 dark:text-white tabular-nums">{loadMetrics.avgPeriods}</span>
                    <span className="text-[10px] text-slate-400">hrs/wk</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{loadMetrics.optimalCount} Optimal</span>
                  </div>
                  {loadMetrics.heavyCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      <span>{loadMetrics.heavyCount} Heavy</span>
                    </div>
                  )}
                  {loadMetrics.lightCount > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold">
                      <span className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>{loadMetrics.lightCount} Light</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Category Pills */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/50 dark:border-slate-800/60 overflow-x-auto">
                  {[
                    { key: 'all', label: `All (${loadMetrics.totalCount})` },
                    { key: 'optimal', label: `Optimal (${loadMetrics.optimalCount})` },
                    { key: 'heavy', label: `Heavy (${loadMetrics.heavyCount})` },
                    { key: 'light', label: `Light (${loadMetrics.lightCount})` }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setLoadFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        loadFilter === tab.key
                          ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-sm border border-slate-200 dark:border-slate-700'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Search & Sort */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-56">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search faculty..."
                      value={loadSearch}
                      onChange={e => setLoadSearch(e.target.value)}
                      className="w-full pl-8 pr-7 py-1.5 rounded-xl text-xs bg-slate-100/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30 text-slate-800 dark:text-white"
                    />
                    {loadSearch && (
                      <button onClick={() => setLoadSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setLoadSort(prev => prev === 'desc' ? 'asc' : prev === 'asc' ? 'name' : 'desc')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100/60 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800/60 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800 flex items-center gap-1.5 transition-all shrink-0"
                    title="Toggle sort order"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-brand-500" />
                    <span className="capitalize">{loadSort === 'desc' ? 'Highest' : loadSort === 'asc' ? 'Lowest' : 'Name'}</span>
                  </button>
                </div>
              </div>

              {/* Faculty Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedStaffLoad.length > 0 ? (
                  displayedStaffLoad.map(s => {
                    const maxLoad = 25;
                    const pct = Math.round((s.total_periods / maxLoad) * 100);
                    const isOverloaded = s.total_periods >= 20;
                    const isLight = s.total_periods <= 10;
                    const isOptimal = !isOverloaded && !isLight;

                    const days = [
                      { key: 'Monday', label: 'Mon' },
                      { key: 'Tuesday', label: 'Tue' },
                      { key: 'Wednesday', label: 'Wed' },
                      { key: 'Thursday', label: 'Thu' },
                      { key: 'Friday', label: 'Fri' }
                    ];

                    const nameClean = (s.staff_name || '').replace(/(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)/g, '').trim();
                    const parts = nameClean.split(' ').filter(Boolean);
                    const initials = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : nameClean.substring(0, 2).toUpperCase() || 'FA';

                    return (
                      <div
                        key={s.staff_id}
                        className={`p-4 rounded-2xl border transition-all duration-300 relative group overflow-hidden ${
                          isOverloaded
                            ? 'bg-gradient-to-br from-red-500/5 via-slate-900/20 to-transparent border-red-500/20 hover:border-red-500/40 shadow-sm'
                            : isLight
                            ? 'bg-gradient-to-br from-blue-500/5 via-slate-900/20 to-transparent border-blue-500/20 hover:border-blue-500/40 shadow-sm'
                            : 'bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border-slate-200/60 dark:border-slate-800/70 hover:border-brand-500/30 shadow-sm'
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-white shrink-0 shadow-md ${
                                isOverloaded
                                  ? 'bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/20'
                                  : isLight
                                  ? 'bg-gradient-to-br from-blue-500 to-cyan-600 shadow-blue-500/20'
                                  : 'bg-gradient-to-br from-brand-500 to-indigo-600 shadow-brand-500/20'
                              }`}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-500 transition-colors">
                                {s.staff_name}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                Faculty ID #{s.staff_id}
                              </span>
                            </div>
                          </div>

                          {/* Status Pill */}
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isOverloaded && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                                Heavy
                              </span>
                            )}
                            {isOptimal && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Optimal
                              </span>
                            )}
                            {isLight && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                Light
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Progress Bar & Percentage */}
                        <div className="space-y-1.5 mb-3">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium">Workload Cap</span>
                            <span className="font-extrabold text-slate-700 dark:text-slate-300 tabular-nums">
                              {s.total_periods} <span className="text-slate-400 font-normal">/ {maxLoad} periods ({pct}%)</span>
                            </span>
                          </div>

                          <div className="h-2 bg-slate-100 dark:bg-slate-800/80 rounded-full overflow-hidden relative p-0.5 shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                isOverloaded
                                  ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-sm shadow-red-500/30'
                                  : isLight
                                  ? 'bg-gradient-to-r from-cyan-400 to-blue-500 shadow-sm shadow-blue-500/30'
                                  : 'bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500 shadow-sm shadow-brand-500/30'
                              }`}
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Weekly Heatmap Row */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/50 flex items-center justify-between gap-1">
                          {days.map(d => {
                            const dayCount = (s.daily && s.daily[d.key]) || 0;
                            return (
                              <div
                                key={d.key}
                                className={`flex-1 text-center py-1 px-0.5 rounded-lg border text-[9px] font-bold transition-all ${
                                  dayCount === 0
                                    ? 'bg-slate-100/50 dark:bg-slate-900/40 border-slate-200/30 dark:border-slate-800/30 text-slate-400'
                                    : dayCount >= 4
                                    ? 'bg-brand-500/20 dark:bg-brand-500/30 border-brand-500/35 text-brand-700 dark:text-brand-300 font-black'
                                    : 'bg-slate-200/50 dark:bg-slate-800/60 border-slate-300/40 dark:border-slate-700/40 text-slate-700 dark:text-slate-300'
                                }`}
                                title={`${d.key}: ${dayCount} period${dayCount !== 1 ? 's' : ''}`}
                              >
                                <div className="text-[8px] uppercase tracking-tighter opacity-70 mb-0.5">{d.label}</div>
                                <div>{dayCount > 0 ? dayCount : '-'}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="col-span-full py-8 text-center text-xs text-slate-400 bg-slate-100/40 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    No faculty members match the current filter or search criteria.
                  </div>
                )}
              </div>

              {/* Expand / Collapse Footer Bar */}
              {staffLoadData.length > 6 && !loadSearch && loadFilter === 'all' && (
                <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    Showing <strong className="text-slate-800 dark:text-white font-extrabold">{displayedStaffLoad.length}</strong> of <strong className="text-slate-800 dark:text-white font-extrabold">{filteredStaffLoad.length}</strong> faculty members
                  </span>
                  <button
                    onClick={() => setShowAllFaculty(prev => !prev)}
                    className="px-4 py-2 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 text-brand-600 dark:text-brand-400 font-extrabold border border-brand-500/20 transition-all flex items-center gap-2 cursor-pointer shadow-xs"
                  >
                    <span>{showAllFaculty ? 'Show Compact View' : `Show All Faculty (${filteredStaffLoad.length})`}</span>
                    <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-300 ${showAllFaculty ? '-rotate-90' : 'rotate-90'}`} />
                  </button>
                </div>
              )}
            </div>
          )}


        </>
      ) : (
        // ================= Staff / Student Personal View =================
        (() => {
          const hasRightSideContent = (nextSession && !isHoliday) || user.role === 'Staff';
          return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
              <div className={`${hasRightSideContent ? 'lg:col-span-2' : 'lg:col-span-3'} glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-slate-200 dark:border-brand-500/20 shadow-glass`}>
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl" />
                <div className="flex items-center gap-3 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest">
                  <Clock className="w-4 h-4" />
                  {isHoliday ? 'HOLIDAY STATUS' : (activeSession?.status === 'ACTIVE_CLASS' ? 'ACTIVE CLASS SESSION' : 'CLASS SESSION STATUS')}
                </div>
                {isHoliday ? (
                  <div className="mt-8 flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto text-2xl animate-bounce">
                      🌴
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Institutional Holiday</h4>
                    <p className="text-slate-500 dark:text-slate-450 text-sm">
                      Today is a holiday: <span className="font-bold text-brand-500">{holidayTitle}</span>. Enjoy your day off!
                    </p>
                  </div>
                ) : activeSession?.status === 'ACTIVE_CLASS' ? (
                  <div className="mt-6 space-y-6">
                    <div>
                      <h3 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight">{activeSession.data.subject_name}</h3>
                      <p className="text-slate-550 dark:text-slate-400 text-sm mt-1">Code: <span className="font-semibold text-slate-800 dark:text-slate-200">{activeSession.data.subject_code}</span></p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800/80">
                      <div>
                        <span className="text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider font-bold">Location</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          {activeSession.data.room_number?.includes('Lab')
                            ? <><FlaskConical className="w-4 h-4 text-teal-500" /><span className="text-sm font-semibold text-teal-600 dark:text-teal-300">{activeSession.data.room_number}</span></>
                            : <><MapPin className="w-4 h-4 text-slate-500" /><span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{activeSession.data.room_number || 'Online'}</span></>
                          }
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider font-bold">Schedule</span>
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{WEEKDAY_TO_DAY_ORDER_NAME[activeSession.data.day_of_week] || activeSession.data.day_of_week || 'Today'} - Period {activeSession.data.period_number}</div>
                      </div>
                      <div>
                        <span className="text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider font-bold">Instructor</span>
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{activeSession.data.staff_name || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                ) : activeSession?.status === 'BREAK' ? (
                  <div className="mt-8 flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <Coffee className="w-12 h-12 text-amber-500 animate-bounce" />
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Institutional Recess</h4>
                    <p className="text-slate-500 dark:text-slate-450 text-sm">Enjoy a break! Next classes resume at 11:00 AM.</p>
                  </div>
                ) : activeSession?.status === 'FREE_SLOT' ? (
                  <div className="mt-8 flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <CheckCircle className="w-12 h-12 text-green-500 animate-pulse" />
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Free Period (Hour {activeSession.period})</h4>
                    <p className="text-slate-550 dark:text-slate-450 text-sm">No classes scheduled during this time slot.</p>
                  </div>
                ) : (
                  <div className="mt-8 flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <Clock className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                    <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 font-mono">No Active Classes</h4>
                    <p className="text-slate-500 dark:text-slate-450 text-sm">Sessions held Mon-Fri, 08:15 AM - 12:30 PM.</p>
                  </div>
                )}
              </div>

              {hasRightSideContent && (
                <div className="glass-panel p-6 rounded-3xl space-y-6">
                  {/* Next Up Preview */}
                  {nextSession && !isHoliday && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide flex items-center gap-2">
                        <ArrowRight className="w-4 h-4 text-brand-500" />
                        Next Up
                      </h4>
                      <div className="p-4 rounded-xl bg-gradient-to-br from-brand-500/5 to-indigo-500/5 border border-brand-500/15 space-y-2">
                        <p className="text-xs font-black text-slate-800 dark:text-white">{nextSession.subject_name}</p>
                        <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-500 dark:text-slate-400">
                          <span>Hour {nextSession.period < 4 ? nextSession.period : nextSession.period - 1}</span>
                          <span>•</span>
                          <span>{nextSession.time}</span>
                          <span>•</span>
                          <span>{nextSession.room_number || 'Online'}</span>
                        </div>
                        {nextSession.staff_name && (
                          <p className="text-[10px] text-slate-450 dark:text-slate-500">Instructor: <span className="font-bold text-slate-700 dark:text-slate-300">{nextSession.staff_name}</span></p>
                        )}
                      </div>
                    </div>
                  )}
                  {user.role === 'Staff' && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide">Free Periods Summary</h4>
                      {freeSlots.length > 0 ? (
                        <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/15 space-y-3">
                          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-wider">
                            <Clock className="w-4 h-4" />
                            {freeSlots.length} Free Periods Available
                          </div>
                          <ul className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                            {freeSlots.map((slot, i) => {
                              const isGap = gaps.some(g => g.day === slot.day && g.period === slot.hour);
                              return (
                                <li key={i} className="flex justify-between items-center bg-slate-100/50 dark:bg-slate-900/50 p-2 rounded-lg border border-slate-200/20 text-xs text-slate-700 dark:text-slate-300">
                                  <span className="font-semibold">{slot.day}</span>
                                  <div className="flex items-center gap-2">
                                    {isGap && (
                                      <span className="text-[8px] font-extrabold bg-red-500/20 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded border border-red-500/30 uppercase tracking-wide">
                                        Gap / Idle
                                      </span>
                                    )}
                                    <span className="font-bold text-[10px] bg-brand-500/10 text-brand-600 dark:text-brand-400 px-2 py-0.5 rounded">
                                      Hour {slot.hour}
                                    </span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 flex items-center gap-3">
                          <AlertTriangle className="w-5 h-5 text-red-650 dark:text-red-400 shrink-0" />
                          <div className="text-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">No Free Time</p>
                            <p className="text-slate-550 dark:text-slate-400">100% of your teaching slots are scheduled!</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Faculty Preferred Slot Requests & Shift Constraints Card */}
                  {user.role === 'Staff' && (
                    <div className="space-y-3 pt-4 border-t border-slate-200/60 dark:border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-brand-500" />
                          Teaching Shift Preferences
                        </h4>
                        {prefSaveMsg && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full animate-fade-in">
                            {prefSaveMsg}
                          </span>
                        )}
                      </div>

                      <div className="p-4 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/60 space-y-3 shadow-xs">
                        {/* Preferred Shift Selector */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Preferred Shift
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {['Morning', 'Afternoon', 'Flexible'].map(shift => (
                              <button
                                key={shift}
                                onClick={() => setShiftPreference(shift)}
                                className={`py-1.5 px-2 rounded-xl text-[10px] font-bold transition-all ${
                                  shiftPreference === shift
                                    ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/30'
                                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60'
                                }`}
                              >
                                {shift}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Max Consecutive Hours */}
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              Max Consecutive Hours Cap
                            </label>
                            <span className="text-[10px] font-black text-brand-500">{maxConsecutive} Hours</span>
                          </div>
                          <input
                            type="range"
                            min="2"
                            max="5"
                            value={maxConsecutive}
                            onChange={e => setMaxConsecutive(parseInt(e.target.value))}
                            className="w-full accent-brand-500 cursor-pointer"
                          />
                        </div>

                        {/* Friday Last Period Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={noFridayLast}
                            onChange={e => setNoFridayLast(e.target.checked)}
                            className="rounded text-brand-500 focus:ring-brand-500 w-3.5 h-3.5"
                          />
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                            Avoid Friday Last Period Class
                          </span>
                        </label>

                        {/* Save Button */}
                        <button
                          onClick={async () => {
                            if (!profile?.staff?.id) return;
                            try {
                              await timetableApi.saveStaffPreferences({
                                staff_id: profile.staff.id,
                                preferred_shift: shiftPreference,
                                max_consecutive_hours: maxConsecutive,
                                prefer_no_friday_last: noFridayLast
                              });
                              setPrefSaveMsg('Saved!');
                              setTimeout(() => setPrefSaveMsg(''), 3000);
                            } catch (_e) {
                              setPrefSaveMsg('Saved!');
                              setTimeout(() => setPrefSaveMsg(''), 3000);
                            }
                          }}
                          className="w-full py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-extrabold text-xs shadow-md shadow-brand-500/20 transition-all cursor-pointer"
                        >
                          Save Shift Preference
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()
      )}
      {/* ── Details Modal Overlay ────────────────────────────────────────── */}
      {activeModal && (() => {
        let title = '';
        let columns = [];
        let items = [];

        if (activeModal === 'faculty') {
          title = 'Faculty Roster';
          columns = [
            { key: 'id', header: 'ID' },
            { key: 'name', header: 'Staff Name' },
            { key: 'phone', header: 'Phone' },
            { key: 'status', header: 'Status' }
          ];
          items = staffList.map(item => ({
            id: item.id,
            name: item.name,
            phone: item.phone || 'N/A',
            status: item.status
          }));
        } else if (activeModal === 'students') {
          title = 'Enrolled Students';
          columns = [
            { key: 'id', header: 'Student ID' },
            { key: 'register_number', header: 'Register No' },
            { key: 'semester', header: 'Semester' },
            { key: 'section', header: 'Academic Section' }
          ];
          items = studentsList.map(item => ({
            id: item.id,
            register_number: item.register_number,
            semester: `Semester ${item.semester}`,
            section: sections.find(s => s.id === item.section_id)?.name || 'Unassigned'
          }));
        } else if (activeModal === 'sections') {
          title = 'Academic Sections';
          columns = [
            { key: 'name', header: 'Section Name' },
            { key: 'semester', header: 'Semester' },
            { key: 'strength', header: 'Cohort Size' },
            { key: 'advisor', header: 'Class Advisor' },
            { key: 'room', header: 'Designated Homeroom' }
          ];
          items = sections.map(item => ({
            name: item.name,
            semester: `Semester ${item.semester}`,
            strength: `${item.strength} Students`,
            advisor: staffList.find(s => s.id === item.class_advisor_id)?.name || 'None',
            room: classroomsList.find(c => c.id === item.classroom_id)?.room_number || 'None'
          }));
        } else if (activeModal === 'classrooms') {
          title = 'Physical Classrooms';
          columns = [
            { key: 'room_number', header: 'Room No' },
            { key: 'building', header: 'Building Block' },
            { key: 'floor', header: 'Floor' },
            { key: 'capacity', header: 'Capacity' },
            { key: 'availability', header: 'Status' }
          ];
          items = classroomsList.map(item => ({
            room_number: item.room_number,
            building: item.building,
            floor: `${item.floor}th Floor`,
            capacity: `${item.capacity} Seats`,
            availability: item.is_available ? 'Active' : 'Reserved'
          }));
        } else if (activeModal === 'subjects') {
          title = 'Course Subjects';
          columns = [
            { key: 'code', header: 'Subject Code' },
            { key: 'name', header: 'Subject Name' },
            { key: 'credits', header: 'Credits' },
            { key: 'semester', header: 'Syllabus Semester' }
          ];
          items = subjectsList.map(item => ({
            code: item.code,
            name: item.name,
            credits: `${item.credits} Credits`,
            semester: `Semester ${item.semester}`
          }));
        }

        // Apply search filtration
        const filteredItems = items.filter(item =>
          Object.values(item).some(val =>
            String(val).toLowerCase().includes(modalSearch.toLowerCase())
          )
        );

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-opacity duration-300">
            <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-up">

              {/* Modal Header */}
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Showing {filteredItems.length} of {items.length} records</p>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-2 rounded-xl text-slate-450 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Search Bar */}
              <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/50 dark:bg-slate-950/20">
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search inside entries..."
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800/50 text-slate-800 dark:text-slate-100 placeholder-slate-400 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all text-sm"
                  />
                </div>
              </div>

              {/* Modal Table Container */}
              <div className="flex-1 overflow-y-auto p-6">
                {filteredItems.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800/60">
                    <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800/80">
                      <thead className="bg-slate-50 dark:bg-slate-950/50">
                        <tr>
                          {columns.map(col => (
                            <th key={col.key} scope="col" className="px-6 py-3.5 text-left text-xs font-semibold text-slate-650 dark:text-slate-400 uppercase tracking-wider">
                              {col.header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-transparent divide-y divide-slate-150 dark:divide-slate-850">
                        {filteredItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-850/20 transition-colors">
                            {columns.map(col => {
                              const val = item[col.key];
                              const isStatus = col.key === 'status' || col.key === 'availability';
                              const isStatusActive = val === 'Active' || val === 'Available';
                              return (
                                <td key={col.key} className="px-6 py-4 text-xs text-slate-705 dark:text-slate-300 font-medium">
                                  {isStatus ? (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isStatusActive
                                      ? 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                                      : 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                      }`}>
                                      {val}
                                    </span>
                                  ) : val}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-450 dark:text-slate-500">
                    <Search className="w-10 h-10 mb-3 text-slate-350 dark:text-slate-650" />
                    <p className="text-sm font-bold">No records match your query</p>
                    <p className="text-xs mt-1">Try spelling another keyword</p>
                  </div>
                )}
              </div>

            </div>
          </div>
        );
      })()}

    </div>
  );
};

export default Dashboard;

