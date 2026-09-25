import type { FieldDef, Moment, Role } from '../types';
import { COORDINATOR_ORG } from '../roles';
import {
  diffDays,
  fmtMedium,
  fmtMonthAbbr,
  fmtMonthYearKey,
  fmtShort,
  monthEnd,
  monthKey,
  monthStart,
  parseISO,
} from './dates';

const FAR_PAST = '2000-01-01';
const FAR_FUTURE = '2999-12-31';

/** Every organisation involved in a moment (organiser + co-organisers). */
export function orgsOf(m: Moment): string[] {
  const co = (m.coOrganisers ?? '')
    .split(/,|&|\s+en\s+|\s+ism\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  return [m.organiser, ...co].filter(Boolean);
}

export function organiserLabel(m: Moment): string {
  return m.coOrganisers ? `${m.organiser} ism ${m.coOrganisers}` : m.organiser;
}

export function isOwnedBy(m: Moment, org: string): boolean {
  if (!org) return false;
  const low = org.toLowerCase();
  return orgsOf(m).some((o) => o.toLowerCase() === low);
}

export function canEdit(m: Moment, role: Role): boolean {
  if (role.id === 'anon') return false;
  if (role.id === 'coordinator') return true;
  return isOwnedBy(m, role.org);
}

export function isCoordinatorOrg(org: string): boolean {
  return org === COORDINATOR_ORG;
}

/** [start, end] as ISO dates, inclusive. Unsure dates span their whole month. */
export function effectiveRange(m: Moment): [string, string] {
  if (m.dateUnsure && m.startDate) {
    const k = monthKey(m.startDate);
    return [monthStart(k), monthEnd(k)];
  }
  if (m.ongoing) return [m.startDate ?? FAR_PAST, m.endDate ?? FAR_FUTURE];
  const start = m.startDate ?? FAR_PAST;
  return [start, m.endDate && m.endDate >= start ? m.endDate : start];
}

export function isOpenEnded(m: Moment): boolean {
  return m.ongoing && !m.endDate;
}

export function isPast(m: Moment, today: string): boolean {
  return effectiveRange(m)[1] < today;
}

export function isRunningNow(m: Moment, today: string): boolean {
  const [s, e] = effectiveRange(m);
  return s <= today && today <= e;
}

export function isMultiDay(m: Moment): boolean {
  const [s, e] = effectiveRange(m);
  return s !== e;
}

function rangeLabel(start: string, end: string): string {
  const a = parseISO(start);
  const b = parseISO(end);
  if (a.getFullYear() === b.getFullYear()) {
    if (a.getMonth() === b.getMonth()) {
      return `${a.getDate()}–${b.getDate()} ${fmtMonthAbbr(monthKey(end))} ${b.getFullYear()}`;
    }
    return `${fmtShort(start)} – ${fmtMedium(end)}`;
  }
  return `${fmtMedium(start)} – ${fmtMedium(end)}`;
}

/** Human readable timing, e.g. "14 sep. – 8 nov. 2026" or "Timing nog niet vast · mei 2027". */
export function whenLabel(m: Moment): string {
  if (m.dateUnsure && m.startDate) {
    const base = `Timing nog niet vast · ${fmtMonthYearKey(monthKey(m.startDate))}`;
    return m.unsureNote ? `${base} (${m.unsureNote})` : base;
  }
  if (m.ongoing) {
    if (!m.startDate) return m.endDate ? `Doorlopend tot ${fmtMedium(m.endDate)}` : 'Doorlopend';
    return m.endDate ? rangeLabel(m.startDate, m.endDate) : `Vanaf ${fmtMedium(m.startDate)} · loopt door`;
  }
  if (!m.startDate) return 'Datum onbekend';
  if (m.endDate && m.endDate !== m.startDate) return rangeLabel(m.startDate, m.endDate);
  return fmtMedium(m.startDate);
}

export function durationDays(m: Moment): number {
  const [s, e] = effectiveRange(m);
  return diffDays(s, e) + 1;
}

export function sortKey(m: Moment): string {
  // Unsure dates sort after the dated moments of their month.
  const [s, e] = effectiveRange(m);
  return `${m.dateUnsure ? e : s}|${m.dateUnsure ? '1' : '0'}|${m.title.toLowerCase()}`;
}

export function byStart(a: Moment, b: Moment): number {
  return sortKey(a) < sortKey(b) ? -1 : sortKey(a) > sortKey(b) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Filters

export interface Filters {
  q: string;
  fromMonth: string;
  toMonth: string;
  type: string;
  targetGroup: string;
  focus: string;
  free: '' | 'free' | 'paid';
  region: string;
  organiser: string;
  seeksPartners: boolean;
  featured: boolean;
  nowOnly: boolean;
  showPast: boolean;
  custom: Record<string, string>;
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  fromMonth: '',
  toMonth: '',
  type: '',
  targetGroup: '',
  focus: '',
  free: '',
  region: '',
  organiser: '',
  seeksPartners: false,
  featured: false,
  nowOnly: false,
  showPast: false,
  custom: {},
};

/** Number of "advanced" filters in use (used for the badge on the filter button). */
export function countAdvancedFilters(f: Filters): number {
  let n = 0;
  for (const k of ['fromMonth', 'toMonth', 'type', 'targetGroup', 'focus', 'free', 'region', 'organiser'] as const) {
    if (f[k]) n++;
  }
  n += Object.values(f.custom).filter(Boolean).length;
  return n;
}

export function hasAnyFilter(f: Filters): boolean {
  return (
    countAdvancedFilters(f) > 0 || !!f.q.trim() || f.seeksPartners || f.featured || f.nowOnly
  );
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function matchesFilters(
  m: Moment,
  f: Filters,
  opts: { today: string; fieldDefs: FieldDef[]; limited: boolean },
): boolean {
  const [s, e] = effectiveRange(m);
  if (f.fromMonth && e < monthStart(f.fromMonth)) return false;
  if (f.toMonth && s > monthEnd(f.toMonth)) return false;
  if (f.nowOnly && !isRunningNow(m, opts.today)) return false;

  if (f.q.trim()) {
    const hay = opts.limited
      ? normalize(m.title)
      : normalize(
          [
            m.title,
            m.description,
            m.organiser,
            m.coOrganisers,
            m.need,
            m.region,
            m.type,
            m.targetGroup,
            m.focus,
            ...Object.values(m.customFields),
          ]
            .filter(Boolean)
            .join(' '),
        );
    const words = normalize(f.q).split(/\s+/).filter(Boolean);
    if (!words.every((w) => hay.includes(w))) return false;
  }

  // Everything below needs details that anonymous visitors cannot see.
  if (opts.limited) return true;

  if (f.type && m.type !== f.type) return false;
  if (f.targetGroup && m.targetGroup !== f.targetGroup) return false;
  if (f.focus && m.focus !== f.focus) return false;
  if (f.free === 'free' && !m.free) return false;
  if (f.free === 'paid' && m.free) return false;
  if (f.region && m.region !== f.region) return false;
  if (f.organiser && !isOwnedBy(m, f.organiser)) return false;
  if (f.seeksPartners && !m.need?.trim()) return false;
  if (f.featured && !m.featured) return false;
  for (const def of opts.fieldDefs) {
    const want = f.custom[def.id];
    if (!want) continue;
    const have = m.customFields[def.id] ?? '';
    if (def.type === 'text') {
      if (!normalize(have).includes(normalize(want))) return false;
    } else if (def.type === 'yesno') {
      if ((have || 'nee') !== want) return false;
    } else if (have !== want) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Duplicate detection ("lijkt op een bestaand moment")

const STOPWORDS = new Set(
  'de het een van voor en in op met aan te tot om bij over the of and a to for on at day dag week campagne event webinar workshop publicatie themadag persbericht 2026 2027 2028'.split(
    ' ',
  ),
);

function tokens(s: string): string[] {
  return normalize(s)
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5) return a.startsWith(b) || b.startsWith(a);
  return false;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function titleSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  let tokenScore = 0;
  if (ta.length && tb.length) {
    const hits = ta.filter((x) => tb.some((y) => tokenMatch(x, y))).length;
    const minLen = Math.min(ta.length, tb.length);
    const maxLen = Math.max(ta.length, tb.length);
    tokenScore = hits / maxLen;
    // A fully contained title ("Smos alles" in "Campagne 'Smos alles'") also counts,
    // but a single generic word ("vegan") inside a longer title does not.
    if (hits >= minLen && (minLen >= 2 || maxLen === 1)) tokenScore = Math.max(tokenScore, 0.8);
  }
  const na = normalize(a).replace(/[^a-z0-9]+/g, '');
  const nb = normalize(b).replace(/[^a-z0-9]+/g, '');
  const lev = na && nb ? 1 - levenshtein(na, nb) / Math.max(na.length, nb.length) : 0;
  return Math.max(tokenScore, lev);
}

export function findSimilar(title: string, moments: Moment[], excludeId?: string): Moment[] {
  if (title.trim().length < 4) return [];
  return moments
    .filter((m) => m.id !== excludeId)
    .map((m) => ({ m, score: titleSimilarity(title, m.title) }))
    .filter((x) => x.score >= 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.m);
}
