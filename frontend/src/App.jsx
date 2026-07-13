import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import TimetableEditor from './modules/TimetableEditor';
import AdminCrud from './modules/AdminCrud';
import Reports from './modules/Reports';
import TimetableGrid from './components/TimetableGrid';
import { timetableApi } from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Menu,
  Sun,
  Moon,
  CheckCircle,
  X
} from 'lucide-react';

const bicycleVariants = {
  animate: {
    x: ["-15vw", "115vw", "115vw", "-15vw", "-15vw"],
    scaleX: [1, 1, -1, -1, 1],
    transition: {
      duration: 22,
      repeat: Infinity,
      ease: "linear",
      times: [0, 0.45, 0.5, 0.95, 1]
    }
  }
};

const leafVariants = (delay, duration, startLeft) => ({
  animate: {
    y: ["-10vh", "110vh"],
    x: [startLeft, startLeft + 100, startLeft - 50, startLeft],
    rotate: [0, 360],
    transition: {
      duration: duration,
      repeat: Infinity,
      ease: "linear",
      delay: delay
    }
  }
});

const AppContent = () => {
  const { user, role, profile, loading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Background slideshow index
  const [bgIndex, setBgIndex] = useState(0);
  const backgrounds = ['/srm_gate.png', '/srm_techpark.png'];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setBgIndex((prev) => (prev + 1) % backgrounds.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [prevUser, setPrevUser] = useState(null);
  const [logoutDetails, setLogoutDetails] = useState(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);

  React.useEffect(() => {
    if (user && !prevUser) {
      setShowWelcome(true);
      setShowLogoutMessage(false);
      setLogoutDetails(null);
    }
    if (!user && prevUser) {
      setLogoutDetails({
        email: prevUser.email,
        role: prevUser.role,
        time: new Date().toLocaleTimeString()
      });
      setShowLogoutMessage(true);
    }
    setPrevUser(user);
  }, [user, prevUser]);

  // Login states
  const [loginView, setLoginView] = useState('login'); // 'login' | 'forgot' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Student/Staff schedule variables
  const [studentTimetable, setStudentTimetable] = useState([]);
  const [timeslots, setTimeslots] = useState([]);

  // Fetch student timetable if not loaded yet
  React.useEffect(() => {
    const loadStudentData = async () => {
      if (user && role === 'Student' && profile?.student?.section_id) {
        try {
          const tt = await timetableApi.getSectionTimetable(profile.student.section_id);
          setStudentTimetable(tt.details);

          // Construct timeslots matrix
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
        } catch (e) {
          console.error(e);
        }
      }
    };
    loadStudentData();
  }, [user, role, profile]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setLoginError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070b13] flex justify-center items-center transition-colors duration-300">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-t-2 border-brand-500 animate-spin"></div>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-semibold tracking-wider animate-pulse">Initializing Portal...</p>
        </div>
      </div>
    );
  }

  // Not Logged In - Render Login Page
  if (!user) {
    return (
      <div className="min-h-screen relative flex justify-center items-center p-4 transition-colors duration-300 overflow-hidden select-none">

        {/* Slideshow background images with absolute fade-in/fade-out */}
        {backgrounds.map((bg, idx) => (
          <div
            key={bg}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
            style={{
              backgroundImage: `url('${bg}')`,
              opacity: bgIndex === idx ? 1 : 0,
              zIndex: 0
            }}
          ></div>
        ))}

        {/* Dynamic Light/Dark Overlay Mask */}
        <div className="absolute inset-0 bg-white/70 dark:bg-[#070b13]/85 backdrop-blur-[2px] transition-colors duration-300 z-10"></div>

        {/* Full-width Top Navigation Bar */}
        <header className="absolute top-0 left-0 right-0 w-full px-16 py-4 flex items-center justify-center z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 shadow-md transition-colors duration-300">
          {/* Centered Institution Name */}
          <span className="text-slate-850 dark:text-white font-black text-xs sm:text-sm md:text-lg lg:text-xl tracking-wider uppercase text-center truncate max-w-full px-4">
            SRM Institute of Science and Technology (KTR) Faculty of Science and Humanities
          </span>

          {/* Top-Right Theme Toggle (Absolutely positioned on the right) */}
          <div className="absolute right-6 top-1/2 -translate-y-1/2 shrink-0 z-10">
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-yellow-400 border border-slate-200/50 dark:border-slate-800/80 shadow-sm transition-all duration-300"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-brand-500" />}
            </button>
          </div>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm bg-white/75 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-xl relative z-20 overflow-hidden"
        >
          <AnimatePresence mode="wait">
            {loginView === 'login' ? (
              <motion.div
                key="login-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                {/* Header */}
                <div className="flex flex-col items-center mb-6 relative">
                  {/* SRM University Logo without White Bubble background wrapper */}
                  <img
                    src="/srm_logo.png"
                    alt="SRM Logo"
                    className="h-12 object-contain mb-4 filter dark:brightness-110"
                  />
                  <h1 className="text-3xl font-extrabold text-slate-850 dark:text-white tracking-wide text-center">
                    Sign In
                  </h1>
                </div>

                {/* Form */}
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  {showLogoutMessage && logoutDetails && (
                    <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs rounded-xl text-left relative">
                      <div className="font-bold mb-1 flex items-center gap-1.5 text-green-805 dark:text-green-300">
                        <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                        Logged Out Successfully
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                        Thank you for using the Smart Timetable ERP Portal. Your session has been safely closed.
                      </p>
                      <div className="text-[9px] text-slate-400 dark:text-slate-550 border-t border-green-500/10 pt-1.5 flex flex-wrap justify-between gap-1">
                        <span>Account: <span className="font-semibold text-slate-555 dark:text-slate-400">{logoutDetails.email}</span></span>
                        <span>Time: <span className="font-semibold text-slate-555 dark:text-slate-400">{logoutDetails.time}</span></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLogoutMessage(false)}
                        className="absolute top-2.5 right-2.5 text-slate-450 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {loginError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-650 dark:text-red-400 text-xs font-semibold rounded-xl text-center">
                      {loginError}
                    </div>
                  )}

                  <div className="space-y-3.5">
                    {/* Username Input */}
                    <input
                      type="email"
                      required
                      placeholder="Username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setShowLogoutMessage(false);
                      }}
                      className="w-full bg-white dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-800/80 py-3.5 px-5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 text-sm font-semibold transition-all shadow-sm"
                    />

                    {/* Password Input */}
                    <input
                      type="password"
                      required
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setShowLogoutMessage(false);
                      }}
                      className="w-full bg-white dark:bg-slate-950/40 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-550 border border-slate-200 dark:border-slate-800/80 py-3.5 px-5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500 text-sm font-semibold transition-all shadow-sm"
                    />
                  </div>

                  {/* Login Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full mt-2 py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all text-sm shadow-md hover:shadow-brand-500/20 active:scale-[0.98] transition-transform duration-100"
                  >
                    Login
                  </button>
                </form>

                {/* Forget Password & Signup Links */}
                <div className="flex items-center justify-between px-1 mt-4 text-xs font-bold text-slate-500 dark:text-slate-350 select-none">
                  <button
                    onClick={() => {
                      setLoginError('');
                      setLoginView('forgot');
                      setShowLogoutMessage(false);
                    }}
                    className="hover:underline hover:text-brand-500 transition-colors bg-transparent border-0 cursor-pointer p-0 font-bold"
                  >
                    Forget Password
                  </button>
                  <button
                    onClick={() => {
                      setLoginError('');
                      setLoginView('signup');
                      setShowLogoutMessage(false);
                    }}
                    className="hover:underline hover:text-brand-500 transition-colors bg-transparent border-0 cursor-pointer p-0 font-bold"
                  >
                    Signup
                  </button>
                </div>

                {/* Quick Demo Pre-fills */}
                <div className="mt-8 border-t border-slate-200 dark:border-slate-800/80 pt-5">
                  <p className="text-center text-[9px] uppercase font-bold tracking-widest text-slate-450 dark:text-slate-550 mb-2.5">Quick Login Selector</p>
                  <select
                    onChange={(e) => {
                      const val = e.target.value;
                      if (!val) return;
                      const [emailVal, pwdVal] = val.split('|');
                      setEmail(emailVal);
                      setPassword(pwdVal);
                      setShowLogoutMessage(false);
                    }}
                    value={email ? `${email}|${password}` : ''}
                    className="w-full bg-slate-50/80 dark:bg-slate-950/30 text-slate-700 dark:text-slate-350 border border-slate-200 dark:border-slate-800/60 rounded-lg px-3.5 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/35 font-semibold transition-all cursor-pointer shadow-sm"
                  >
                    <option value="">-- Choose a Seeded Account --</option>
                    <optgroup label="System Administrator">
                      <option value="admin@college.edu|Admin123!">Admin Portal (admin@college.edu)</option>
                    </optgroup>
                    <optgroup label="Faculty Teachers (Staff)">
                      <option value="drrajeshkumar@college.edu|Staff123!">Dr. Rajesh Kumar (drrajeshkumar@)</option>
                      <option value="drpriyasharma@college.edu|Staff123!">Dr. Priya Sharma (drpriyasharma@)</option>
                      <option value="drarunalagappan@college.edu|Staff123!">Dr. Arun Alagappan (drarunalagappan@)</option>
                      <option value="drsandeepgoel@college.edu|Staff123!">Dr. Sandeep Goel (drsandeepgoel@)</option>
                      <option value="dramitpatel@college.edu|Staff123!">Dr. Amit Patel (dramitpatel@)</option>
                    </optgroup>
                    <optgroup label="Enrolled Students (Class/Section-wise)">
                      <option value="student.mcaa@college.edu|Student123!">MCA Section A (student.mcaa@)</option>
                      <option value="student.mcab@college.edu|Student123!">MCA Section B (student.mcab@)</option>
                      <option value="student.mcac@college.edu|Student123!">MCA Section C (student.mcac@)</option>
                      <option value="student.mcad@college.edu|Student123!">MCA Section D (student.mcad@)</option>
                      <option value="student.mcae@college.edu|Student123!">MCA Section E (student.mcae@)</option>
                      <option value="student.mcagenaia@college.edu|Student123!">MCA (Gen AI) Section A (student.mcagenaia@)</option>
                      <option value="student.mcagenaib@college.edu|Student123!">MCA (Gen AI) Section B (student.mcagenaib@)</option>
                      <option value="student.mcagenaic@college.edu|Student123!">MCA (Gen AI) Section C (student.mcagenaic@)</option>
                      <option value="student.msca@college.edu|Student123!">M.Sc. Section A (student.msca@)</option>
                      <option value="student.mscb@college.edu|Student123!">M.Sc. Section B (student.mscb@)</option>
                      <option value="student.bcaa@college.edu|Student123!">BCA Section A (student.bcaa@)</option>
                      <option value="student.bcab@college.edu|Student123!">BCA Section B (student.bcab@)</option>
                      <option value="student.bcac@college.edu|Student123!">BCA Section C (student.bcac@)</option>
                    </optgroup>
                  </select>
                </div>
              </motion.div>
            ) : loginView === 'forgot' ? (
              <motion.div
                key="forgot-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center text-center py-4"
              >
                {/* SRM University Logo */}
                <img
                  src="/srm_logo.png"
                  alt="SRM Logo"
                  className="h-12 object-contain mb-6 filter dark:brightness-110"
                />
                <div className="w-16 h-16 rounded-full bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center mb-4 border border-brand-500/30">
                  <ShieldCheck className="w-8 h-8 text-brand-500 dark:text-brand-400" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-850 dark:text-white mb-2">
                  Contact Admin
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-350 leading-relaxed mb-6">
                  Please contact the System Administrator to reset your password.
                </p>
                <button
                  onClick={() => setLoginView('login')}
                  className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all text-sm shadow-md hover:shadow-brand-500/20 active:scale-[0.98] transition-transform duration-100"
                >
                  Back to Sign In
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="signup-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col items-center text-center py-4"
              >
                {/* SRM University Logo */}
                <img
                  src="/srm_logo.png"
                  alt="SRM Logo"
                  className="h-12 object-contain mb-6 filter dark:brightness-110"
                />
                <div className="w-16 h-16 rounded-full bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center mb-4 border border-brand-500/30">
                  <Sparkles className="w-8 h-8 text-brand-500 dark:text-brand-400" />
                </div>
                <h2 className="text-xl font-extrabold text-slate-850 dark:text-white mb-2">
                  Account Registration
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-350 leading-relaxed mb-6">
                  Please contact the System Administrator to create a new portal account.
                </p>
                <button
                  onClick={() => setLoginView('login')}
                  className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all text-sm shadow-md hover:shadow-brand-500/20 active:scale-[0.98] transition-transform duration-100"
                >
                  Back to Sign In
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    );
  }

  // Helper to render active view/module content
  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return <Dashboard />;
    }

    // Admin routes
    if (role === 'Admin') {
      if (activeTab === 'editor') return <TimetableEditor />;
      if (activeTab === 'crud') return <AdminCrud />;
      if (activeTab === 'reports') return <Reports />;
    }

    // Staff routes
    if (role === 'Staff') {
      if (activeTab === 'timetable') {
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Teaching Schedule</h2>
            <Reports />
          </div>
        );
      }
      if (activeTab === 'reports') return <Reports />;
    }

    // Student routes
    if (role === 'Student') {
      if (activeTab === 'timetable') {
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Your Section Academic Timetable</h2>
            {studentTimetable.length > 0 ? (
              <TimetableGrid
                details={studentTimetable}
                timeslots={timeslots}
                isEditable={false}
              />
            ) : (
              <div className="text-center py-20 text-slate-500 dark:text-slate-400">No timetable generated yet. Contact Admin.</div>
            )}
          </div>
        );
      }
    }

    return <Dashboard />;
  };

  if (user && showWelcome) {
    return (
      <div className="min-h-screen relative flex justify-center items-center p-4 transition-colors duration-300 overflow-hidden select-none">
        {/* Slideshow background images with absolute fade-in/fade-out */}
        {backgrounds.map((bg, idx) => (
          <div
            key={bg}
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
            style={{
              backgroundImage: `url('${bg}')`,
              opacity: bgIndex === idx ? 1 : 0,
              zIndex: 0
            }}
          ></div>
        ))}

        {/* Dynamic Light/Dark Overlay Mask */}
        <div className="absolute inset-0 bg-white/70 dark:bg-[#070b13]/85 backdrop-blur-[2px] transition-colors duration-300 z-10"></div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-white/75 dark:bg-slate-900/50 border border-slate-200/60 dark:border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-xl relative z-20 text-center flex flex-col items-center"
        >
          {/* Header */}
          <div className="flex flex-col items-center mb-6 relative">
            {/* SRM University Logo without White Bubble background wrapper */}
            <img
              src="/srm_logo.png"
              alt="SRM Logo"
              className="h-12 object-contain mb-4 filter dark:brightness-110"
            />
          </div>

          {role === 'Admin' ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 dark:bg-red-500/20 flex items-center justify-center mb-4 border border-red-500/30">
                <ShieldCheck className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <h1 className="text-2xl font-black text-slate-850 dark:text-white tracking-wide mb-3">
                Welcome to Admin Portal
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-350 leading-relaxed mb-6">
                You have successfully logged in. As an Administrator, you can configure timetables, manage classes, and generate reports.
              </p>
            </div>
          ) : role === 'Staff' ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center mb-4 border border-brand-500/30">
                <GraduationCap className="w-8 h-8 text-brand-500 dark:text-brand-400" />
              </div>
              <h1 className="text-2xl font-black text-slate-850 dark:text-white tracking-wide mb-3">
                Welcome to the Staff Portal
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-350 leading-relaxed mb-6">
                Welcome back! Access your daily class schedule, track idle gaps, and compile course reports.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center mb-4 border border-emerald-500/30">
                <Sparkles className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
              </div>
              <h1 className="text-2xl font-black text-slate-850 dark:text-white tracking-wide mb-3">
                Welcome to the Class and Section Portal
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-350 leading-relaxed mb-6">
                Access class schedules, monitor section timetables, and keep up to date with daily updates.
              </p>
            </div>
          )}

          <button
            onClick={() => setShowWelcome(false)}
            className="w-full py-3 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold transition-all text-sm shadow-md hover:shadow-brand-500/20 active:scale-[0.98] transition-transform duration-100 flex items-center justify-center gap-2"
          >
            <span>Proceed to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070b13] flex flex-col lg:flex-row text-slate-800 dark:text-slate-100 transition-colors duration-300">

      {/* Mobile Top Navigation Bar */}
      <header className="lg:hidden w-full flex items-center justify-between p-4 bg-white dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-800/80 shadow-sm z-30 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-800/40"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="bg-brand-500/20 p-1.5 rounded-lg border border-brand-500/30">
              <Sparkles className="w-4 h-4 text-brand-400" />
            </div>
            <div>
              <h1 className="font-bold text-xs leading-none text-slate-900 dark:text-white">Smart Timetable</h1>
              <span className="text-[9px] text-brand-400 font-medium">ERP Platform</span>
            </div>
          </div>
        </div>

        {/* Top-Right Theme Toggle on Mobile */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-yellow-400 border border-slate-200 dark:border-slate-800/40 transition-all"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4 text-brand-500" />}
        </button>
      </header>

      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main content pane */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto max-h-[calc(100vh-64px)] lg:max-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
