// ─── Official SRM Academic Holidays 2026-27 ──────────────────────────────
export const OFFICIAL_HOLIDAYS = new Set([
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
  // November 2026
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

export const DO_TO_WEEKDAY_MAP = {
  'I':   'Monday',
  'II':  'Tuesday',
  'III': 'Wednesday',
  'IV':  'Thursday',
  'V':   'Friday',
};

export const WEEKDAY_TO_DO_MAP = {
  'Monday':    'I',
  'Tuesday':   'II',
  'Wednesday': 'III',
  'Thursday':  'IV',
  'Friday':    'V',
};

export const WEEKDAY_TO_DAY_ORDER_NAME = {
  'Monday':    'Day Order I',
  'Tuesday':   'Day Order II',
  'Wednesday': 'Day Order III',
  'Thursday':  'Day Order IV',
  'Friday':    'Day Order V',
};

/**
 * Build mapping of date (YYYY-MM-DD) -> Day Order ('I' | 'II' | 'III' | 'IV' | 'V')
 */
export function buildDayOrderMap(customHolidays = []) {
  const dayOrders = ['I', 'II', 'III', 'IV', 'V'];
  const map = {};

  const extraHolidays = new Set(
    customHolidays
      .filter(ev => ev.type === 'holiday')
      .map(ev => ev.date)
  );

  function localDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  let current = new Date(2026, 5, 24); // June 24, 2026 (Day Order I start)
  const end   = new Date(2027, 5, 30); // June 30, 2027
  let orderIdx = 0;

  while (current <= end) {
    const dateStr   = localDateStr(current);
    const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat

    if (dayOfWeek >= 1 && dayOfWeek <= 5 && !OFFICIAL_HOLIDAYS.has(dateStr) && !extraHolidays.has(dateStr)) {
      map[dateStr] = dayOrders[orderIdx % 5];
      orderIdx++;
    }

    current.setDate(current.getDate() + 1);
  }
  return map;
}

let cachedDayOrderMap = null;

export function getDayOrderInfo(targetDate = new Date(), customEvents = []) {
  if (!cachedDayOrderMap || customEvents.length > 0) {
    cachedDayOrderMap = buildDayOrderMap(customEvents);
  }

  let dateObj;
  if (typeof targetDate === 'string') {
    const [y, m, d] = targetDate.split('-').map(Number);
    dateObj = new Date(y, m - 1, d);
  } else {
    dateObj = new Date(targetDate);
  }

  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeekNum = dateObj.getDay();
  const dayOfWeekName = WEEKDAYS[dayOfWeekNum];
  const isWeekend = dayOfWeekNum === 0 || dayOfWeekNum === 6;

  // Check custom holiday
  const holidayEvent = customEvents.find(ev => ev.date === dateStr && ev.type === 'holiday');
  const isHoliday = isWeekend || OFFICIAL_HOLIDAYS.has(dateStr) || !!holidayEvent;
  const holidayTitle = holidayEvent ? holidayEvent.title : (OFFICIAL_HOLIDAYS.has(dateStr) ? 'Official Holiday' : null);

  const dayOrder = cachedDayOrderMap[dateStr] || null;
  const timetableDay = dayOrder ? DO_TO_WEEKDAY_MAP[dayOrder] : null;

  return {
    dateStr,
    dayOfWeekName,     // e.g. "Monday"
    dayOrder,          // e.g. "V"
    dayOrderLabel: dayOrder ? `DO-${dayOrder}` : null, // e.g. "DO-V"
    timetableDay,      // e.g. "Friday"
    isClassDay: !isHoliday && !!dayOrder,
    isHoliday,
    isWeekend,
    holidayTitle,
  };
}
