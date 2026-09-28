import datetime
from typing import Optional, Dict, Any, List

OFFICIAL_HOLIDAYS = {
    # June 2026
    '2026-06-20','2026-06-21','2026-06-26','2026-06-27','2026-06-28',
    # July 2026
    '2026-07-04','2026-07-05','2026-07-11','2026-07-12',
    '2026-07-18','2026-07-19','2026-07-25','2026-07-26',
    # August 2026
    '2026-08-01','2026-08-02','2026-08-08','2026-08-09',
    '2026-08-15', '2026-08-22','2026-08-23', '2026-08-26', '2026-08-29','2026-08-30',
    # September 2026
    '2026-09-05', '2026-09-06','2026-09-07','2026-09-12','2026-09-13',
    '2026-09-14', '2026-09-19','2026-09-20','2026-09-26','2026-09-27',
    # October 2026
    '2026-10-02', '2026-10-03','2026-10-04','2026-10-10','2026-10-11',
    '2026-10-17','2026-10-18', '2026-10-19', '2026-10-20', '2026-10-24','2026-10-25','2026-10-31',
    # November 2026
    '2026-11-01','2026-11-07', '2026-11-08', '2026-11-15','2026-11-22','2026-11-28','2026-11-29',
    # December 2026
    '2026-12-05','2026-12-06','2026-12-12','2026-12-13', '2026-12-19','2026-12-20','2026-12-25','2026-12-26',
    # January 2027
    '2027-01-01', '2027-01-14', '2027-01-15', '2027-01-16', '2027-01-26',
    # February 2027
    '2027-02-14',
    # March 2027
    '2027-03-17', '2027-03-30',
    # April 2027
    '2027-04-14',
}

DO_TO_WEEKDAY_MAP = {
    'I':   'Monday',
    'II':  'Tuesday',
    'III': 'Wednesday',
    'IV':  'Thursday',
    'V':   'Friday',
}

def build_day_order_map(custom_holidays: Optional[List[str]] = None) -> Dict[str, str]:
    day_orders = ['I', 'II', 'III', 'IV', 'V']
    result_map = {}
    extra_holidays = set(custom_holidays) if custom_holidays else set()

    current = datetime.date(2026, 6, 24)
    end = datetime.date(2027, 6, 30)
    order_idx = 0

    while current <= end:
        date_str = current.strftime("%Y-%m-%d")
        weekday = current.weekday()  # 0=Mon, 6=Sun

        if weekday < 5 and date_str not in OFFICIAL_HOLIDAYS and date_str not in extra_holidays:
            result_map[date_str] = day_orders[order_idx % 5]
            order_idx += 1

        current += datetime.timedelta(days=1)

    return result_map

_CACHED_DAY_ORDER_MAP = None

def get_day_order_info(target_date_str: str, custom_holidays: Optional[List[str]] = None) -> Dict[str, Any]:
    global _CACHED_DAY_ORDER_MAP
    if _CACHED_DAY_ORDER_MAP is None or custom_holidays:
        _CACHED_DAY_ORDER_MAP = build_day_order_map(custom_holidays)

    try:
        parsed = datetime.datetime.strptime(target_date_str, "%Y-%m-%d").date()
    except ValueError:
        parsed = datetime.date.today()
        target_date_str = parsed.strftime("%Y-%m-%d")

    day_of_week_name = parsed.strftime("%A")
    is_weekend = parsed.weekday() >= 5

    extra_holidays = set(custom_holidays) if custom_holidays else set()
    is_holiday = is_weekend or target_date_str in OFFICIAL_HOLIDAYS or target_date_str in extra_holidays

    day_order = _CACHED_DAY_ORDER_MAP.get(target_date_str)
    timetable_day = DO_TO_WEEKDAY_MAP.get(day_order) if day_order else None

    return {
        "date_str": target_date_str,
        "day_of_week_name": day_of_week_name,
        "day_order": day_order,
        "day_order_label": f"DO-{day_order}" if day_order else None,
        "timetable_day": timetable_day,
        "is_class_day": not is_holiday and bool(day_order),
        "is_holiday": is_holiday,
        "is_weekend": is_weekend,
    }
