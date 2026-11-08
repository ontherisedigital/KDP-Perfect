/** Calendar maths for the designer. Dates are plain local dates (no time zones involved). */

export type WeekStart = 'sun' | 'mon';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface SimpleDate {
  y: number;
  /** 0-11 */
  m: number;
  d: number;
}

export const toDate = (s: SimpleDate) => new Date(s.y, s.m, s.d);
export const fromDate = (d: Date): SimpleDate => ({ y: d.getFullYear(), m: d.getMonth(), d: d.getDate() });
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

export function addDays(s: SimpleDate, n: number): SimpleDate {
  return fromDate(new Date(s.y, s.m, s.d + n));
}
export function addMonths(s: SimpleDate, n: number): SimpleDate {
  return fromDate(new Date(s.y, s.m + n, 1));
}

/** `2027-03` or `2027-03-14` to a date (day 1 when missing). */
export function parseDate(v: string): SimpleDate | null {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(v.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: m[3] ? Number(m[3]) : 1 };
}

/** Weekday names in display order. */
export function weekdayOrder(start: WeekStart): number[] {
  return start === 'mon' ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
}

/** Rows of 7 day numbers (null = outside the month), always enough rows for the month (4-6). */
export function monthMatrix(y: number, m: number, start: WeekStart): (number | null)[][] {
  const first = new Date(y, m, 1).getDay();
  const lead = (first - (start === 'mon' ? 1 : 0) + 7) % 7;
  const n = daysInMonth(y, m);
  const cells: (number | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= n; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** The first day of the week containing `s`. */
export function weekStartOf(s: SimpleDate, start: WeekStart): SimpleDate {
  const wd = toDate(s).getDay();
  const back = (wd - (start === 'mon' ? 1 : 0) + 7) % 7;
  return addDays(s, -back);
}

export type DateFormat = 'long' | 'month-year' | 'month' | 'weekday-day' | 'short' | 'iso' | 'week-of';

export const DATE_FORMATS: readonly { id: DateFormat; label: string }[] = [
  { id: 'long', label: 'Monday, March 1, 2027' },
  { id: 'month-year', label: 'March 2027' },
  { id: 'month', label: 'March' },
  { id: 'weekday-day', label: 'Monday 1' },
  { id: 'short', label: 'Mar 1' },
  { id: 'iso', label: '2027-03-01' },
  { id: 'week-of', label: 'Week of Mar 1' },
];

export function formatDate(s: SimpleDate, f: DateFormat): string {
  const wd = WEEKDAYS[toDate(s).getDay()]!;
  const mon = MONTHS[s.m]!;
  switch (f) {
    case 'long':
      return `${wd}, ${mon} ${s.d}, ${s.y}`;
    case 'month-year':
      return `${mon} ${s.y}`;
    case 'month':
      return mon;
    case 'weekday-day':
      return `${wd} ${s.d}`;
    case 'short':
      return `${mon.slice(0, 3)} ${s.d}`;
    case 'iso':
      return `${s.y}-${String(s.m + 1).padStart(2, '0')}-${String(s.d).padStart(2, '0')}`;
    case 'week-of':
      return `Week of ${mon.slice(0, 3)} ${s.d}`;
  }
}
