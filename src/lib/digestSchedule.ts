// When the monthly digest goes out by itself (Dashboard → Digest-preview → "Elke maand automatisch versturen").
// Shared by the screen (which date is next) and the digest edge function (is it time now?).
import { addDays, dayOfMonth, monthKey, monthStart, nextMonthKey, parseISO } from './dates';

/** Hour (Brussels time) from which the automatic digest leaves on its day. */
export const AUTO_DIGEST_HOUR = 8;
/** If it could not leave on the first working day (e.g. an outage), it is retried up to this day of the month. */
export const AUTO_DIGEST_LAST_DAY = 7;
/** A digest sent up to this many days before the 1st already counts for that month. */
export const AUTO_DIGEST_GRACE_DAYS = 7;

/** Public holidays that can fall on the 1st of a month (mm-dd). */
const HOLIDAYS_ON_THE_FIRST = ['01-01', '05-01', '11-01'];

export interface BrusselsTime {
  /** yyyy-mm-dd */
  date: string;
  hour: number;
}

/** Date and hour in Belgium, wherever this code runs (the edge functions run in UTC). */
export function brusselsNow(at: Date = new Date()): BrusselsTime {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

export function isWorkday(iso: string): boolean {
  const weekday = parseISO(iso).getDay();
  return weekday !== 0 && weekday !== 6 && !HOLIDAYS_ON_THE_FIRST.includes(iso.slice(5));
}

/** First working day of the month "yyyy-mm": Monday to Friday, not 1 January, 1 May or 1 November. */
export function firstWorkday(key: string): string {
  let d = monthStart(key);
  while (!isWorkday(d)) d = addDays(d, 1);
  return d;
}

/** A digest sent on `lastSent` (or later) already counts for this month. */
function covered(key: string, lastSent: string | null): boolean {
  return !!lastSent && lastSent >= addDays(monthStart(key), -AUTO_DIGEST_GRACE_DAYS);
}

function beforeSendTime(now: BrusselsTime, day: string): boolean {
  return now.date < day || (now.date === day && now.hour < AUTO_DIGEST_HOUR);
}

/**
 * Is it time for the automatic digest? `lastSent` is the (Brussels) date of the latest digest of any kind.
 * Due from the first working day at 8:00 up to the 7th, unless a digest already went out for this month.
 */
export function autoDigestDue(now: BrusselsTime, lastSent: string | null): boolean {
  const key = monthKey(now.date);
  if (beforeSendTime(now, firstWorkday(key))) return false;
  if (dayOfMonth(now.date) > AUTO_DIGEST_LAST_DAY) return false;
  return !covered(key, lastSent);
}

/** The date the automatic digest will next leave (today when it is due right now). */
export function nextAutoDigest(now: BrusselsTime, lastSent: string | null): string {
  if (autoDigestDue(now, lastSent)) return now.date;
  let key = monthKey(now.date);
  const first = firstWorkday(key);
  if (beforeSendTime(now, first) && !covered(key, lastSent)) return first;
  key = nextMonthKey(key);
  if (covered(key, lastSent)) key = nextMonthKey(key);
  return firstWorkday(key);
}
