import React from 'react';
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
  X
} from 'lucide-react';

const Sidebar = ({ activeTab, setActiveTab, isOpen, onClose }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  if (!user) return null;

  const adminMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'editor', label: 'Timetable Editor', icon: CalendarRange },
    { id: 'crud', label: 'Resource Registry', icon: Users },
    { id: 'reports', label: 'Reports & Export', icon: FileText },
  ];

  const staffMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'timetable', label: 'My Schedule', icon: CalendarRange },
  ];

  const studentMenu = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'timetable', label: 'Class Schedule', icon: CalendarRange },
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

      <aside className={`w-64 glass-panel min-h-screen flex flex-col border-r border-slate-200 dark:border-slate-800/80 fixed inset-y-0 left-0 z-50 transform lg:static lg:translate-x-0 transition-transform duration-350 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Heading */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-brand-500/20 p-2 rounded-lg border border-brand-500/30">
              <Sparkles className="w-6 h-6 text-brand-400 animate-pulse" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight text-slate-900 dark:text-white tracking-wide">
                Smart Timetable
              </h1>
              <span className="text-xs text-brand-400 font-medium">College ERP Platform</span>
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
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                  isActive 
                    ? 'bg-brand-600 text-white font-medium shadow-md shadow-brand-600/10' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <Icon className={`w-5 h-5 transition-transform duration-200 group-hover:scale-105 ${
                  isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-brand-400'
                }`} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Profile & Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/30 dark:bg-slate-950/20">
          
          {/* Theme Switch Panel */}
          <div className="flex items-center justify-between mb-4 p-2 rounded-xl bg-slate-200/40 dark:bg-slate-800/20 border border-slate-200 dark:border-slate-800/40">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 pl-1.5">Theme</span>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-yellow-400 shadow-sm border border-slate-200 dark:border-slate-800 hover:scale-105 transition-all flex items-center gap-1.5 text-xs font-bold"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4" />
                  Light
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-brand-500" />
                  Dark
                </>
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-200/50 dark:bg-slate-850/30 border border-slate-205 dark:border-slate-800/40">
            <div className="w-9 h-9 rounded-full bg-brand-600/30 flex items-center justify-center border border-brand-500/30 text-brand-300 font-semibold text-sm shrink-0">
              {user.email.substring(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{user.email}</p>
              <p className="text-[10px] text-brand-500 dark:text-brand-400 uppercase tracking-wider font-bold">{user.role}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 text-red-650 dark:text-red-400 hover:bg-red-500/10 hover:text-red-800 dark:hover:text-red-300 transition-all text-xs font-semibold"
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
