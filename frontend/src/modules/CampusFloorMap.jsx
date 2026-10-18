import React, { useState, useEffect } from 'react';
import { timetableApi } from '../services/api';
import {
  Building2,
  MapPin,
  Users,
  BookOpen,
  Clock,
  Search,
  CheckCircle,
  AlertCircle,
  Radio,
  Layers,
  Sparkles,
  RefreshCw,
  Monitor,
  GraduationCap
} from 'lucide-react';

const CampusFloorMap = () => {
  const [occupancyData, setOccupancyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VACANT' | 'OCCUPIED'

  const fetchLiveOccupancy = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError('');
    try {
      const data = await timetableApi.getLiveCampusOccupancy();
      setOccupancyData(data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch real-time campus room occupancy.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveOccupancy(true);
    const interval = setInterval(() => {
      fetchLiveOccupancy(false);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !occupancyData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 tracking-wider uppercase animate-pulse">
          Scanning Campus Floor Sensors...
        </p>
      </div>
    );
  }

  // Filtered rooms
  const allFloors = occupancyData?.floors || [];
  const activeFloorRooms = allFloors
    .filter(f => selectedFloor === 'ALL' || f.floor_name === selectedFloor)
    .flatMap(f => f.rooms.map(r => ({ ...r, floor_name: f.floor_name })))
    .filter(room => {
      const matchSearch =
        !searchQuery.trim() ||
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (room.subject && room.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (room.staff && room.staff.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (room.section && room.section.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'VACANT' && !room.is_occupied) ||
        (statusFilter === 'OCCUPIED' && room.is_occupied);

      return matchSearch && matchStatus;
    });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Live Campus Floor Map
                <span className="flex items-center gap-1 text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live Sensor Feed
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time architectural occupancy, active lectures, room availability, and live countdowns.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchLiveOccupancy(true)}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer shadow-xs"
            title="Refresh Map"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="glass-panel p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Classrooms & Labs</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">
            {occupancyData?.total_rooms || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1 font-semibold">Across all campus blocks</div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-red-500/20 bg-red-500/5 dark:bg-red-950/20 shadow-xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-red-600 dark:text-red-400 flex items-center justify-between">
            <span>Occupied / In Session</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </div>
          <div className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
            {occupancyData?.occupied_rooms || 0}
          </div>
          <div className="text-[10px] text-red-600/80 dark:text-red-400/80 mt-1 font-semibold">
            {occupancyData?.occupancy_rate || 0}% Campus Utilization
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 shadow-xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Vacant (Study Ready)
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            {occupancyData?.vacant_rooms || 0}
          </div>
          <div className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 font-semibold">
            Free for self-study / discussions
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-brand-500/20 bg-brand-500/5 dark:bg-brand-950/20 shadow-xs">
          <div className="text-[10px] font-black uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Current Schedule Matrix
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white mt-1 truncate">
            {occupancyData?.day_order || 'Day Order 1'}
          </div>
          <div className="text-[10px] text-brand-600/80 dark:text-brand-400/80 mt-1 font-semibold">
            Period {occupancyData?.active_period || 1} • {occupancyData?.active_time_range || 'Active'}
          </div>
        </div>
      </div>

      {/* Filter and Floor Selector */}
      <div className="glass-panel p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800/60 space-y-3.5 shadow-xs">
        {/* Floor Navigation Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800/80">
          <button
            onClick={() => setSelectedFloor('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              selectedFloor === 'ALL'
                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-white'
            }`}
          >
            All Campus Blocks
          </button>
          {allFloors.map(f => (
            <button
              key={f.floor_name}
              onClick={() => setSelectedFloor(f.floor_name)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedFloor === f.floor_name
                  ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-white'
              }`}
            >
              {f.floor_name}
            </button>
          ))}
        </div>

        {/* Search & Status Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Room, Professor, or Subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              All Status
            </button>
            <button
              onClick={() => setStatusFilter('VACANT')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 ${
                statusFilter === 'VACANT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
              Free Only
            </button>
            <button
              onClick={() => setStatusFilter('OCCUPIED')}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 ${
                statusFilter === 'OCCUPIED'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span>
              In Session
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Room Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {activeFloorRooms.map(room => {
          const isOccupied = room.is_occupied;
          const isLab = room.is_lab;

          return (
            <div
              key={room.id}
              className={`p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden group shadow-sm hover:shadow-md ${
                isOccupied
                  ? isLab
                    ? 'bg-gradient-to-br from-white to-purple-500/10 dark:from-slate-900/40 dark:to-purple-950/30 border-purple-500/30'
                    : 'bg-gradient-to-br from-white to-red-500/10 dark:from-slate-900/40 dark:to-red-950/30 border-red-500/30'
                  : 'bg-gradient-to-br from-white to-emerald-500/5 dark:from-slate-900/40 dark:to-emerald-950/20 border-emerald-500/25 hover:border-emerald-500/50'
              }`}
            >
              {/* Header: Room Name & Status Beacon */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-xl text-xs font-black uppercase ${
                      isOccupied
                        ? isLab
                          ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                          : 'bg-red-500/20 text-red-700 dark:text-red-300'
                        : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {isLab ? <Monitor className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white leading-tight">
                      {room.name}
                    </h3>
                    <div className="text-[10px] font-bold text-slate-400">
                      Cap: {room.capacity} • {room.floor_name?.split('(')[0]?.trim()}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
                    isOccupied
                      ? isLab
                        ? 'bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30'
                        : 'bg-red-500/20 text-red-800 dark:text-red-300 border border-red-500/30'
                      : 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full inline-block ${
                      isOccupied ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'
                    }`}
                  />
                  {isOccupied ? (isLab ? 'LAB ACTIVE' : 'IN SESSION') : 'VACANT'}
                </span>
              </div>

              {/* Body: Session Details or Free Study Indicator */}
              {isOccupied ? (
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Course / Lecture</div>
                    <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                      {room.subject}
                    </div>
                    {room.subject_code && (
                      <span className="text-[9px] font-mono font-bold text-slate-400">
                        {room.subject_code}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Instructor</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1">
                        <span>{room.staff}</span>
                        {room.is_substituted && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400">
                            Cover
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Section</div>
                      <div className="font-extrabold text-brand-600 dark:text-brand-400">{room.section}</div>
                    </div>
                  </div>

                  {/* Progress / Remaining Time Bar */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-red-500" />
                        Remaining
                      </span>
                      <span className="text-red-600 dark:text-red-400 font-extrabold">
                        ~{room.time_remaining_minutes} mins
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-red-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(15, 100 - room.time_remaining_minutes * 1.8)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Available for Use</div>
                    <div className="text-[10px] text-slate-400">Quiet study zone • Seminar ready</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeFloorRooms.length === 0 && (
        <div className="p-12 text-center text-xs text-slate-400 glass-panel rounded-3xl">
          No classrooms match your search filter criteria.
        </div>
      )}
    </div>
  );
};

export default CampusFloorMap;
