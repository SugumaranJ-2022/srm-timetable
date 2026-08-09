import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import Sidebar from './components/Sidebar';
import Dashboard from './modules/Dashboard';
import TimetableEditor from './modules/TimetableEditor';
import AdminCrud from './modules/AdminCrud';
import Reports from './modules/Reports';
import AcademicCalendar from './modules/AcademicCalendar';
import TimetableGrid from './components/TimetableGrid';
import { timetableApi } from './services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  GraduationCap,
  Menu,
  Sun,
  Moon,
  CheckCircle,
  X,
  Eye,
  EyeOff,
  ChevronDown,
  Calendar,
  Users,
  UserCheck
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

const classTimetables = [
  { name: "MCA - A", email: "student.mcaa@college.edu", password: "Student123!" },
  { name: "MCA - B", email: "student.mcab@college.edu", password: "Student123!" },
  { name: "MCA - C", email: "student.mcac@college.edu", password: "Student123!" },
  { name: "MCA - D", email: "student.mcad@college.edu", password: "Student123!" },
  { name: "MCA - E", email: "student.mcae@college.edu", password: "Student123!" },
  { name: "MCA (Gen AI) - A", email: "student.mcagenaia@college.edu", password: "Student123!" },
  { name: "MCA (Gen AI) - B", email: "student.mcagenaib@college.edu", password: "Student123!" },
  { name: "MCA (Gen AI) - C", email: "student.mcagenaic@college.edu", password: "Student123!" },
  { name: "M.Sc. - A", email: "student.msca@college.edu", password: "Student123!" },
  { name: "M.Sc. - B", email: "student.mscb@college.edu", password: "Student123!" },
  { name: "BCA - A", email: "student.bcaa@college.edu", password: "Student123!" },
  { name: "BCA - B", email: "student.bcab@college.edu", password: "Student123!" },
  { name: "BCA - C", email: "student.bcac@college.edu", password: "Student123!" },
  { name: "BCA (Gen AI) - A", email: "student.bcagenaia@college.edu", password: "Student123!" },
  { name: "BCA (Gen AI) - B", email: "student.bcagenaib@college.edu", password: "Student123!" },
  { name: "BCA (Gen AI) - C", email: "student.bcagenaic@college.edu", password: "Student123!" }
];

const staffTimetables = [
  { name: "Dr. Rajesh Kumar", email: "drrajeshkumar@college.edu", password: "Staff123!" },
  { name: "Dr. Priya Sharma", email: "drpriyasharma@college.edu", password: "Staff123!" },
  { name: "Dr. Arun Alagappan", email: "drarunalagappan@college.edu", password: "Staff123!" },
  { name: "Dr. Sandeep Goel", email: "drsandeepgoel@college.edu", password: "Staff123!" },
  { name: "Dr. Amit Patel", email: "dramitpatel@college.edu", password: "Staff123!" },
  { name: "Dr. Shalini Rao", email: "drshalinirao@college.edu", password: "Staff123!" },
  { name: "Dr. Rajeev Nair", email: "drrajeevnair@college.edu", password: "Staff123!" },
  { name: "Dr. Neha Kapoor", email: "drnehakapoor@college.edu", password: "Staff123!" },
  { name: "Dr. Preeti Sen", email: "drpreetisen@college.edu", password: "Staff123!" },
  { name: "Dr. Manoj Verma", email: "drmanojverma@college.edu", password: "Staff123!" },
  { name: "Dr. Divya Iyer", email: "drdivyaiyer@college.edu", password: "Staff123!" },
  { name: "Dr. Harish Joshi", email: "drharishjoshi@college.edu", password: "Staff123!" },
  { name: "Dr. Deepa Nair", email: "drdeepanair@college.edu", password: "Staff123!" },
  { name: "Dr. Surya Kumar", email: "drsuryakumar@college.edu", password: "Staff123!" },
  { name: "Dr. Fahadh Faasil", email: "drfahadhfaasil@college.edu", password: "Staff123!" },
  { name: "Dr. Mahesh Babu", email: "drmaheshbabu@college.edu", password: "Staff123!" },
  { name: "Mr. Anand Subramanian", email: "mranandsubramanian@college.edu", password: "Staff123!" },
  { name: "Mr. Vijay Kulkarni", email: "mrvijaykulkarni@college.edu", password: "Staff123!" },
  { name: "Mr. Nitin Gadkari", email: "mrnitingadkari@college.edu", password: "Staff123!" },
  { name: "Mr. Sanjay Dutt", email: "mrsanjaydutt@college.edu", password: "Staff123!" },
  { name: "Mr. Rohan Bopanna", email: "mrrohanbopanna@college.edu", password: "Staff123!" },
  { name: "Mr. Tarun Tahiliani", email: "mrtaruntahiliani@college.edu", password: "Staff123!" },
  { name: "Mr. Nani Ghose", email: "mrnanighose@college.edu", password: "Staff123!" },
  { name: "Mr. Dulquer Salmaan", email: "mrdulquersalmaan@college.edu", password: "Staff123!" },
  { name: "Ms. Anitha Devi", email: "msanithadevi@college.edu", password: "Staff123!" },
  { name: "Ms. Meena Jasmine", email: "msmeenajasmine@college.edu", password: "Staff123!" },
  { name: "Ms. Kavitha Rao", email: "mskavitharao@college.edu", password: "Staff123!" },
  { name: "Ms. Anjali Patil", email: "msanjalipatil@college.edu", password: "Staff123!" },
  { name: "Ms. Sneha Reddy", email: "mssnehareddy@college.edu", password: "Staff123!" },
  { name: "Ms. Archana Puran", email: "msarchanapuran@college.edu", password: "Staff123!" }
];

const adminTimetables = [
  { name: "Admin Portal", email: "admin@college.edu", password: "Admin123!" }
];

const AppContent = () => {
  const { user, role, profile, loading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();



  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [prevUser, setPrevUser] = useState(null);
  const [logoutDetails, setLogoutDetails] = useState(null);
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);

  const videoRef = React.useRef(null);

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
      setIsExpanded(false);
    }
    setPrevUser(user);
  }, [user, prevUser]);

  // Login states
  const [loginView, setLoginView] = useState('login'); // 'login' | 'forgot' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdownState] = useState(null); // 'class' | 'staff' | 'admin' | null
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  const handleDropdownToggle = (type) => {
    setActiveDropdownState(activeDropdown === type ? null : type);
    setClassSearchQuery('');
    setStaffSearchQuery('');
  };

  const handleSelectTimetable = (emailVal, passwordVal) => {
    setEmail(emailVal);
    setPassword(passwordVal);
    setLoginError('');
    setShowLogoutMessage(false);
    setLoginView('login');
    setIsExpanded(true);
    setActiveDropdownState(null);
    setMobileMenuOpen(false);
    setClassSearchQuery('');
    setStaffSearchQuery('');
  };

  React.useEffect(() => {
    if (videoRef.current) {
      if (isSubmitting) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [isSubmitting]);

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
      <div className="min-h-screen relative flex justify-center items-center pt-32 pb-8 p-4 transition-colors duration-300 overflow-hidden">

        {/* Video Background */}
        <video
          ref={videoRef}
          autoPlay
          loop
          muted
          playsInline
          onClick={() => {
            setIsExpanded(false);
            setMobileMenuOpen(false);
          }}
          className="absolute inset-0 w-full h-full object-cover z-0 cursor-pointer"
          style={{
            transform: 'scale(1.15) translate(3%, 0%)',
            transformOrigin: 'center center'
          }}
        >
          <source src="/video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Dynamic Light/Dark Overlay Mask */}
        <div 
          onClick={() => {
            setIsExpanded(false);
            setMobileMenuOpen(false);
          }}
          className="absolute inset-0 bg-white/30 dark:bg-[#070b13]/55 transition-colors duration-300 z-10 cursor-pointer"
        ></div>

        {/* SRM Header/Navbar */}
        <header className="absolute top-0 left-0 right-0 w-full z-30 transition-colors duration-300 select-none flex flex-col">
          {/* Row 2: Main Menu */}
          <div className="w-full bg-slate-900/85 backdrop-blur-md py-4 px-6 sm:px-12 flex items-center justify-between border-b border-white/15 shadow-xl">
            {/* Left: Logo & SRM Branding */}
            <div className="flex items-center gap-3.5">
              <img src="/srm_logo.png" alt="SRM Logo" className="h-12 w-12 object-contain rounded-full bg-white p-0.5 shadow-md transition-transform duration-300 hover:scale-105" />
              <div className="hidden md:flex flex-col text-white">
                <span className="text-sm font-black tracking-wider leading-none uppercase text-white drop-shadow-md">SRM</span>
                <span className="text-[9px] font-black tracking-widest text-slate-100 uppercase mt-0.5 drop-shadow-sm">Institute of Science & Technology</span>
              </div>
            </div>

            {/* Center: Interactive Timetable Dropdowns */}
            <div className="hidden lg:flex items-center gap-6 z-40">
              {/* Class Timetable Dropdown */}
              <div className="relative">
                <button
                  onClick={() => handleDropdownToggle('class')}
                  onMouseEnter={() => handleDropdownToggle('class')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-black tracking-widest text-white uppercase hover:text-brand-300 transition-colors duration-200 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Class Timetable</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeDropdown === 'class' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'class' && (
                  <div
                    onMouseLeave={() => handleDropdownToggle(null)}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[420px] bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col gap-2.5 z-50 animate-fade-in"
                  >
                    <div className="px-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="Search Class/Section..."
                        value={classSearchQuery}
                        onChange={(e) => setClassSearchQuery(e.target.value)}
                        className="w-full bg-slate-950/70 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {classTimetables
                        .filter(item => item.name.toLowerCase().includes(classSearchQuery.toLowerCase()))
                        .map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectTimetable(item.email, item.password)}
                            className="text-left px-3 py-2 text-[11px] font-bold text-slate-200 hover:text-white hover:bg-brand-500/20 rounded-xl transition-all duration-150 border border-transparent hover:border-brand-500/30 flex items-center gap-2 cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                            {item.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Staff Timetable Dropdown */}
              <div className="relative">
                <button
                  onClick={() => handleDropdownToggle('staff')}
                  onMouseEnter={() => handleDropdownToggle('staff')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-black tracking-widest text-white uppercase hover:text-brand-300 transition-colors duration-200 cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Staff Timetable</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeDropdown === 'staff' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'staff' && (
                  <div
                    onMouseLeave={() => handleDropdownToggle(null)}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-4 flex flex-col gap-2.5 z-50 animate-fade-in"
                  >
                    <div className="px-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        placeholder="Search Staff Member..."
                        value={staffSearchQuery}
                        onChange={(e) => setStaffSearchQuery(e.target.value)}
                        className="w-full bg-slate-950/70 border border-white/15 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500/50"
                      />
                    </div>
                    <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
                      {staffTimetables
                        .filter(item => item.name.toLowerCase().includes(staffSearchQuery.toLowerCase()))
                        .map((item, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectTimetable(item.email, item.password)}
                            className="text-left px-3 py-2 text-[11px] font-bold text-slate-200 hover:text-white hover:bg-brand-500/20 rounded-xl transition-all duration-150 border border-transparent hover:border-brand-500/30 flex items-center gap-2 cursor-pointer"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-400"></span>
                            {item.name}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Admin Timetable Dropdown */}
              <div className="relative">
                <button
                  onClick={() => handleDropdownToggle('admin')}
                  onMouseEnter={() => handleDropdownToggle('admin')}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-black tracking-widest text-white uppercase hover:text-brand-300 transition-colors duration-200 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Admin Timetable</span>
                  <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${activeDropdown === 'admin' ? 'rotate-180' : ''}`} />
                </button>
                {activeDropdown === 'admin' && (
                  <div
                    onMouseLeave={() => handleDropdownToggle(null)}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl p-2.5 z-50 animate-fade-in"
                  >
                    {adminTimetables.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectTimetable(item.email, item.password)}
                        className="w-full text-left px-3 py-2.5 text-[11px] font-black text-white hover:text-white hover:bg-red-500/25 rounded-xl transition-all duration-150 border border-transparent hover:border-red-500/40 flex items-center gap-2 cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        {item.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Theme Toggle & Sign In Action */}
            <div className="flex items-center gap-3.5">
              {/* Light/Dark Toggle (Desktop only) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTheme();
                }}
                className="hidden lg:flex p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer shadow-md"
              >
                {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5 text-brand-300" />}
              </button>

              {/* Mobile Menu Toggle (Visible below lg) */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMobileMenuOpen(!mobileMenuOpen);
                }}
                className="lg:hidden p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer shadow-md"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu Panel (Slides down below lg) */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full bg-slate-950/95 backdrop-blur-xl border-b border-white/10 px-8 py-6 flex flex-col gap-6 text-white overflow-hidden lg:hidden"
              >
                {/* Mobile Timetable Selectors (Accordion style) */}
                <div className="flex flex-col gap-4 border-b border-white/10 pb-5">
                  {/* Class Timetable Group */}
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleDropdownToggle('class')}
                      className="flex items-center justify-between w-full py-2.5 text-sm font-black tracking-widest text-white uppercase hover:text-brand-300 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-brand-400" />
                        Class Timetable
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'class' ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {activeDropdown === 'class' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pl-4 py-1.5 flex flex-col gap-2 overflow-hidden"
                        >
                          <div className="px-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              placeholder="Search Class..."
                              value={classSearchQuery}
                              onChange={(e) => setClassSearchQuery(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                            {classTimetables
                              .filter(item => item.name.toLowerCase().includes(classSearchQuery.toLowerCase()))
                              .map((item, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectTimetable(item.email, item.password)}
                                  className="text-left py-2 px-2.5 text-xs text-slate-350 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                  {item.name}
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Staff Timetable Group */}
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleDropdownToggle('staff')}
                      className="flex items-center justify-between w-full py-2.5 text-sm font-black tracking-widest text-white uppercase hover:text-brand-300 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-brand-400" />
                        Staff Timetable
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'staff' ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {activeDropdown === 'staff' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pl-4 py-1.5 flex flex-col gap-2 overflow-hidden"
                        >
                          <div className="px-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              placeholder="Search Staff..."
                              value={staffSearchQuery}
                              onChange={(e) => setStaffSearchQuery(e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-brand-500/40"
                            />
                          </div>
                          <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                            {staffTimetables
                              .filter(item => item.name.toLowerCase().includes(staffSearchQuery.toLowerCase()))
                              .map((item, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectTimetable(item.email, item.password)}
                                  className="text-left py-2 px-2.5 text-xs text-slate-355 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                                  {item.name}
                                </button>
                              ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Admin Timetable Group */}
                  <div className="flex flex-col">
                    <button
                      onClick={() => handleDropdownToggle('admin')}
                      className="flex items-center justify-between w-full py-2.5 text-sm font-black tracking-widest text-white uppercase hover:text-brand-300 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <UserCheck className="w-4 h-4 text-red-400" />
                        Admin Timetable
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === 'admin' ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {activeDropdown === 'admin' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="pl-4 py-1.5 flex flex-col gap-1 overflow-hidden"
                        >
                          {adminTimetables.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => handleSelectTimetable(item.email, item.password)}
                              className="text-left py-2 px-2.5 text-xs text-slate-355 hover:text-white rounded-lg hover:bg-white/5 transition-all flex items-center gap-1.5"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                              {item.name}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Theme & Actions */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase text-slate-350">App Theme</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-yellow-400" /> : <Moon className="w-3.5 h-3.5 text-brand-300" />}
                    <span className="text-[10px] font-black uppercase">{theme === 'dark' ? 'Light' : 'Dark'}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        {/* Expanded Login Card (Centers on Page) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-md bg-white/95 dark:bg-[#0f172a]/95 border border-slate-250 dark:border-slate-800 rounded-3xl p-8 backdrop-blur-2xl shadow-2xl shadow-brand-500/10 relative z-50 overflow-hidden animate-fade-in"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-655 dark:text-slate-500 dark:hover:text-slate-350 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <AnimatePresence mode="wait">
                {loginView === 'login' ? (
                  <motion.div
                    key="login-view"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* Header */}
                    <div className="flex flex-col items-center mb-6 relative select-none">
                      <img
                        src="/srm_logo.png"
                        alt="SRM Logo"
                        className="h-14 object-contain mb-4 filter dark:brightness-110"
                      />
                      <h1 className="text-2xl font-black text-slate-850 dark:text-white tracking-wide text-center">
                        Sign In to Timetable
                      </h1>
                      <p className="text-xs text-slate-500 dark:text-slate-300 mt-1.5 text-center">Enter your credential details to proceed</p>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleLoginSubmit} className="space-y-5">
                      {showLogoutMessage && logoutDetails && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-xs rounded-2xl text-left relative animate-fade-in">
                          <div className="font-bold mb-1 flex items-center gap-1.5 text-green-800 dark:text-green-300">
                            <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                            Logged Out Successfully
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed mb-2">
                            Thank you for using the Smart Timetable ERP Portal. Your session has been safely closed.
                          </p>
                          <div className="text-[9px] text-slate-400 dark:text-slate-550 border-t border-green-500/10 pt-1.5 flex flex-wrap justify-between gap-1">
                            <span>Account: <span className="font-semibold text-slate-550 dark:text-slate-400">{logoutDetails.email}</span></span>
                            <span>Time: <span className="font-semibold text-slate-555 dark:text-slate-400">{logoutDetails.time}</span></span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowLogoutMessage(false)}
                            className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-650 dark:text-slate-500 dark:hover:text-slate-350 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      {loginError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl text-center">
                          {loginError}
                        </div>
                      )}

                      <div className="space-y-4">
                        {/* Username Input Container */}
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mail className="w-4 h-4 text-slate-400 dark:text-slate-300" />
                          </span>
                          <input
                            type="email"
                            required
                            placeholder="Username (Email)"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setShowLogoutMessage(false);
                            }}
                            className="w-full bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 border border-slate-200 dark:border-slate-800/80 py-3.5 pl-11 pr-5 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm font-semibold transition-all shadow-sm"
                          />
                        </div>

                        {/* Password Input Container */}
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Lock className="w-4 h-4 text-slate-400 dark:text-slate-300" />
                          </span>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            placeholder="Password"
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setShowLogoutMessage(false);
                            }}
                            className="w-full bg-slate-50/50 dark:bg-slate-950/60 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 border border-slate-200 dark:border-slate-800/80 py-3.5 pl-11 pr-11 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-sm font-semibold transition-all shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 dark:text-slate-300 hover:text-slate-650 dark:hover:text-white cursor-pointer"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Login Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-bold transition-all text-sm shadow-md hover:shadow-brand-500/25 active:scale-[0.98] transition-transform duration-100 cursor-pointer"
                      >
                        {isSubmitting ? 'Signing In...' : 'Sign In'}
                      </button>
                    </form>

                    {/* Forget Password & Signup Links */}
                    <div className="flex items-center justify-between px-1 mt-5 text-xs font-bold text-slate-500 dark:text-slate-200 select-none">
                      <button
                        onClick={() => {
                          setLoginError('');
                          setLoginView('forgot');
                          setShowLogoutMessage(false);
                        }}
                        className="hover:underline hover:text-brand-500 dark:hover:text-brand-400 transition-colors bg-transparent border-0 cursor-pointer p-0 font-bold"
                      >
                        Forget Password?
                      </button>
                      <button
                        onClick={() => {
                          setLoginError('');
                          setLoginView('signup');
                          setShowLogoutMessage(false);
                        }}
                        className="hover:underline hover:text-brand-500 dark:hover:text-brand-400 transition-colors bg-transparent border-0 cursor-pointer p-0 font-bold"
                      >
                        Create Account
                      </button>
                    </div>

                    {/* Quick Demo Pre-fills */}
                    <div className="mt-8 border-t border-slate-200/60 dark:border-slate-800/60 pt-6">
                      <p className="text-center text-[10px] uppercase font-extrabold tracking-widest text-slate-400 dark:text-slate-350 mb-3">Quick Login Selector</p>
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
                        className="w-full bg-slate-50 dark:bg-slate-950/70 text-slate-700 dark:text-slate-100 border border-slate-250 dark:border-slate-800 rounded-xl px-3.5 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500/35 font-semibold transition-all cursor-pointer shadow-sm"
                      >
                        <option value="">-- Choose a Seeded Account --</option>
                        <optgroup label="Faculty Teachers (Staff)">
                          <option value="drrajeshkumar@college.edu|Staff123!">Dr. Rajesh Kumar (drrajeshkumar@)</option>
                          <option value="drpriyasharma@college.edu|Staff123!">Dr. Priya Sharma (drpriyasharma@)</option>
                          <option value="drarunalagappan@college.edu|Staff123!">Dr. Arun Alagappan (drarunalagappan@)</option>
                          <option value="drsandeepgoel@college.edu|Staff123!">Dr. Sandeep Goel (drsandeepgoel@)</option>
                          <option value="dramitpatel@college.edu|Staff123!">Dr. Amit Patel (dramitpatel@)</option>
                          <option value="drshalinirao@college.edu|Staff123!">Dr. Shalini Rao (drshalinirao@)</option>
                          <option value="drrajeevnair@college.edu|Staff123!">Dr. Rajeev Nair (drrajeevnair@)</option>
                          <option value="drnehakapoor@college.edu|Staff123!">Dr. Neha Kapoor (drnehakapoor@)</option>
                          <option value="drpreetisen@college.edu|Staff123!">Dr. Preeti Sen (drpreetisen@)</option>
                          <option value="drmanojverma@college.edu|Staff123!">Dr. Manoj Verma (drmanojverma@)</option>
                          <option value="drdivyaiyer@college.edu|Staff123!">Dr. Divya Iyer (drdivyaiyer@)</option>
                          <option value="drharishjoshi@college.edu|Staff123!">Dr. Harish Joshi (drharishjoshi@)</option>
                          <option value="drdeepanair@college.edu|Staff123!">Dr. Deepa Nair (drdeepanair@)</option>
                          <option value="drsuryakumar@college.edu|Staff123!">Dr. Surya Kumar (drsuryakumar@)</option>
                          <option value="drfahadhfaasil@college.edu|Staff123!">Dr. Fahadh Faasil (drfahadhfaasil@)</option>
                          <option value="drmaheshbabu@college.edu|Staff123!">Dr. Mahesh Babu (drmaheshbabu@)</option>
                          <option value="mranandsubramanian@college.edu|Staff123!">Mr. Anand Subramanian (mranandsubramanian@)</option>
                          <option value="mrvijaykulkarni@college.edu|Staff123!">Mr. Vijay Kulkarni (mrvijaykulkarni@)</option>
                          <option value="mrnitingadkari@college.edu|Staff123!">Mr. Nitin Gadkari (mrnitingadkari@)</option>
                          <option value="mrsanjaydutt@college.edu|Staff123!">Mr. Sanjay Dutt (mrsanjaydutt@)</option>
                          <option value="mrrohanbopanna@college.edu|Staff123!">Mr. Rohan Bopanna (mrrohanbopanna@)</option>
                          <option value="mrtaruntahiliani@college.edu|Staff123!">Mr. Tarun Tahiliani (mrtaruntahiliani@)</option>
                          <option value="mrnanighose@college.edu|Staff123!">Mr. Nani Ghose (mrnanighose@)</option>
                          <option value="mrdulquersalmaan@college.edu|Staff123!">Mr. Dulquer Salmaan (mrdulquersalmaan@)</option>
                          <option value="msanithadevi@college.edu|Staff123!">Ms. Anitha Devi (msanithadevi@)</option>
                          <option value="msmeenajasmine@college.edu|Staff123!">Ms. Meena Jasmine (msmeenajasmine@)</option>
                          <option value="mskavitharao@college.edu|Staff123!">Ms. Kavitha Rao (mskavitharao@)</option>
                          <option value="msanjalipatil@college.edu|Staff123!">Ms. Anjali Patil (msanjalipatil@)</option>
                          <option value="mssnehareddy@college.edu|Staff123!">Ms. Sneha Reddy (mssnehareddy@)</option>
                          <option value="msarchanapuran@college.edu|Staff123!">Ms. Archana Puran (msarchanapuran@)</option>
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
                          <option value="student.bcagenaia@college.edu|Student123!">BCA (Gen AI) Section A (student.bcagenaia@)</option>
                          <option value="student.bcagenaib@college.edu|Student123!">BCA (Gen AI) Section B (student.bcagenaib@)</option>
                          <option value="student.bcagenaic@college.edu|Student123!">BCA (Gen AI) Section C (student.bcagenaic@)</option>
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
                      <GraduationCap className="w-8 h-8 text-brand-500 dark:text-brand-400" />
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
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Helper to render active view/module content
  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return <Dashboard setActiveTab={setActiveTab} />;
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

    // All-role calendar route
    if (activeTab === 'calendar') return <AcademicCalendar />;

    return <Dashboard setActiveTab={setActiveTab} />;
  };

  if (user && showWelcome) {
    return (
      <div className="min-h-screen relative flex justify-center items-center p-4 transition-colors duration-300 overflow-hidden select-none">
        {/* Video Background */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            transform: 'scale(1.15) translate(3%, 0%)',
            transformOrigin: 'center center'
          }}
        >
          <source src="/video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

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
                <GraduationCap className="w-8 h-8 text-emerald-500 dark:text-emerald-400" />
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
              <GraduationCap className="w-4 h-4 text-brand-400" />
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
