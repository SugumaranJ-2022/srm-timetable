import React, { useState, useEffect } from 'react';
import { timetableApi } from '../services/api';
import {
  MapPin,
  Users,
  BookOpen,
  Clock,
  Search,
  CheckCircle,
  AlertTriangle,
  Building2,
  Filter,
  RefreshCw,
  Info
} from 'lucide-react';

const LiveTracker = () => {
  const [liveData, setLiveData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter state
  const [classroomsSearch, setClassroomsSearch] = useState('');
  const [classroomsFilter, setClassroomsFilter] = useState('All'); // 'All' | 'Free' | 'Occupied'
  
  const [facultySearch, setFacultySearch] = useState('');
  const [facultyFilter, setFacultyFilter] = useState('All'); // 'All' | 'Free' | 'Teaching'

  const [activeSubTab, setActiveSubTab] = useState('classrooms'); // 'classrooms' | 'faculty' | 'ongoing'

  // Load live data from backend based on current date/time
  const fetchStatus = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('sv-SE');
    const timeStr = now.toTimeString().split(' ')[0];

    try {
      const data = await timetableApi.getLiveStatus(dateStr, timeStr);
      setLiveData(data);
    } catch (e) {
      console.error(e);
      setError('Failed to fetch real-time campus status.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus(true);

    const interval = setInterval(() => {
      fetchStatus(false);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-500/20 border-t-brand-500" />
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Scanning campus resources...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 rounded-3xl text-center space-y-4 max-w-md mx-auto mt-12">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Connection Error</h3>
        <p className="text-slate-500 dark:text-slate-400 text-xs">{error}</p>
        <button onClick={fetchStatus} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-500 transition-colors">
          Retry Connection
        </button>
      </div>
    );
  }

  // Statistics
  const totalRooms = liveData?.classrooms?.length || 0;
  const occupiedRooms = liveData?.classrooms?.filter(r => r.is_occupied).length || 0;
  const freeRooms = totalRooms - occupiedRooms;

  const totalFaculty = liveData?.faculty?.length || 0;
  const teachingFaculty = liveData?.faculty?.filter(f => f.is_teaching).length || 0;
  const freeFaculty = totalFaculty - teachingFaculty;

  // Filtered Classrooms
  const filteredClassrooms = (liveData?.classrooms || []).filter(room => {
    const matchesSearch = room.room_number.toLowerCase().includes(classroomsSearch.toLowerCase()) ||
                          room.building.toLowerCase().includes(classroomsSearch.toLowerCase());
    const matchesFilter = classroomsFilter === 'All' || 
                          (classroomsFilter === 'Free' && !room.is_occupied) ||
                          (classroomsFilter === 'Occupied' && room.is_occupied);
    return matchesSearch && matchesFilter;
  });

  // Filtered Faculty
  const filteredFaculty = (liveData?.faculty || []).filter(fac => {
    const matchesSearch = fac.name.toLowerCase().includes(facultySearch.toLowerCase());
    const matchesFilter = facultyFilter === 'All' ||
                          (facultyFilter === 'Free' && !fac.is_teaching) ||
                          (facultyFilter === 'Teaching' && fac.is_teaching);
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">


      {/* Overview Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Time */}
        <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center text-brand-500 shrink-0">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scheduled Period</p>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
              {liveData?.is_holiday ? 'Holiday' : (liveData?.period_number ? `Hour ${liveData.period_number}` : 'No Class')}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 font-medium truncate max-w-[150px]" title={liveData?.is_holiday ? liveData.holiday_title : ''}>
              {liveData?.is_holiday ? liveData.holiday_title : (liveData?.period_number ? `${liveData.start_time} - ${liveData.end_time}` : 'School is closed')}
            </p>
          </div>
        </div>

        {/* Card 2: Classroom Occupancy */}
        <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-650 dark:text-teal-400 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Classroom Utilization</p>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
              {occupiedRooms} / {totalRooms}
            </p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">
              {freeRooms} Rooms Free right now
            </p>
          </div>
        </div>

        {/* Card 3: Faculty Locator */}
        <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Faculty Coverage</p>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
              {teachingFaculty} / {totalFaculty}
            </p>
            <p className="text-[10px] text-brand-500 dark:text-brand-400 mt-0.5 font-semibold">
              {freeFaculty} Professors Free
            </p>
          </div>
        </div>

        {/* Card 4: Ongoing Classes */}
        <div className="glass-card p-5 rounded-2xl border border-slate-200 dark:border-slate-800/80 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-500 shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lectures Running</p>
            <p className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
              {liveData?.ongoing_classes?.length || 0}
            </p>
            <p className="text-[10px] text-violet-500 mt-0.5 font-semibold">
              Across all 16 sections
            </p>
          </div>
        </div>
      </div>

      {/* Main Panel tabs */}
      <div className="glass-card rounded-3xl p-6 border border-slate-250 dark:border-slate-800/60 shadow-glass">
        {liveData?.is_holiday ? (
          <div className="text-center py-16 space-y-4 max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto text-3xl animate-bounce">
              🌴
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Institutional Holiday</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Today is officially registered as a holiday: <span className="font-bold text-brand-500">{liveData.holiday_title}</span>. No regular classes or substitutions are scheduled for today.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-bold uppercase tracking-wider">
              Campus Closed
            </div>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800/80 pb-4 mb-6">
          <div className="flex gap-2">
            {[
              { id: 'classrooms', label: 'Classrooms Map', icon: Building2 },
              { id: 'faculty', label: 'Faculty Locator', icon: Users },
              { id: 'ongoing', label: 'Ongoing Lectures', icon: BookOpen }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                  activeSubTab === tab.id
                    ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content: Classrooms Map */}
        {activeSubTab === 'classrooms' && (
          <div className="space-y-6">
            {/* Filter Panel */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-100/30 dark:bg-slate-900/20 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/30">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search rooms or buildings..."
                  value={classroomsSearch}
                  onChange={(e) => setClassroomsSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl placeholder-slate-455 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <Filter className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Status:</span>
                {['All', 'Free', 'Occupied'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setClassroomsFilter(opt)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      classroomsFilter === opt
                        ? 'bg-brand-500/10 border-brand-500/20 text-brand-650 dark:text-brand-300'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Classrooms Dynamic Grid */}
            {filteredClassrooms.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredClassrooms.map(room => (
                  <div
                    key={room.id}
                    className={`border rounded-2xl p-4 flex flex-col justify-between h-[130px] transition-all relative group overflow-hidden ${
                      room.is_occupied
                        ? 'bg-red-500/5 border-red-555/20 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/5'
                        : 'bg-green-500/5 border-green-555/20 hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/5'
                    }`}
                  >
                    {/* Background glow strip */}
                    <div className={`absolute top-0 inset-x-0 h-1.5 ${room.is_occupied ? 'bg-red-500' : 'bg-green-500'}`} />

                    <div>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-sm font-black text-slate-800 dark:text-white">{room.room_number}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${
                          room.is_occupied
                            ? 'bg-red-500/10 text-red-650 dark:text-red-300 border border-red-500/20'
                            : 'bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20'
                        }`}>
                          {room.is_occupied ? 'OCCUPIED' : 'FREE'}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1 uppercase tracking-wider">{room.building} · Floor {room.floor}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="flex-1 h-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              room.utilization_pct >= 80 ? 'bg-red-500' :
                              room.utilization_pct >= 40 ? 'bg-amber-500' :
                              'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(room.utilization_pct, 100)}%` }}
                          />
                        </div>
                        <span className={`text-[8px] font-bold tabular-nums ${
                          room.utilization_pct >= 80 ? 'text-red-500' :
                          room.utilization_pct >= 40 ? 'text-amber-500' :
                          'text-emerald-500'
                        }`}>{room.utilization_pct}%</span>
                      </div>
                    </div>

                    {room.is_occupied ? (
                      <div className="mt-3 text-left">
                        <p className="text-[10px] font-extrabold text-slate-700 dark:text-slate-200 truncate">{room.current_class.subject_name}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 truncate">
                          Sec: <span className="font-bold text-red-500/80">{room.current_class.section_name}</span>
                        </p>
                      </div>
                    ) : (
                      <div className="mt-3 flex items-center gap-1 text-[9px] text-slate-400">
                        <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />
                        <span>Ready for occupancy</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-450 dark:text-slate-500 text-xs">No classrooms match your search.</div>
            )}
          </div>
        )}

        {/* Tab Content: Faculty Locator */}
        {activeSubTab === 'faculty' && (
          <div className="space-y-6">
            {/* Filter Panel */}
            <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-slate-100/30 dark:bg-slate-900/20 p-3 rounded-2xl border border-slate-200/50 dark:border-slate-800/30">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search faculty name..."
                  value={facultySearch}
                  onChange={(e) => setFacultySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl placeholder-slate-455 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <Filter className="w-3.5 h-3.5 text-slate-450 shrink-0" />
                <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Status:</span>
                {['All', 'Free', 'Teaching'].map(opt => (
                  <button
                    key={opt}
                    onClick={() => setFacultyFilter(opt)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                      facultyFilter === opt
                        ? 'bg-brand-500/10 border-brand-500/20 text-brand-650 dark:text-brand-300'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {/* Faculty Directory List */}
            {filteredFaculty.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFaculty.map(fac => (
                  <div
                    key={fac.id}
                    className="border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex items-center justify-between hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all bg-white dark:bg-slate-950/20"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-500 flex items-center justify-center text-white font-extrabold text-xs shrink-0 shadow-md">
                        {fac.name.split(' ').slice(-1)[0][0] || 'T'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{fac.name}</h4>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Faculty Status: {fac.status}</p>
                      </div>
                    </div>
                    
                    <div className="text-right shrink-0">
                      {fac.is_teaching ? (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-extrabold text-red-500 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">TEACHING</span>
                          <span className="text-[9px] font-bold text-slate-600 dark:text-slate-355 mt-1 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            Room {fac.current_class.room_number} ({fac.current_class.section_name})
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] font-extrabold text-green-500 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">FREE</span>
                          <span className="text-[9px] text-slate-400 mt-1 font-medium">In Dept Office / Library</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-slate-450 dark:text-slate-500 text-xs">No faculty found.</div>
            )}
          </div>
        )}

        {/* Tab Content: Ongoing Classes Timeline */}
        {activeSubTab === 'ongoing' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider mb-2">Live Session Dashboard</h3>
            {liveData?.ongoing_classes?.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/20">
                {liveData.ongoing_classes.map((cls, i) => (
                  <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/10 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-500 shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-white">{cls.subject_name}</span>
                          <span className="text-[9px] bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">{cls.subject_code}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          Section: <span className="font-semibold text-slate-700 dark:text-slate-300">{cls.section_name}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 pl-12 sm:pl-0">
                      <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Instructor</p>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mt-0.5">
                          {cls.staff_name}
                          {cls.is_substituted && (
                            <span className="text-[8px] font-bold bg-amber-500/10 border border-amber-500/25 text-amber-600 px-1.5 py-0.5 rounded" title={`Absence cover for ${cls.original_staff_name}`}>
                              Substitute
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">Location</p>
                        <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {cls.room_number}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass-panel p-10 rounded-2xl text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-white">Campus Free Recess</h4>
                <p className="text-[10px] text-slate-455 dark:text-slate-500">There are no academic classes scheduled during this hour.</p>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
};

export default LiveTracker;
