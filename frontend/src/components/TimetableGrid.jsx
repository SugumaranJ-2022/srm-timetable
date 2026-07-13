import React from 'react';
import { Monitor, MapPin, Coffee, AlertCircle } from 'lucide-react';

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
  projectDays = []
}) => {
  
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
          {DAYS_OF_WEEK.map((day) => (
            <tr key={day} className="hover:bg-slate-200/20 dark:hover:bg-slate-800/5 transition-colors">
              {/* Day Label Cell */}
              <td className="px-4 py-6 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100/30 dark:bg-slate-950/10">
                {day}
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
                  const cardBg = isProjectSub ? 'rgba(239, 68, 68, 0.12)' : getStableColor(detail.subject_code);
                  const cardBorder = isProjectSub ? 'rgba(239, 68, 68, 0.45)' : getStableBorderColor(detail.subject_code);
                  
                  content = (
                    <div 
                      style={{ backgroundColor: cardBg, borderColor: cardBorder }}
                      className={`p-2.5 rounded-xl border flex flex-col h-full justify-between transition-all duration-200 select-none shadow-sm ${
                        isEditable ? 'cursor-grab active:cursor-grabbing hover:scale-[1.02]' : ''
                      } ${isProjectSub ? 'ring-1 ring-red-500/20' : ''}`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <div className="font-bold text-xs text-slate-800 dark:text-white tracking-wide truncate">
                          {detail.subject_name}
                        </div>
                        {isProjectSub ? (
                          <span className="text-[8px] font-extrabold text-red-600 dark:text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/35 uppercase select-none">
                            Proj
                          </span>
                        ) : slotType === 'Online' ? (
                          <Monitor className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
                        )}
                      </div>
                      
                      <div className="text-[10px] text-slate-550 dark:text-slate-400 font-semibold mt-1">
                        Code: {detail.subject_code}
                      </div>

                      <div className="flex justify-between items-center mt-2.5 pt-1.5 border-t border-slate-200 dark:border-slate-800/30 text-[10px]">
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[80px]">
                          {detail.staff_name}
                        </span>
                        <span className="font-bold text-brand-700 dark:text-brand-300 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/15">
                          {detail.room_number || 'Online'}
                        </span>
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TimetableGrid;
