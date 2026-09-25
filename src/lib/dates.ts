// Date helpers. All moment dates are plain ISO dates (yyyy-mm-dd) without time,
// handled in local time so nothing shifts around midnight.

export const TIMELINE_START = '2026-09-01';
export const TIMELINE_END = '2027-12-31';

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

/** Same day n months later (clamped to the month's last day). */
export function addMonthsKeepDay(iso: string, n: number): string {
  const d = parseISO(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return toISO(d);
}

/** "2026-10" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function monthStart(key: string): string {
  return `${key}-01`;
}

export function daysInMonth(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthEnd(key: string): string {
  return `${key}-${String(daysInMonth(key)).padStart(2, '0')}`;
}

export function nextMonthKey(key: string): string {
  return monthKey(addMonths(monthStart(key), 1));
}

/** Inclusive list of month keys between two keys. */
export function monthsBetween(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let k = fromKey;
  let guard = 0;
  while (k <= toKey && guard++ < 240) {
    out.push(k);
    k = nextMonthKey(k);
  }
  return out;
}

export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

const fmtDayMonth = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short' });
const fmtDayMonthYear = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtLong = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtMonthYear = new Intl.DateTimeFormat('nl-BE', { month: 'long', year: 'numeric' });
const fmtMonthShort = new Intl.DateTimeFormat('nl-BE', { month: 'short' });
const fmtWeekdayShort = new Intl.DateTimeFormat('nl-BE', { weekday: 'short' });

/** "23 sep." */
export function fmtShort(iso: string): string {
  return fmtDayMonth.format(parseISO(iso));
}

/** "23 sep. 2026" */
export function fmtMedium(iso: string): string {
  return fmtDayMonthYear.format(parseISO(iso));
}

/** "woensdag 23 september 2026" */
export function fmtLongDate(iso: string): string {
  return fmtLong.format(parseISO(iso));
}

/** "oktober 2026" */
export function fmtMonthYearKey(key: string): string {
  return fmtMonthYear.format(parseISO(monthStart(key)));
}

/** "Oktober 2026" */
export function fmtMonthTitle(key: string): string {
  const s = fmtMonthYearKey(key);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "okt." */
export function fmtMonthAbbr(key: string): string {
  return fmtMonthShort.format(parseISO(monthStart(key)));
}

export function fmtWeekday(iso: string): string {
  return fmtWeekdayShort.format(parseISO(iso));
}

export function dayOfMonth(iso: string): number {
  return parseISO(iso).getDate();
}

/** "3 min geleden", "gisteren", "12 sep." */
export function fmtRelative(isoDateTime: string, now = new Date()): string {
  const t = new Date(isoDateTime);
  const sec = Math.round((now.getTime() - t.getTime()) / 1000);
  if (sec < 45) return 'zonet';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min geleden`;
  const hours = Math.round(min / 60);
  if (hours < 24 && t.getDate() === now.getDate()) return `${hours} u geleden`;
  const days = diffDays(toISO(t), toISO(now));
  if (days === 1) return 'gisteren';
  if (days < 7) return `${days} dagen geleden`;
  return fmtMedium(toISO(t));
}

export function nowStamp(): string {
  return new Date().toISOString();
}
