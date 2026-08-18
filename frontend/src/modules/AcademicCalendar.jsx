import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { calendarApi, adminApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Plus,
  Trash2,
  X,
  BookOpen,
  AlertCircle,
  Coffee,
  Trophy,
  Megaphone,
  Flag,
  Upload,
} from 'lucide-react';

// ─── Official SRM Academic Calendar 2026-27 events (from approved PDF) ────────
const SEEDED_EVENTS = [
  // ── JUNE 2026 ──────────────────────────────────────────────────────────────
  { id: 1,  date: '2026-06-15', title: 'Course Enrolment (II & III Year UG & II Year PG)', type: 'event',        description: 'Course enrolment commences for II & III Year UG and II Year PG students.' },
  { id: 2,  date: '2026-06-17', title: 'Reopening for Faculty Members',                    type: 'announcement', description: 'Faculty members report back to campus after vacation.' },
  { id: 3,  date: '2026-06-22', title: 'Commencement of First Year Enrolment Process',     type: 'event',        description: 'First year UG & PG student enrolment process begins.' },
  { id: 4,  date: '2026-06-24', title: 'Commencement of Classes (II & III Year UG & II Year PG)', type: 'event', description: 'Classes commence for II & III Year UG and II Year PG students.' },
  { id: 5,  date: '2026-06-26', title: 'Moharam — Holiday',                                type: 'holiday',      description: 'National/Religious Holiday — No classes.' },
  { id: 6,  date: '2026-06-29', title: 'Course Enrolment (First Year UG & PG)',            type: 'event',        description: 'Course enrolment for First Year UG & PG students.' },

  // ── JULY 2026 ──────────────────────────────────────────────────────────────
  { id: 7,  date: '2026-07-08', title: 'Commencement of Classes — First Year UG & PG',    type: 'event',        description: 'Classes commence for all First Year UG & PG students.' },

  // ── AUGUST 2026 ────────────────────────────────────────────────────────────
  { id: 8,  date: '2026-08-04', title: 'Cycle Test – I (II & III Year UG & II Year PG)',   type: 'exam',         description: 'Internal Assessment / Cycle Test I for II & III Year UG & II Year PG (Except First Year).' },
  { id: 9,  date: '2026-08-05', title: 'Cycle Test – I (II & III Year UG & II Year PG)',   type: 'exam',         description: 'Cycle Test I continues — II & III Year UG & II Year PG (Except First Year).' },
  { id: 10, date: '2026-08-06', title: 'Cycle Test – I (II & III Year UG & II Year PG)',   type: 'exam',         description: 'Cycle Test I continues — II & III Year UG & II Year PG (Except First Year).' },
  { id: 11, date: '2026-08-07', title: 'Cycle Test – I (II & III Year UG & II Year PG)',   type: 'exam',         description: 'Cycle Test I continues — II & III Year UG & II Year PG (Except First Year).' },
  { id: 12, date: '2026-08-11', title: 'Cycle Test – I (First Year UG & PG)',              type: 'exam',         description: 'Internal Assessment / Cycle Test I for First Year UG & PG students.' },
  { id: 13, date: '2026-08-12', title: 'Cycle Test – I (First Year UG & PG)',              type: 'exam',         description: 'Cycle Test I continues — First Year UG & PG students.' },
  { id: 14, date: '2026-08-13', title: 'Cycle Test – I (First Year UG & PG)',              type: 'exam',         description: 'Cycle Test I continues — First Year UG & PG students.' },
  { id: 15, date: '2026-08-14', title: 'Cycle Test – I (First Year UG & PG)',              type: 'exam',         description: 'Cycle Test I continues — First Year UG & PG students.' },
  { id: 16, date: '2026-08-15', title: 'Independence Day — Holiday',                       type: 'holiday',      description: 'National Holiday — No classes on Independence Day.' },
  { id: 17, date: '2026-08-17', title: 'Question Paper Setting Last Date (SRMIST Exams)', type: 'announcement', description: 'Last date for question paper setting for all SRMIST IST Examinations — ALL UG & PG.' },
  { id: 18, date: '2026-08-26', title: 'Miladi Nabi — Holiday',                            type: 'holiday',      description: 'Religious Holiday — Prophet\'s Birthday. No classes.' },

  // ── SEPTEMBER 2026 ─────────────────────────────────────────────────────────
  { id: 19, date: '2026-09-05', title: "Teachers' Day — Holiday",                          type: 'holiday',      description: 'Teachers\' Day celebration. Holiday for all.' },
  { id: 20, date: '2026-09-14', title: 'Vinayagar Chathurthi — Holiday',                   type: 'holiday',      description: 'Vinayagar Chathurthi festival. National/Regional Holiday.' },
  { id: 21, date: '2026-09-15', title: 'Cycle Test – II (II & III Year UG & II Year PG)',  type: 'exam',         description: 'Cycle Test II begins for II & III Year UG & II Year PG (Except First Year).' },
  { id: 22, date: '2026-09-16', title: 'Cycle Test – II (II & III Year UG & II Year PG)',  type: 'exam',         description: 'Cycle Test II continues.' },
  { id: 23, date: '2026-09-17', title: 'Cycle Test – II (II & III Year UG & II Year PG)',  type: 'exam',         description: 'Cycle Test II continues.' },
  { id: 24, date: '2026-09-18', title: 'Cycle Test – II (II & III Year UG & II Year PG)',  type: 'exam',         description: 'Cycle Test II continues.' },
  { id: 25, date: '2026-09-21', title: 'Cycle Test – II (First Year UG & PG)',             type: 'exam',         description: 'Cycle Test II for First Year UG & PG students.' },
  { id: 26, date: '2026-09-22', title: 'Cycle Test – II (First Year UG & PG)',             type: 'exam',         description: 'Cycle Test II continues — First Year UG & PG.' },
  { id: 27, date: '2026-09-23', title: 'Commencement of Model Practical Examination (II & III Year UG & II Year PG)', type: 'exam', description: 'Model Practical Exam begins for II & III Year UG & II Year PG.' },
  { id: 28, date: '2026-09-25', title: 'Commencement of Model Practical Examination (First Year UG & PG)', type: 'exam', description: 'Model Practical Exam commences for First Year UG & PG students.' },
  { id: 29, date: '2026-09-28', title: 'Model Practical Examination',                      type: 'exam',         description: 'Model Practical Examination continues for all UG & PG.' },
  { id: 30, date: '2026-09-29', title: 'Model Practical Examination',                      type: 'exam',         description: 'Model Practical Examination continues.' },
  { id: 31, date: '2026-09-30', title: 'Model Practical Examination',                      type: 'exam',         description: 'Model Practical Examination continues.' },

  // ── OCTOBER 2026 ───────────────────────────────────────────────────────────
  { id: 32, date: '2026-10-01', title: 'Model Practical Examination',                      type: 'exam',         description: 'Model Practical Examination continues.' },
  { id: 33, date: '2026-10-02', title: 'Gandhi Jayanthi — Holiday',                        type: 'holiday',      description: 'National Holiday — Gandhi Jayanthi. No classes.' },
  { id: 34, date: '2026-10-05', title: 'Model Practical Examination',                      type: 'exam',         description: 'Model Practical Examination continues.' },
  { id: 35, date: '2026-10-06', title: 'Commencement of Model Theory Examination (II & III Year UG & II Year PG)', type: 'exam', description: 'Model Theory Examination commences for II & III Year UG & II Year PG.' },
  { id: 36, date: '2026-10-08', title: 'Commencement of Model Theory Examination (First Year UG & PG)', type: 'exam', description: 'Model Theory Examination commences for First Year UG & PG.' },
  { id: 37, date: '2026-10-14', title: 'University Practical / Project Viva Voce Examination (ALL UG & PG, Except First Year)', type: 'exam', description: 'Commencement of University Practical / Project Viva Voce Examination.' },
  { id: 38, date: '2026-10-16', title: 'University Practical / Project Viva Voce Examination (First Year UG & PG) — Last Working Day', type: 'exam', description: 'University Practical / Project Viva Voce Examination for First Year. Also Last Working Day for First Year.' },
  { id: 39, date: '2026-10-19', title: 'Saraswathi Pooja — Holiday',                       type: 'holiday',      description: 'Saraswathi Pooja Festival Holiday.' },
  { id: 40, date: '2026-10-20', title: 'Vijayadasami — Holiday',                           type: 'holiday',      description: 'Vijayadasami Festival Holiday. No classes.' },
  { id: 41, date: '2026-10-21', title: 'Detention List Submission / Practical Examination', type: 'announcement', description: 'Detention List Submission deadline. University Practical Examination also continues.' },
  { id: 42, date: '2026-10-26', title: 'Internal Marks Submission (ALL UG & PG)',          type: 'announcement', description: 'Last date for Internal Marks Submission for all UG & PG programmes.' },

  // ── NOVEMBER 2026 ──────────────────────────────────────────────────────────
  { id: 43, date: '2026-11-02', title: 'Commencement of University Theory Examination (ALL UG & PG)', type: 'exam', description: 'End Semester University Theory Examinations begin for all UG & PG programmes.' },
  { id: 44, date: '2026-11-03', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 45, date: '2026-11-04', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 46, date: '2026-11-05', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 47, date: '2026-11-06', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 48, date: '2026-11-08', title: 'Deepawali — Holiday',                              type: 'holiday',      description: 'Deepawali Festival Holiday. No examinations.' },
  { id: 49, date: '2026-11-10', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations resume after Deepawali.' },
  { id: 50, date: '2026-11-11', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 51, date: '2026-11-12', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 52, date: '2026-11-13', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 53, date: '2026-11-14', title: 'End Semester Theory Examination (ALL UG & PG)',    type: 'exam',         description: 'End Semester Theory Examinations continue.' },
  { id: 54, date: '2026-11-16', title: 'Commencement of Central Valuation',                type: 'announcement', description: 'Answer scripts central valuation commences for all UG & PG programmes.' },
  { id: 55, date: '2026-11-20', title: 'Course Enrolment for Even Semester (ALL UG & PG)', type: 'event',        description: 'Course Enrolment opens for Even Semester for all UG & PG students.' },
  { id: 56, date: '2026-11-30', title: 'Commencement of Even Semester Classes (ALL UG & PG)', type: 'event',     description: 'Even Semester classes begin for all UG & PG programmes.' },

  // ── DECEMBER 2026 ──────────────────────────────────────────────────────────
  // (Regular working days, weekends are holidays — no specific named events in Dec)

  // ── JANUARY 2027 ─────────────────────────────────────────────────────────
  { id: 57, date: '2027-01-19', title: 'Cycle Test – I (Even Semester)',                   type: 'exam',         description: 'Cycle Test I for Even Semester — All UG & PG.' },
  { id: 58, date: '2027-01-29', title: 'Question Paper Setting Last Date (Even Semester SRM IST Exams)', type: 'announcement', description: 'Last date for question paper setting for Even Semester SRMIST Examinations.' },

  // ── MARCH 2027 ───────────────────────────────────────────────────────────
  { id: 59, date: '2027-03-02', title: 'Cycle Test – II (Even Semester)',                  type: 'exam',         description: 'Cycle Test II for Even Semester — All UG & PG.' },
  { id: 60, date: '2027-03-09', title: 'Commencement of Model Practical Examinations (Even Sem)', type: 'exam',  description: 'Model Practical Examinations commence for Even Semester.' },
  { id: 61, date: '2027-03-24', title: 'Commencement of Model Theory Examination (Even Sem)', type: 'exam',      description: 'Model Theory Examinations commence for Even Semester.' },

  // ── APRIL 2027 ───────────────────────────────────────────────────────────
  { id: 62, date: '2027-04-02', title: 'Last Working Day (Even Semester)',                  type: 'announcement', description: 'Last working day for Even Semester 2026-27.' },
  { id: 63, date: '2027-04-05', title: 'Detention List Submission (Even Semester)',         type: 'announcement', description: 'Detention list submission deadline for Even Semester.' },
  { id: 64, date: '2027-04-05', title: 'University Practical Examination (Even Semester)',  type: 'exam',         description: 'Commencement of University Practical / Project Viva Voce Examinations — Even Semester.' },
  { id: 65, date: '2027-04-09', title: 'Internal Marks Submission (Even Semester)',         type: 'announcement', description: 'Last date for Internal Marks Submission for Even Semester.' },
  { id: 66, date: '2027-04-20', title: 'Commencement of University Theory Examination (Even Sem)', type: 'exam', description: 'End Semester University Theory Examinations begin for Even Semester 2026-27.' },

  // ── MAY 2027 ─────────────────────────────────────────────────────────────
  { id: 67, date: '2027-05-05', title: 'Commencement of Central Valuation (Even Semester)', type: 'announcement', description: 'Central Valuation of answer scripts begins for Even Semester.' },
];


// ─── Event type config ────────────────────────────────────────────────────────
const EVENT_TYPES = {
  holiday:      { label: 'Holiday',      icon: Flag,     bg: 'bg-red-500/10',    border: 'border-red-500/30',    text: 'text-red-600 dark:text-red-400',         dot: 'bg-red-500'    },
  exam:         { label: 'Exam',         icon: BookOpen, bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-600 dark:text-amber-400',      dot: 'bg-amber-500'  },
  event:        { label: 'Event',        icon: Trophy,   bg: 'bg-brand-500/10',  border: 'border-brand-500/30',  text: 'text-brand-600 dark:text-brand-400',      dot: 'bg-brand-500'  },
  announcement: { label: 'Announcement', icon: Megaphone,bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-600 dark:text-violet-400',    dot: 'bg-violet-500' },
};

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toDateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay();
}

// ─── Build Day Order Map ─────────────────────────────────────────────────────
// Day Order cycles I→II→III→IV→V on every working day (Mon–Fri), skipping
// holidays. Starts June 24, 2026 (Day Order I) per the approved PDF.
const OFFICIAL_HOLIDAYS = new Set([
  // June 2026
  '2026-06-20','2026-06-21','2026-06-26','2026-06-27','2026-06-28',
  // July 2026
  '2026-07-04','2026-07-05','2026-07-11','2026-07-12',
  '2026-07-18','2026-07-19','2026-07-25','2026-07-26',
  // August 2026
  '2026-08-01','2026-08-02','2026-08-08','2026-08-09',
  '2026-08-15', // Independence Day
  '2026-08-22','2026-08-23',
  '2026-08-26', // Miladi Nabi
  '2026-08-29','2026-08-30',
  // September 2026
  '2026-09-05', // Teachers Day
  '2026-09-06','2026-09-07','2026-09-12','2026-09-13',
  '2026-09-14', // Vinayagar Chathurthi
  '2026-09-19','2026-09-20','2026-09-26','2026-09-27',
  // October 2026
  '2026-10-02', // Gandhi Jayanthi
  '2026-10-03','2026-10-04','2026-10-10','2026-10-11',
  '2026-10-17','2026-10-18',
  '2026-10-19', // Saraswathi Pooja
  '2026-10-20', // Vijayadasami
  '2026-10-24','2026-10-25','2026-10-31',
  // November 2026 (exam period — no regular classes)
  '2026-11-01','2026-11-07',
  '2026-11-08', // Deepawali
  '2026-11-15','2026-11-22','2026-11-28','2026-11-29',
  // December 2026
  '2026-12-05','2026-12-06','2026-12-12','2026-12-13',
  '2026-12-19','2026-12-20','2026-12-25','2026-12-26',
  // January 2027
  '2027-01-01', // New Year
  '2027-01-14', // Pongal
  '2027-01-15', // Thiruvalluvar Day
  '2027-01-16', // Uzhavar Thirunal
  '2027-01-26', // Republic Day
  // February 2027
  '2027-02-14',
  // March 2027
  '2027-03-17', // Holi
  '2027-03-30', // Ram Navami
  // April 2027
  '2027-04-14', // Tamil New Year / Ambedkar Jayanthi
]);

function buildDayOrderMap() {
  const dayOrders = ['I', 'II', 'III', 'IV', 'V'];
  const map = {};

  // Helper: local-time date string (avoids UTC offset issues in IST)
  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Classes start June 24, 2026 (Day Order I) — per approved PDF
  // Day Order runs ONLY Mon–Fri (not Saturday or Sunday)
  let current = new Date(2026, 5, 24); // June 24 2026 in local time
  const end   = new Date(2027, 5, 30); // June 30 2027
  let orderIdx = 0;

  while (current <= end) {
    const dateStr   = localDateStr(current);
    const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat

    // Only Mon–Fri (1–5) that are not official holidays
    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !OFFICIAL_HOLIDAYS.has(dateStr)) {
      map[dateStr] = dayOrders[orderIdx % 5];
      orderIdx++;
    }

    current.setDate(current.getDate() + 1);
  }
  return map;
}


const DAY_ORDER_MAP = buildDayOrderMap();

// Day Order badge colours
const DO_COLORS = {
  'I':   'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-400/30',
  'II':  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-400/30',
  'III': 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-400/30',
  'IV':  'bg-rose-500/15 text-rose-700 dark:text-rose-300 ring-1 ring-rose-400/30',
  'V':   'bg-violet-500/15 text-violet-700 dark:text-violet-300 ring-1 ring-violet-400/30',
};


export default function AcademicCalendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const today = new Date();
  const [year, setYear]         = useState(today.getFullYear());
  const [month, setMonth]       = useState(today.getMonth());
  const [events, setEvents]     = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterType, setFilterType]     = useState('all');

  // Load calendar events from backend
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const data = await calendarApi.getEvents();
        if (data && data.length > 0) {
          setEvents(data);
        } else {
          setEvents(SEEDED_EVENTS);
        }
      } catch (err) {
        console.error("Failed to load academic calendar events", err);
        setEvents(SEEDED_EVENTS);
      }
    };
    fetchEvents();
  }, []);

  // New event form state
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType]   = useState('event');
  const [newDesc, setNewDesc]   = useState('');
  const [newDate, setNewDate]   = useState('');

  // ── Navigation
  const prevMonth = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  // ── Build calendar grid
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);
  const calendarCells = useMemo(() => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [year, month, daysInMonth, firstDay]);

  // ── Event map
  const eventMap = useMemo(() => {
    const map = {};
    events.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [events]);

  const selectedEvents = selectedDate ? (eventMap[selectedDate] || []) : [];

  // ── Upcoming events list
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const upcomingEvents = useMemo(() => {
    return events
      .filter(ev => ev.date >= todayStr)
      .filter(ev => filterType === 'all' || ev.type === filterType)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [events, filterType, todayStr]);

  // ── Add event
  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;
    try {
      const newEv = await calendarApi.createEvent({
        date: newDate,
        title: newTitle.trim(),
        type: newType,
        description: newDesc.trim()
      });
      setEvents(prev => [...prev, newEv]);
      setNewTitle(''); setNewType('event'); setNewDesc(''); setNewDate('');
      setShowAddModal(false);
    } catch (err) {
      alert("Failed to add event to database.");
    }
  };

  // ── Delete event
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await calendarApi.deleteEvent(id);
      setEvents(prev => prev.filter(ev => ev.id !== id));
    } catch (err) {
      alert("Failed to delete event from database.");
    }
  };

  // Import calendar from Excel/CSV file
  const handleImportCalendar = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const res = await adminApi.importResource('calendar', file);
      // Reload events from database
      const data = await calendarApi.getEvents();
      setEvents(data);
      alert(`Import Successful: ${res.message}`);
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to import calendar events. Please check sheet headers.");
    } finally {
      e.target.value = null;
    }
  };

  // Clear all calendar events
  const handleClearCalendar = async () => {
    if (!window.confirm("Are you sure you want to clear ALL academic calendar events? This cannot be undone.")) {
      return;
    }
    try {
      await calendarApi.clearEvents();
      setEvents([]);
      alert("All calendar events have been cleared.");
    } catch (err) {
      alert("Failed to clear calendar events.");
    }
  };

  const todayDate = today.getDate();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Academic Calendar</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Holidays, exams &amp; important campus events</p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* Hidden File Input for Excel/CSV Import */}
            <input
              type="file"
              id="calendar-file-upload"
              accept=".csv, .xlsx, .xls"
              className="hidden"
              onChange={handleImportCalendar}
            />
            
            <label
              htmlFor="calendar-file-upload"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-250 dark:border-slate-850 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold shadow-sm transition-all cursor-pointer select-none"
            >
              <Upload className="w-4 h-4 text-slate-500" />
              Import Events
            </label>

            <button
              onClick={handleClearCalendar}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 dark:border-red-950/40 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/15 text-sm font-bold shadow-sm transition-all active:scale-[0.98]"
            >
              <Trash2 className="w-4 h-4" />
              Clear Calendar
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white text-sm font-bold shadow-md hover:shadow-brand-500/25 transition-all active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Add Event
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(EVENT_TYPES).map(([key, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
              <Icon className="w-3.5 h-3.5" />
              {cfg.label}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ── Calendar Grid ── */}
        <div className="xl:col-span-2 glass-panel rounded-2xl p-5 border border-slate-200 dark:border-slate-800/80">

          {/* Month navigator */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {MONTHS[month]} {year}
            </h3>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className={`text-center text-[11px] font-bold uppercase py-1.5 ${d === 'Sun' || d === 'Sat' ? 'text-rose-400 dark:text-rose-500' : 'text-slate-400 dark:text-slate-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} />;

              const dateStr     = toDateStr(year, month, day);
              const cellEvents  = eventMap[dateStr] || [];
              const isToday     = day === todayDate && month === today.getMonth() && year === today.getFullYear();
              const isSelected  = dateStr === selectedDate;
              const dayOfWeek   = (firstDay + day - 1) % 7;
              const isWeekend   = dayOfWeek === 0 || dayOfWeek === 6;

              const dayOrder    = DAY_ORDER_MAP[dateStr];
              const doColor     = dayOrder ? (isSelected ? 'bg-white/20 text-white ring-1 ring-white/30' : DO_COLORS[dayOrder]) : null;

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`relative rounded-xl p-1 min-h-[56px] flex flex-col items-center transition-all duration-150
                    ${isSelected
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/30 ring-2 ring-brand-300/50'
                      : isToday
                        ? 'bg-brand-500/10 ring-2 ring-brand-500/50'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'}
                    ${isWeekend && !isSelected && !isToday ? 'text-rose-500 dark:text-rose-400' : !isSelected && !isToday ? 'text-slate-800 dark:text-slate-200' : ''}
                  `}
                >
                  {/* Day number */}
                  <span className={`text-[11px] font-bold leading-none ${isToday && !isSelected ? 'text-brand-600 dark:text-brand-400' : ''}`}>
                    {day}
                  </span>

                  {/* Day Order badge */}
                  {dayOrder && (
                    <span className={`mt-0.5 text-[9px] font-black leading-none px-1 py-0.5 rounded ${doColor}`}>
                      DO-{dayOrder}
                    </span>
                  )}

                  {/* Event dots */}
                  <div className="flex flex-wrap justify-center gap-[2px] mt-0.5">
                    {cellEvents.slice(0, 3).map(ev => (
                      <span
                        key={ev.id}
                        className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : EVENT_TYPES[ev.type]?.dot || 'bg-slate-400'}`}
                      />
                    ))}
                    {cellEvents.length > 3 && (
                      <span className={`text-[8px] font-black leading-none ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                        +{cellEvents.length - 3}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected-date event panel */}
          <AnimatePresence>
            {selectedDate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </h4>
                      {DAY_ORDER_MAP[selectedDate] && (
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg ${DO_COLORS[DAY_ORDER_MAP[selectedDate]]}`}>
                          Day Order {DAY_ORDER_MAP[selectedDate]}
                        </span>
                      )}
                    </div>
                    <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>


                  {selectedEvents.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 py-4 justify-center">
                      <Coffee className="w-4 h-4" /> No events scheduled for this day.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedEvents.map(ev => {
                        const cfg  = EVENT_TYPES[ev.type];
                        const Icon = cfg?.icon || AlertCircle;
                        return (
                          <div key={ev.id} className={`flex items-start gap-3 p-3 rounded-xl border ${cfg?.bg} ${cfg?.border}`}>
                            <div className={`mt-0.5 shrink-0 ${cfg?.text}`}><Icon className="w-4 h-4" /></div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-sm ${cfg?.text}`}>{ev.title}</p>
                              {ev.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ev.description}</p>}
                            </div>
                            {isAdmin && (
                              <button onClick={() => handleDelete(ev.id)} className="text-slate-400 hover:text-red-500 transition-colors shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Upcoming Events List ── */}
        <div className="glass-panel rounded-2xl border border-slate-200 dark:border-slate-800/80 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-4 h-4 text-brand-500" />
              <h3 className="font-black text-slate-900 dark:text-white text-sm">Upcoming Events</h3>
            </div>
            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${filterType === 'all' ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
              >All</button>
              {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setFilterType(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${filterType === key ? `${cfg.bg} ${cfg.text} ring-1 ${cfg.border}` : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-y-auto flex-1 p-3 space-y-2 max-h-[480px]">
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                No upcoming events found.
              </div>
            ) : (
              upcomingEvents.map(ev => {
                const cfg    = EVENT_TYPES[ev.type];
                const Icon   = cfg?.icon || AlertCircle;
                const evDate = new Date(ev.date + 'T00:00:00');
                return (
                  <motion.div
                    key={ev.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer hover:scale-[1.01] transition-transform ${cfg?.bg} ${cfg?.border}`}
                    onClick={() => {
                      setYear(evDate.getFullYear());
                      setMonth(evDate.getMonth());
                      setSelectedDate(ev.date);
                    }}
                  >
                    <div className={`mt-0.5 shrink-0 ${cfg?.text}`}><Icon className="w-4 h-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-xs ${cfg?.text} truncate`}>{ev.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                        {evDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {DAY_ORDER_MAP[ev.date] && (
                          <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${DO_COLORS[DAY_ORDER_MAP[ev.date]]}`}>
                            DO-{DAY_ORDER_MAP[ev.date]}
                          </span>
                        )}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(ev.id); }}
                        className="text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Add Event Modal ── */}
      <AnimatePresence>
        {showAddModal && isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 relative"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-black text-slate-900 dark:text-white text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-brand-500" /> Add Calendar Event
                </h3>
                <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Event Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Internal Assessment 3"
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Date *</label>
                    <input
                      type="date"
                      required
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Type *</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-all"
                    >
                      {Object.entries(EVENT_TYPES).map(([key, cfg]) => (
                        <option key={key} value={key}>{cfg.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Description</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Optional details about this event..."
                    rows={3}
                    className="w-full bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-all resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-sm shadow-md hover:shadow-brand-500/25 transition-all active:scale-[0.98]"
                  >
                    Add Event
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
