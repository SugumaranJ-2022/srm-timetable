import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  CalendarRange,
  Users,
  FileText,
  LogOut,
  Sparkles,
  Sun,
  Moon,
  X,
  Clock,
  CalendarDays,
  CalendarCheck
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const todayName = DAYS[now.getDay()];
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;

  if (!user) return null;

  const adminMenu = [
    { id: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
    { id: 'editor',     label: 'Timetable Editor',    icon: CalendarRange },
    { id: 'crud',       label: 'Resource Registry',   icon: Users },
    { id: 'reports',    label: 'Reports & Export',    icon: FileText },
    { id: 'calendar',   label: 'Academic Calendar',   icon: CalendarCheck },
  ];

  const staffMenu = [
    { id: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
    { id: 'timetable',  label: 'My Schedule',         icon: CalendarRange },
    { id: 'calendar',   label: 'Academic Calendar',   icon: CalendarCheck },
  ];

  const studentMenu = [
    { id: 'dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
    { id: 'timetable',  label: 'Class Schedule',      icon: CalendarRange },
    { id: 'calendar',   label: 'Academic Calendar',   icon: CalendarCheck },
  ];

  const getMenu = () => {
    if (user.role === 'Admin') return adminMenu;
    if (user.role === 'Staff') return staffMenu;
    return studentMenu;
  };

  return (
    <>
      {/* Mobile Drawer Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside className={`w-64 glass-panel min-h-screen flex flex-col border-r border-slate-200 dark:border-slate-800/80 fixed inset-y-0 left-0 z-50 transform lg:static lg:translate-x-0 transition-transform duration-350 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        {/* Brand Heading */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative shrink-0 w-12 h-12 rounded-xl overflow-hidden border border-brand-500/30 shadow-lg shadow-brand-500/20">
              <img
                src="/timetable_logo.png"
                alt="Timetable Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="font-extrabold text-base leading-tight text-slate-900 dark:text-white tracking-wide">
                SRM Timetable
              </h1>
              <p className="text-[10px] text-brand-400 font-semibold mt-0.5 tracking-wide">AI-Powered Scheduling</p>
            </div>
          </div>

          {/* Close Menu Button on Mobile/Tablet */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
          {getMenu().map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  onClose(); // Close sidebar drawer on mobile after clicking
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden ${isActive
                  ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold shadow-md shadow-brand-600/10'
                  : 'text-slate-650 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/40 hover:text-brand-600 dark:hover:text-brand-400 hover:translate-x-1.5'
                  }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-full" />
                )}
                <Icon className={`w-5 h-5 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-brand-500'
                  }`} />
                <span className="text-sm transition-transform duration-300">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Today's Date & Clock Card */}
        <div className="mx-4 mb-3 p-3 rounded-2xl bg-gradient-to-br from-brand-500/10 to-brand-600/5 border border-brand-500/20 dark:border-brand-500/15">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 text-brand-500" />
              <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-wider">Today</span>
            </div>
            <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              isWeekday
                ? 'bg-green-500/15 text-green-600 dark:text-green-400 border border-green-500/20'
                : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                isWeekday ? 'bg-green-500' : 'bg-amber-500'
              }`} />
              {isWeekday ? 'Class Day' : 'Weekend'}
            </span>
          </div>
          <p className="text-sm font-extrabold text-slate-800 dark:text-white">{todayName}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{dateStr}</p>
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-brand-500/10">
            <Clock className="w-3 h-3 text-brand-400" />
            <span className="text-[11px] font-bold text-brand-500 dark:text-brand-400 tabular-nums">{timeStr}</span>
          </div>
        </div>

        {/* Profile & Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/30 dark:bg-slate-950/20">

          {/* Theme Switch Panel */}
          <div className="flex items-center justify-between mb-4 p-3 rounded-2xl bg-slate-200/40 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/40">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-350">Theme</span>
            <button
              onClick={toggleTheme}
              className="relative w-14 h-7 rounded-full bg-slate-250 dark:bg-slate-950 p-1 transition-colors duration-300 border border-slate-300 dark:border-slate-800 focus:outline-none flex items-center"
            >
              {/* Sliding switch indicator */}
              <div
                className={`absolute w-5 h-5 rounded-full bg-brand-500 dark:bg-yellow-400 shadow-md transform transition-transform duration-300 flex items-center justify-center ${theme === 'dark' ? 'translate-x-7' : 'translate-x-0'
                  }`}
              >
                {theme === 'dark' ? (
                  <Moon className="w-3 h-3 text-slate-950" />
                ) : (
                  <Sun className="w-3 h-3 text-white" />
                )}
              </div>
              <div className="w-full flex justify-between px-1 text-slate-400 dark:text-slate-650 pointer-events-none">
                <Sun className="w-3.5 h-3.5" />
                <Moon className="w-3.5 h-3.5" />
              </div>
            </button>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-200/30 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/40 transition-all hover:bg-slate-200/50 dark:hover:bg-slate-900/50">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-md shadow-brand-500/10">
              {user.email.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate pr-1">{user.email}</p>
              <p className="text-[10px] text-brand-500 dark:text-brand-400 tracking-wider font-black uppercase mt-0.5">{user.role}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl border border-red-550/20 dark:border-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-500/15 hover:text-red-700 dark:hover:text-red-350 transition-all text-xs font-bold active:scale-[0.98] transition-transform duration-100"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
