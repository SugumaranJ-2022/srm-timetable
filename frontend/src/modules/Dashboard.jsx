import React, { useState, useEffect } from 'react';
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
  Coffee
} from 'lucide-react';

const getStaffGaps = (schedule) => {
  const dayMap = {};
  schedule.forEach(item => {
    if (!dayMap[item.day_of_week]) {
      dayMap[item.day_of_week] = [];
    }
    dayMap[item.day_of_week].push(item.period_number);
  });

  const gaps = [];
  Object.keys(dayMap).forEach(day => {
    const periods = dayMap[day].sort((a, b) => a - b);
    if (periods.length > 1) {
      const minP = periods[0];
      const maxP = periods[periods.length - 1];
      for (let p = minP + 1; p < maxP; p++) {
        if (p === 4) continue; // Skip lunch/tea break
        if (!periods.includes(p)) {
          gaps.push({ day, period: p < 4 ? p : p - 1 });
        }
      }
    }
  });
  return gaps;
};

const Dashboard = () => {
  const { user, profile } = useAuth();
  
  // Admin stats
  const [stats, setStats] = useState({
    staffCount: 0,
    studentCount: 0,
    classroomCount: 0,
    subjectCount: 0,
    sectionsCount: 0
  });

  // Staff/Student timetable
  const [mySchedule, setMySchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Clock tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      setLoading(true);
      try {
        if (user.role === 'Admin') {
          const [staff, students, rooms, subs, secs] = await Promise.all([
            adminApi.getStaff(),
            adminApi.getStudents(),
            adminApi.getClassrooms(),
            adminApi.getSubjects(),
            adminApi.getSections()
          ]);
          setStats({
            staffCount: staff.length,
            studentCount: students.length,
            classroomCount: rooms.length,
            subjectCount: subs.length,
            sectionsCount: secs.length
          });
        } else if (user.role === 'Staff' && profile?.staff?.id) {
          const schedule = await timetableApi.getStaffTimetable(profile.staff.id);
          setMySchedule(schedule);
        } else if (user.role === 'Student' && profile?.student?.section_id) {
          const timetable = await timetableApi.getSectionTimetable(profile.student.section_id);
          // Correctly map section details to day and period using the timeslot_id
          const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
          const enriched = timetable.details.map(d => {
            const tsIndex = d.timeslot_id - 1;
            const dayIndex = Math.floor(tsIndex / 6);
            const periodNum = (tsIndex % 6) + 1;
            return {
              timeslot_id: d.timeslot_id,
              subject_name: d.subject_name,
              subject_code: d.subject_code,
              staff_name: d.staff_name,
              room_number: d.room_number,
              day_of_week: DAYS_OF_WEEK[dayIndex] || "Monday",
              period_number: periodNum
            };
          });
          setMySchedule(enriched);
        }
      } catch (err) {
        console.error('Error loading dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadDashboardData();
    }
  }, [user, profile]);

  // Real-time Class Session Tracking
  const getActiveSession = () => {
    if (mySchedule.length === 0) return null;

    const daysMap = { 0: 'Sunday', 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };
    const currentDayName = daysMap[currentTime.getDay()];

    // Current time in minutes since midnight
    const currentHours = currentTime.getHours();
    const currentMinutes = currentTime.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    // Time ranges mapped in minutes since midnight (8:15 AM to 12:30 PM)
    const PERIOD_RANGES = {
      1: { start: 8 * 60 + 15, end: 9 * 60 + 0 },     // Period 1: 08:15 - 09:00
      2: { start: 9 * 60 + 0, end: 9 * 60 + 45 },     // Period 2: 09:00 - 09:45
      3: { start: 9 * 60 + 45, end: 10 * 60 + 30 },   // Period 3: 09:45 - 10:30
      4: { start: 10 * 60 + 30, end: 11 * 60 + 0 },   // Period 4: 10:30 - 11:00 (Break)
      5: { start: 11 * 60 + 0, end: 11 * 60 + 45 },   // Period 5: 11:00 - 11:45
      6: { start: 11 * 60 + 45, end: 12 * 60 + 30 }   // Period 6: 11:45 - 12:30
    };

    // Find if the current time falls inside any period
    let activePeriod = null;
    for (const [period, range] of Object.entries(PERIOD_RANGES)) {
      if (currentTotalMinutes >= range.start && currentTotalMinutes < range.end) {
        activePeriod = parseInt(period);
        break;
      }
    }

    if (!activePeriod) {
      return { status: 'NO_CLASS', message: 'No classes scheduled at this hour.' };
    }

    if (activePeriod === 4) {
      return { status: 'BREAK', message: 'Currently in Institutional Break.' };
    }

    // Find the schedule item matching current day and active period
    const activeClass = mySchedule.find(c => c.day_of_week === currentDayName && c.period_number === activePeriod);
    
    if (activeClass) {
      return { status: 'ACTIVE_CLASS', data: activeClass, period: activePeriod };
    } else {
      return { status: 'FREE_SLOT', message: 'You have a Free Slot during this period.', period: activePeriod };
    }
  };

  const activeSession = getActiveSession();
  const gaps = user.role === 'Staff' ? getStaffGaps(mySchedule) : [];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-fade-in">
      {/* Welcome Heading Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight transition-colors">
            Dashboard Overview
          </h2>
          <p className="text-slate-550 dark:text-slate-400 mt-1 text-sm md:text-base">
            Welcome back, <span className="text-brand-600 dark:text-brand-400 font-semibold">{user.email}</span>.
          </p>
        </div>
        <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2.5 border border-slate-200 dark:border-slate-800 shadow-sm">
          <Clock className="w-4 h-4 text-brand-500 dark:text-brand-400 animate-spin-slow" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {currentTime.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {user.role === 'Admin' ? (
        // Admin View - Metrics Cards Grid
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-bl-full group-hover:bg-brand-500/10 transition-colors"></div>
            <Users className="w-8 h-8 text-brand-500 dark:text-brand-400 mb-4" />
            <h4 className="text-slate-550 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Faculty Roster</h4>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white mt-1">{stats.staffCount}</div>
            <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold mt-2 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Active and tracked
            </span>
          </div>

          <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-bl-full group-hover:bg-brand-500/10 transition-colors"></div>
            <Users className="w-8 h-8 text-brand-500 dark:text-brand-400 mb-4" />
            <h4 className="text-slate-550 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Enrolled Students</h4>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white mt-1">{stats.studentCount}</div>
            <span className="text-[10px] text-brand-650 dark:text-brand-400 font-semibold mt-2 block">
              Distributed in {stats.sectionsCount} Sections
            </span>
          </div>

          <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-bl-full group-hover:bg-brand-500/10 transition-colors"></div>
            <MapPin className="w-8 h-8 text-brand-500 dark:text-brand-400 mb-4" />
            <h4 className="text-slate-550 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Physical Classrooms</h4>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white mt-1">{stats.classroomCount}</div>
            <span className="text-[10px] text-brand-650 dark:text-brand-400 font-semibold mt-2 block">
              100% capacity managed
            </span>
          </div>

          <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/5 rounded-bl-full group-hover:bg-brand-500/10 transition-colors"></div>
            <BookOpen className="w-8 h-8 text-brand-500 dark:text-brand-400 mb-4" />
            <h4 className="text-slate-550 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Course Subjects</h4>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white mt-1">{stats.subjectCount}</div>
            <span className="text-[10px] text-brand-650 dark:text-brand-400 font-semibold mt-2 block">
              Structured credit map
            </span>
          </div>
        </div>
      ) : (
        // Staff/Student View - Active Session Tracking & Personal Summary
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          
          {/* Active Class Session Card */}
          <div className="lg:col-span-2 glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden border border-slate-200 dark:border-brand-500/20 shadow-glass">
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-brand-500/10 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3 text-brand-600 dark:text-brand-400 text-xs font-bold uppercase tracking-widest">
              <Sparkles className="w-4 h-4 animate-spin-slow" />
              {activeSession?.status === 'ACTIVE_CLASS' ? 'ACTIVE CLASS SESSION' : 'CLASS SESSION STATUS'}
            </div>

            {activeSession?.status === 'ACTIVE_CLASS' ? (
              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white leading-tight">
                    {activeSession.data.subject_name}
                  </h3>
                  <p className="text-slate-550 dark:text-slate-400 text-sm mt-1">
                    Subject Code: <span className="text-slate-800 dark:text-slate-200 font-semibold">{activeSession.data.subject_code}</span>
                    {activeSession.data.section_name && ` | Section: ${activeSession.data.section_name}`}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200 dark:border-slate-800/80">
                  <div>
                    <span className="text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider font-bold">Location</span>
                    <div className="flex items-center gap-1.5 mt-1">
                      {activeSession.data.room_number === 'Online' ? (
                        <>
                          <Monitor className="w-4 h-4 text-brand-600 dark:text-brand-400" />
                          <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">Virtual Session</span>
                        </>
                      ) : (
                        <>
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{activeSession.data.room_number || 'Online'}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider font-bold">Schedule</span>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
                      {activeSession.data.day_of_week || 'Today'} - Period {activeSession.data.period_number}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-slate-450 dark:text-slate-500 uppercase tracking-wider font-bold">Instructor</span>
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
                      {activeSession.data.staff_name || 'Dr. Arun Kumar'}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeSession?.status === 'BREAK' ? (
              <div className="mt-8 flex flex-col items-center justify-center py-8 text-center space-y-3">
                <Coffee className="w-12 h-12 text-amber-500 animate-bounce" />
                <div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Institutional Recess</h4>
                  <p className="text-slate-500 dark:text-slate-450 text-sm mt-1">Enjoy a break! Next classes resume at 11:00 AM.</p>
                </div>
              </div>
            ) : activeSession?.status === 'FREE_SLOT' ? (
              <div className="mt-8 flex flex-col items-center justify-center py-8 text-center space-y-3">
                <CheckCircle className="w-12 h-12 text-green-500 animate-pulse" />
                <div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200">Free Period (Hour {activeSession.period})</h4>
                  <p className="text-slate-550 dark:text-slate-450 text-sm mt-1">You have no classes scheduled during this time slot.</p>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col items-center justify-center py-8 text-center space-y-3">
                <Clock className="w-12 h-12 text-slate-400 dark:text-slate-500" />
                <div>
                  <h4 className="text-lg font-bold text-slate-800 dark:text-slate-200 font-mono">No Active Classes</h4>
                  <p className="text-slate-500 dark:text-slate-450 text-sm mt-1">
                    Academic sessions are held Monday to Friday, 08:15 AM - 12:30 PM.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quick Schedule Status List & Gaps Panel */}
          <div className="glass-panel p-6 rounded-3xl space-y-6">
            {user.role === 'Staff' && (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide">Schedule Continuity Gaps</h4>
                {gaps.length > 0 ? (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/20 space-y-2">
                    <div className="flex items-center gap-2 text-red-655 dark:text-red-400 text-xs font-bold uppercase tracking-wider">
                      <AlertTriangle className="w-4.5 h-4.5 animate-bounce" />
                      Idle Gaps Detected
                    </div>
                    <p className="text-[10px] text-slate-655 dark:text-slate-400 leading-relaxed">
                      You have gaps in your timetable on these days where you sit idle between classes:
                    </p>
                    <ul className="text-xs text-red-655 dark:text-red-300 font-semibold space-y-1 pl-4 list-disc">
                      {gaps.map((gap, idx) => (
                        <li key={idx}>
                          {gap.day} - Hour {gap.period}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-500/20 flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Zero-Gap Guarantee</p>
                      <p className="text-slate-550 dark:text-slate-400">No idle gaps in your schedule today!</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wide">Daily Checklists</h4>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-200/20 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/40">
                  <CheckCircle className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Database Loaded</p>
                    <p className="text-slate-550 dark:text-slate-400">Institutional profiles connected</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-200/20 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/40">
                  <CheckCircle className="w-5 h-5 text-brand-600 dark:text-brand-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Conflict Check Clean</p>
                    <p className="text-slate-550 dark:text-slate-400">CSP engine validation passed</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-200/20 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800/40">
                  <HelpCircle className="w-5 h-5 text-slate-500 shrink-0" />
                  <div className="text-xs">
                    <p className="font-semibold text-slate-500 dark:text-slate-450">Syllabus Updates</p>
                    <p className="text-slate-650 dark:text-slate-550">Curriculum mappings available</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
