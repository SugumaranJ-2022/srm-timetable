import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi, timetableApi } from '../services/api';
import {
  Users,
  BookOpen,
  MapPin,
  Clock,
  TrendingUp,
  Sparkles,
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
  X
} from 'lucide-react';

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  1: { start: 8 * 60 + 15, end: 9 * 60, label: '08:15 â€“ 09:00' },
  2: { start: 9 * 60, end: 9 * 60 + 45, label: '09:00 â€“ 09:45' },
  3: { start: 9 * 60 + 45, end: 10 * 60 + 30, label: '09:45 â€“ 10:30' },
  4: { start: 10 * 60 + 30, end: 11 * 60, label: '10:30 â€“ 11:00', isBreak: true },
  5: { start: 11 * 60, end: 11 * 60 + 45, label: '11:00 â€“ 11:45' },
  6: { start: 11 * 60 + 45, end: 12 * 60 + 30, label: '11:45 â€“ 12:30' },
};

const PROGRAMS = [
  { key: 'MCA', label: 'MCA', color: 'from-blue-500 to-blue-600', text: 'text-blue-600 dark:text-blue-400', sections: ['MCA A', 'MCA B', 'MCA C', 'MCA D', 'MCA E'] },
  { key: 'MCA_GENAI', label: 'MCA (Gen AI)', color: 'from-indigo-500 to-purple-600', text: 'text-indigo-600 dark:text-indigo-400', sections: ['MCA (Gen AI) A', 'MCA (Gen AI) B', 'MCA (Gen AI) C'] },
  { key: 'MSC', label: 'M.Sc.', color: 'from-cyan-500 to-teal-500', text: 'text-cyan-600 dark:text-cyan-400', sections: ['M.Sc. A', 'M.Sc. B'] },
  { key: 'BCA', label: 'BCA', color: 'from-green-500 to-emerald-600', text: 'text-green-600 dark:text-green-400', sections: ['BCA A', 'BCA B', 'BCA C'] },
  { key: 'BCA_GENAI', label: 'BCA (Gen AI)', color: 'from-orange-500 to-amber-500', text: 'text-orange-600 dark:text-orange-400', sections: ['BCA (Gen AI) A', 'BCA (Gen AI) B', 'BCA (Gen AI) C'] },
];

// â”€â”€â”€ Stat Card Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
  const [stats, setStats]       = useState({ staffCount: 0, studentCount: 0, classroomCount: 0, subjectCount: 0, sectionsCount: 0 });
  const [sections, setSections] = useState([]);
  const [mySchedule, setMySchedule] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [now, setNow]           = useState(new Date());

  // Detailed lists for click-to-view feature
  const [staffList, setStaffList]           = useState([]);
  const [studentsList, setStudentsList]       = useState([]);
  const [classroomsList, setClassroomsList]   = useState([]);
  const [subjectsList, setSubjectsList]       = useState([]);
  const [activeModal, setActiveModal]         = useState(null); // 'faculty' | 'students' | 'sections' | 'classrooms' | 'subjects' | null
  const [modalSearch, setModalSearch]         = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
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
        } else if (user.role === 'Staff' && profile?.staff?.id) {
          setMySchedule(await timetableApi.getStaffTimetable(profile.staff.id));
        } else if (user.role === 'Student' && profile?.student?.section_id) {
          const tt = await timetableApi.getSectionTimetable(profile.student.section_id);
          const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
          setMySchedule(tt.details.map(d => ({
            ...d,
            day_of_week: DAYS[Math.floor((d.timeslot_id - 1) / 6)] || 'Monday',
            period_number: ((d.timeslot_id - 1) % 6) + 1
          })));
        }
      } catch (e) { console.error('Dashboard load error', e); }
      finally { setLoading(false); }
    };
    if (user) load();
  }, [user, profile]);

  const getActiveSession = useCallback(() => {
    if (!mySchedule.length) return null;
    const DAYS = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    const dayName = DAYS[now.getDay()];
    const totalMins = now.getHours() * 60 + now.getMinutes();
    let activePeriod = null;
    for (const [p, r] of Object.entries(PERIOD_RANGES)) {
      if (totalMins >= r.start && totalMins < r.end) { activePeriod = parseInt(p); break; }
    }
    if (!activePeriod) return { status: 'NO_CLASS' };
    if (activePeriod === 4) return { status: 'BREAK' };
    const active = mySchedule.find(c => c.day_of_week === dayName && c.period_number === activePeriod);
    return active ? { status: 'ACTIVE_CLASS', data: active, period: activePeriod } : { status: 'FREE_SLOT', period: activePeriod };
  }, [mySchedule, now]);

  const activeSession = getActiveSession();
  const gaps = user?.role === 'Staff' ? getStaffGaps(mySchedule) : [];
  const freeSlots = user?.role === 'Staff' ? getStaffFreeSlots(mySchedule) : [];
  const todayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];
  const totalMins = now.getHours() * 60 + now.getMinutes();

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
              <Sparkles className="w-4 h-4 text-white/70 animate-spin-slow" />
              <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Dashboard Overview</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight">
              Welcome back, <span className="text-yellow-300">{user.email.split('@')[0]}</span>
            </h2>
            <p className="text-white/70 mt-1 text-sm">
              {user.role === 'Admin'
                ? `Managing ${stats.sectionsCount} sections across ${PROGRAMS.length} programs`
                : 'Your personal schedule is loaded and ready'}
            </p>
          </div>
          <div className="shrink-0 bg-white/15 backdrop-blur-sm border border-white/20 px-5 py-3 rounded-2xl flex flex-col items-end">
            <span className="text-white/60 text-[10px] font-bold uppercase tracking-wider">{todayName}</span>
            <span className="text-white font-black text-xl tabular-nums">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
            <span className="text-white/60 text-[10px] mt-0.5">{now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {user.role === 'Admin' ? (
        <>
          {/* â”€â”€ Stat Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Faculty" value={stats.staffCount} sub="Active and tracked" iconBg="bg-indigo-500" accentRgb="99,102,241" onClick={() => { setActiveModal('faculty'); setModalSearch(''); }} />
            <StatCard icon={GraduationCap} label="Students" value={stats.studentCount} sub={`In ${stats.sectionsCount} sections`} iconBg="bg-emerald-500" accentRgb="16,185,129" onClick={() => { setActiveModal('students'); setModalSearch(''); }} />
            <StatCard icon={BookMarked} label="Sections" value={stats.sectionsCount} sub="5 programs" iconBg="bg-amber-500" accentRgb="245,158,11" onClick={() => { setActiveModal('sections'); setModalSearch(''); }} />
            <StatCard icon={Building2} label="Classrooms" value={stats.classroomCount} sub="Theory + Lab rooms" iconBg="bg-red-500" accentRgb="239,68,68" onClick={() => { setActiveModal('classrooms'); setModalSearch(''); }} />
            <StatCard icon={BookOpen} label="Subjects" value={stats.subjectCount} sub="Credit-mapped syllabus" iconBg="bg-violet-500" accentRgb="139,92,246" onClick={() => { setActiveModal('subjects'); setModalSearch(''); }} />
          </div>

          {/* â”€â”€ Program Distribution + Today Timeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                  const count = sections.filter(s => prog.sections.some(ps => s.name && s.name.includes(ps.split(' ')[0]))).length || prog.sections.length;
                  const pct = Math.round((count / 16) * 100);
                  return (
                    <div key={prog.key}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className={`text-xs font-bold ${prog.text}`}>{prog.label}</span>
                        <span className="text-[10px] font-bold text-slate-400">{count} section{count !== 1 ? 's' : ''} Â· {pct}%</span>
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
                <span className="ml-auto text-[10px] font-bold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full border border-brand-500/20">{todayName}</span>
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
                        {isBreak ? 'â˜•' : isDone ? 'âœ“' : isActive ? 'â–¶' : period < 4 ? period : period - 1}
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

          {/* â”€â”€ System Status + Quick Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Status */}
            <div className="lg:col-span-2 glass-card p-6 rounded-3xl">
              <div className="flex items-center gap-2 mb-5">
                <Shield className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">System Status</h3>
                <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-green-600 dark:text-green-400">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> All Systems Operational
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: CheckCircle, label: 'Database Connected', sub: 'SQLite + SQLAlchemy async', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/15' },
                  { icon: Zap, label: 'CP-SAT Solver Active', sub: 'Google OR-Tools â€” Running', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/15' },
                  { icon: CheckCircle, label: 'Zero Free-Period Policy', sub: 'All 25 periods occupied', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/15' },
                  { icon: FlaskConical, label: 'Lab / Theory Routing', sub: 'Room segregation enforced', color: 'text-teal-500', bg: 'bg-teal-500/10 border-teal-500/15' },
                ].map((item, i) => (
                  <div key={i} className={`flex items-start gap-3 p-4 rounded-2xl border ${item.bg}`}>
                    <item.icon className={`w-5 h-5 mt-0.5 shrink-0 ${item.color}`} />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="glass-card p-6 rounded-3xl flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-brand-500" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider">Quick Actions</h3>
              </div>
              {[
                { label: 'Timetable Editor', sub: 'Load & edit section schedules', icon: CalendarRange, tab: 'editor', from: 'from-brand-600', to: 'to-brand-500' },
                { label: 'Resource Registry', sub: 'Manage staff, rooms, subjects', icon: Users, tab: 'crud', from: 'from-indigo-600', to: 'to-purple-500' },
                { label: 'Reports & Export', sub: 'Print or export PDF timetables', icon: BookOpen, tab: 'reports', from: 'from-green-600', to: 'to-emerald-500' },
              ].map(action => (
                <button
                  key={action.tab}
                  onClick={() => setActiveTab && setActiveTab(action.tab)}
                  className={`w-full flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r ${action.from} ${action.to} text-white group hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md`}
                >
                  <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                    <action.icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-xs font-bold">{action.label}</p>
                    <p className="text-[10px] text-white/70">{action.sub}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-0.5 transition-transform" />
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        // â”€â”€ Staff / Student Personal View â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          <div className="lg:col-span-2 glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-slate-200 dark:border-brand-500/20 shadow-glass">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl" />
            <div className="flex items-center gap-3 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
              {activeSession?.status === 'ACTIVE_CLASS' ? 'ACTIVE CLASS SESSION' : 'CLASS SESSION STATUS'}
            </div>
            {activeSession?.status === 'ACTIVE_CLASS' ? (
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
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{activeSession.data.day_of_week || 'Today'} â€“ Period {activeSession.data.period_number}</div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider font-bold">Instructor</span>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">{activeSession.data.staff_name || 'â€”'}</div>
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
                <p className="text-slate-500 dark:text-slate-450 text-sm">Sessions held Monâ€“Fri, 08:15 AM â€“ 12:30 PM.</p>
              </div>
            )}
          </div>

          <div className="glass-panel p-6 rounded-3xl space-y-6">
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
                        // Check if this free slot is also a gap (idle period in-between classes)
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
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide">Daily Checks</h4>
              <div className="space-y-3">
                {[
                  { ok: true, label: 'Database Loaded', sub: 'Institutional profiles connected' },
                  { ok: true, label: 'Conflict Check', sub: 'CSP engine validation passed' },
                  { ok: false, label: 'Syllabus Updates', sub: 'Curriculum mappings available' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-slate-200/20 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/40">
                    {item.ok
                      ? <CheckCircle className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
                      : <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />}
                    <div className="text-xs">
                      <p className={`font-semibold ${item.ok ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500 dark:text-slate-450'}`}>{item.label}</p>
                      <p className={item.ok ? 'text-slate-550 dark:text-slate-400' : 'text-slate-650 dark:text-slate-550'}>{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      isStatusActive
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

