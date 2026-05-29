// Pure formatting helpers — shared across screens. No side effects.

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
const MONTHS_LONG = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
] as const;
const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'] as const;

export function fmtGbp(n: number | null | undefined): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return '£' + (Number.isInteger(n) ? n.toString() : n.toFixed(2));
}

export function fmtGbpInt(n: number | null | undefined): string {
  if (typeof n !== 'number' || !isFinite(n)) return '—';
  return '£' + Math.round(n).toLocaleString('en-GB');
}

export function fmtPeriod(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} – ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

export function fmtMonth(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtMonthShort(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export function fmtHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function fmtFullDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function fmtPeriodFull(startIso: string): string {
  const s = new Date(startIso);
  const monthStart = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth() + 1, 0));
  return `${monthStart.getUTCDate()}–${monthEnd.getUTCDate()} ${MONTHS[s.getUTCMonth()]} ${s.getUTCFullYear()}`;
}

// Shift date helpers — input is YYYY-MM-DD; pin to noon UTC.
export function shiftDayAbbr(yyyyMmDd: string): string {
  return DAYS[new Date(yyyyMmDd + 'T12:00:00Z').getUTCDay()];
}
export function shiftDayNum(yyyyMmDd: string): number {
  return parseInt(yyyyMmDd.slice(8, 10), 10);
}
export function fmtShortDate(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T12:00:00Z');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
