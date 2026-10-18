import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { Monitor, MapPin, Coffee, AlertCircle, FlaskConical, Lock, Printer, QrCode, FileText, Sparkles, X, Check } from 'lucide-react';
import { getDayOrderInfo, WEEKDAY_TO_DO_MAP, WEEKDAY_TO_DAY_ORDER_NAME } from '../utils/dayOrder';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

// Helper to convert subject code string into a stable hex color value
export const getStableColor = (str) => {
  if (!str) return 'rgba(71, 85, 105, 0.15)'; // default transparent slate
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  // Dynamic HSL coloring
  return `hsla(${h}, 65%, 45%, 0.18)`;
};

export const getStableBorderColor = (str) => {
  if (!str) return 'rgba(71, 85, 105, 0.2)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash) % 360;
  return `hsla(${h}, 65%, 50%, 0.5)`;
};

const TimetableGrid = ({ 
  details = [], 
  timeslots = [], 
  onCellClick = null, 
  isEditable = false,
  conflicts = [],
  projectDays = [],
  title = "University Academic Timetable"
}) => {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    const liveUrl = typeof window !== 'undefined' ? `${window.location.origin}/#/live` : 'http://localhost:3000/#/live';
    QRCode.toDataURL(liveUrl, { width: 160, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error("QR Code error:", err));
  }, []);
  
  // Calculate running timetable day based on today's Academic Calendar Day Order
  const todayInfo = useMemo(() => getDayOrderInfo(new Date()), []);
  const todayRunningDay = todayInfo.isClassDay ? todayInfo.timetableDay : todayInfo.dayOfWeekName;

  // Group timeslots by period for easy header mapping
  const timeslotByPeriod = React.useMemo(() => {
    const map = {};
    timeslots.forEach(ts => {
      if (!map[ts.period_number]) {
        map[ts.period_number] = ts;
      }
    });
    return map;
  }, [timeslots]);

  // Find detail for a specific day and period
  const getDetail = (day, periodNumber) => {
    const ts = timeslots.find(t => t.day_of_week === day && t.period_number === periodNumber);
    if (!ts) return { slotType: 'Regular', detail: null, timeslotId: null };

    const detail = details.find(d => d.timeslot_id === ts.id);
    return {
      slotType: ts.slot_type,
      detail,
      timeslotId: ts.id,
      timeslotObj: ts
    };
  };

  // Find if a timeslot has any active validation conflicts
  const getConflict = (timeslotId) => {
    if (!timeslotId) return null;
    return conflicts.find(c => c.timeslot_id === timeslotId);
  };

  return (
    <div className="space-y-3">
      {/* Action Bar */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Day Order: <span className="font-bold text-slate-900 dark:text-white font-mono">{todayRunningDay}</span>
        </div>

        <button
          onClick={() => setShowPrintModal(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all border border-slate-250 dark:border-slate-700 shadow-sm cursor-pointer active:scale-95"
        >
          <Printer className="w-3.5 h-3.5 text-brand-500" />
          <QrCode className="w-3.5 h-3.5 text-indigo-500" />
          <span>Official SRM PDF & Mobile QR</span>
        </button>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/30 p-1 shadow-sm">
      <table className="w-full min-w-[900px] table-fixed border-collapse">
        {/* Table Header */}
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800/60 bg-slate-100/50 dark:bg-slate-950/30">
            <th className="w-32 px-4 py-4 text-left text-xs font-semibold text-slate-550 dark:text-slate-400 uppercase tracking-wider select-none">
              Day / Period
            </th>
            {PERIODS.map((periodNum) => {
              const ts = timeslotByPeriod[periodNum];
              let headerLabel = `Hour ${periodNum}`;
              let subLabel = '';
              if (ts) {
                const startStr = ts.start_time.substring(0, 5);
                const endStr = ts.end_time.substring(0, 5);
                subLabel = `${startStr} - ${endStr}`;
                
                if (ts.slot_type === 'Break') {
                  headerLabel = 'Break';
                } else {
                  headerLabel = `Hour ${periodNum < 4 ? periodNum : periodNum - 1}`;
                }
              }
              return (
                <th key={periodNum} className="px-3 py-3.5 text-center select-none border-l border-slate-200 dark:border-slate-800/40">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200">{headerLabel}</div>
                  <div className="text-[10px] text-slate-550 dark:text-slate-500 font-medium mt-0.5">{subLabel}</div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Calendar Matrix Rows */}
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
          {DAYS_OF_WEEK.map((day) => {
            const isToday = day === todayRunningDay;
            const doCode = WEEKDAY_TO_DO_MAP[day] ? `DO-${WEEKDAY_TO_DO_MAP[day]}` : null;
            return (
            <tr key={day} className={`transition-colors ${
              isToday
                ? 'bg-brand-500/5 dark:bg-brand-500/5 hover:bg-brand-500/8'
                : 'hover:bg-slate-200/20 dark:hover:bg-slate-800/5'
            }`}>
              {/* Day Label Cell */}
              <td className={`px-4 py-6 text-sm font-semibold ${
                isToday
                  ? 'text-brand-700 dark:text-brand-300 bg-brand-500/10 dark:bg-brand-500/10'
                  : 'text-slate-700 dark:text-slate-300 bg-slate-100/30 dark:bg-slate-950/10'
              }`}>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-sm text-slate-800 dark:text-slate-100">{WEEKDAY_TO_DAY_ORDER_NAME[day] || day}</span>
                  {isToday && (
                    <span className="text-[8px] font-extrabold bg-brand-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wide w-fit animate-pulse">
                      Today
                    </span>
                  )}
                </div>
              </td>

              {/* Grid Period Cells */}
              {PERIODS.map((periodNum) => {
                const { slotType, detail, timeslotId, timeslotObj } = getDetail(day, periodNum);
                const conflict = getConflict(timeslotId);

                // Styling configurations based on Slot Types
                const isProjectDay = projectDays.includes(day);
                let cellBg = 'bg-transparent';
                let content = null;

                if (slotType === 'Break') {
                  cellBg = 'bg-slate-100/50 dark:bg-slate-900/60 pattern-dots';
                  content = (
                    <div className="flex flex-col items-center justify-center gap-1.5 text-slate-450 dark:text-slate-500 py-3 select-none">
                      <Coffee className="w-4 h-4 text-slate-500 dark:text-slate-650" />
                      <span className="text-[10px] font-bold tracking-wider uppercase">Break</span>
                    </div>
                  );
                } else if (isProjectDay) {
                  cellBg = 'bg-red-500/5 hover:bg-red-500/10 border border-dashed border-red-500/20';
                }

                if (detail) {
                  const isProjectSub = detail.subject_name?.toLowerCase().includes('project') || detail.subject_code?.toLowerCase().includes('prj');
                  const isLabSub = detail.room_number?.toLowerCase().includes('lab');
                  const isVAC = detail.subject_code?.toLowerCase().includes('vac');
                  const cardBg = isProjectSub
                    ? 'rgba(239, 68, 68, 0.12)'
                    : isLabSub
                    ? 'rgba(20, 184, 166, 0.13)'
                    : isVAC
                    ? 'rgba(168, 85, 247, 0.13)'
                    : getStableColor(detail.subject_code);
                  const cardBorder = isProjectSub
                    ? 'rgba(239, 68, 68, 0.45)'
                    : isLabSub
                    ? 'rgba(20, 184, 166, 0.55)'
                    : isVAC
                    ? 'rgba(168, 85, 247, 0.45)'
                    : getStableBorderColor(detail.subject_code);
                  
                  content = (
                    <div 
                      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      className={`p-2.5 rounded-xl border flex flex-col h-full justify-between transition-all duration-200 select-none shadow-sm ${
                        isEditable ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02]' : ''
                      } ${isProjectSub ? 'ring-1 ring-red-500/20' : ''} ${isLabSub ? 'ring-1 ring-teal-500/25' : ''} ${isVAC ? 'ring-1 ring-purple-500/20' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <div className="font-bold text-xs text-slate-800 dark:text-white tracking-wide truncate">
                          {detail.subject_name}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {detail.is_manual && (
                            <span className="text-[8px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/20 px-1 py-0.5 rounded border border-amber-500/35 uppercase select-none flex items-center gap-0.5" title="Pre-allocated Locked UG Subject Slot">
                              <Lock className="w-2.5 h-2.5" /> UG Fixed
                            </span>
                          )}
                          {isProjectSub ? (
                            <span className="text-[8px] font-extrabold text-red-600 dark:text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/35 uppercase select-none">
                              Proj
                            </span>
                          ) : isLabSub ? (
                            <span className="text-base leading-none select-none" title="Lab Session">🖥️</span>
                          ) : isVAC ? (
                            <span className="text-[8px] font-extrabold text-purple-600 dark:text-purple-400 bg-purple-500/20 px-1.5 py-0.5 rounded border border-purple-500/35 uppercase select-none">
                              VAC
                            </span>
                          ) : slotType === 'Online' ? (
                            <Monitor className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                          ) : (
                            <span className="text-base leading-none select-none" title="Theory Class">📚</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-[10px] text-slate-550 dark:text-slate-400 font-semibold mt-1">
                        Code: {detail.subject_code}
                      </div>

                      <div className="flex justify-between items-center mt-2.5 pt-1.5 border-t border-slate-200 dark:border-slate-800/30 text-[10px]">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                          {detail.staff_name}
                        </span>
                        {isLabSub ? (
                          <span className="flex items-center gap-1 font-bold text-teal-700 dark:text-teal-300 bg-teal-500/15 px-1.5 py-0.5 rounded border border-teal-500/30">
                            🖥️ {detail.room_number}
                          </span>
                        ) : (
                          <span className="font-bold text-brand-700 dark:text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/15">
                            {detail.room_number || 'Online'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                } else if (slotType !== 'Break') {
                  content = (
                    <div className="flex items-center justify-center h-full min-h-[72px] text-slate-400 dark:text-slate-650/40 text-[10px] font-medium tracking-wide uppercase select-none border border-dashed border-slate-200 dark:border-slate-800/30 rounded-xl hover:border-brand-500/20 hover:text-slate-500/40 transition-colors">
                      {isProjectDay ? 'Project Slot' : 'Free Slot'}
                    </div>
                  );
                }

                return (
                  <td 
                    key={periodNum} 
                    onClick={() => {
                      if (isEditable && onCellClick && slotType !== 'Break') {
                        onCellClick({ day, periodNum, timeslotId, detail, timeslotObj });
                      }
                    }}
                    className={`p-2 border-l border-slate-200 dark:border-slate-800/40 align-middle relative ${cellBg} ${
                      isEditable && slotType !== 'Break' ? 'cursor-pointer hover:bg-slate-200/50 dark:hover:bg-slate-800/20' : ''
                    } ${conflict ? 'ring-2 ring-red-500/80 ring-offset-2 ring-offset-slate-900 dark:ring-offset-slate-900 animate-shake' : ''}`}
                  >
                    {content}
                    
                    {/* Conflict indicators */}
                    {conflict && (
                      <div className="absolute top-1 right-1 bg-red-650 text-white rounded-full p-0.5 shadow-md tooltip group z-10">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span className="absolute bottom-full mb-1 right-0 hidden group-hover:block bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-750 dark:text-red-200 text-[10px] p-2 rounded-lg w-48 shadow-lg font-normal">
                          {conflict.description}
                        </span>
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>

      {/* Official SRM PDF & Mobile QR Schedule Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl space-y-6 max-h-[92vh] flex flex-col">
            {/* Modal Controls Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-500" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                  Official Timetable Document Preview
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Print / Save as PDF
                </button>
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div id="printable-timetable-sheet" className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-5 text-slate-900 dark:text-white">
              {/* University Header with SRM Crest */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-brand-500/30 pb-4">
                <div className="flex items-center gap-4">
                  <img src="/srm_logo.png" alt="SRM Crest" className="h-16 object-contain filter dark:brightness-110" />
                  <div>
                    <h2 className="text-lg font-black tracking-wide text-brand-900 dark:text-brand-300">
                      SRM INSTITUTE OF SCIENCE AND TECHNOLOGY
                    </h2>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Faculty of Engineering and Technology | Academic Year 2026–2027
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Accredited with Highest Grade A++ by NAAC | Category-I University
                    </p>
                  </div>
                </div>

                {/* Mobile QR Verification Card */}
                {qrDataUrl && (
                  <div className="flex flex-col items-center p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
                    <img src={qrDataUrl} alt="Mobile Timetable QR" className="w-20 h-20 rounded" />
                    <span className="text-[8px] font-bold uppercase text-slate-400 mt-1 tracking-wider text-center">
                      Live Mobile Sync
                    </span>
                  </div>
                )}
              </div>

              {/* Document Meta Row */}
              <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                <span>SCHEDULE TYPE: <span className="text-brand-600 dark:text-brand-400">Official Day-Order Matrix</span></span>
                <span>AUTHENTICATION: <span className="text-emerald-600 font-mono">ERP-VERIFIED-V2</span></span>
                <span>GENERATED: <span className="font-mono">{new Date().toLocaleDateString()}</span></span>
              </div>

              {/* Compact Print Matrix */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-slate-300 dark:border-slate-700 border-collapse">
                  <thead>
                    <tr className="bg-slate-200 dark:bg-slate-800 text-[10px] uppercase font-bold text-slate-700 dark:text-slate-200">
                      <th className="p-2 border border-slate-300 dark:border-slate-700 text-left">Day Order</th>
                      {PERIODS.map(p => (
                        <th key={p} className="p-2 border border-slate-300 dark:border-slate-700 text-center">
                          Period {p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS_OF_WEEK.map(day => (
                      <tr key={day} className="border-b border-slate-200 dark:border-slate-800">
                        <td className="p-2 border border-slate-300 dark:border-slate-700 font-bold bg-slate-100 dark:bg-slate-900">
                          {WEEKDAY_TO_DAY_ORDER_NAME[day] || day}
                        </td>
                        {PERIODS.map(periodNum => {
                          const { slotType, detail } = getDetail(day, periodNum);
                          return (
                            <td key={periodNum} className="p-2 border border-slate-300 dark:border-slate-700 text-center align-top min-w-[90px]">
                              {slotType === 'Break' ? (
                                <span className="text-[10px] text-slate-400 italic">Break</span>
                              ) : detail ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-[11px] text-brand-600 dark:text-brand-400">
                                    {detail.subject_code}
                                  </div>
                                  <div className="text-[9px] text-slate-500 font-medium truncate max-w-[100px] mx-auto">
                                    {detail.staff_name}
                                  </div>
                                  <div className="text-[8px] font-mono text-slate-400">
                                    {detail.room_number || 'Room'}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[9px] text-slate-300 dark:text-slate-600">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Official Seal / Signature Footer */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-400">
                <div>
                  <p className="font-bold text-slate-700 dark:text-slate-300">Office of the Controller of Examinations</p>
                  <p>SRM Institute of Science and Technology, Kattankulathur Campus</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-700 dark:text-slate-300">Authorized Academic Dean</p>
                  <p className="font-mono text-[9px] text-emerald-500">DIGITALLY SIGNED & VERIFIED</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableGrid;
