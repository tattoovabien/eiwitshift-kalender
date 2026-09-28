// Prefill from the link TEXT only (words and dates in the URL). Nothing is fetched.
// Used by the offline prototype (simulated "AI") and as a fallback in the live version when
// the page itself cannot be read. The real page reading lives in pageExtract.ts.
import type { Focus, MomentType, TargetGroup } from '../types';
import { addMonths, monthKey, todayISO } from './dates';

export const DEMO_LINK = 'https://www.proveg.example/nl/evenementen/kookworkshop-plantaardig-op-kot-4-maart-2027';

export interface PrefillResult {
  title: string;
  type: MomentType;
  /** ISO date; for dateUnsure only the month counts (yyyy-mm-01). */
  startDate: string;
  endDate?: string;
  dateUnsure: boolean;
  unsureNote?: string;
  targetGroup?: TargetGroup;
  focus?: Focus;
  region?: string;
  free?: boolean;
  organiserGuess?: string;
  description?: string;
  foundDate: boolean;
}

export const MONTHS: Record<string, number> = {
  januari: 1, jan: 1, january: 1,
  februari: 2, feb: 2, february: 2,
  maart: 3, mrt: 3, march: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6, june: 6,
  juli: 7, jul: 7, july: 7,
  augustus: 8, aug: 8, august: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

// Tested against slug-like text (words joined by "-"), so (^|-)…(-|$) means "a whole word".
export const TYPE_HINTS: [RegExp, MomentType][] = [
  [/webinar|online-sessie|livestream/, 'Webinar'],
  [/workshop|kookles|kookdemo|kookcursus|studiedag|masterclass|opleiding|(^|-)training(-|$)/, 'Workshop'],
  [/persbericht|(^|-)press(-|$)|(^|-)pers(-|$)/, 'Persbericht'],
  [/publicatie|rapport|(^|-)report(-|$)|(^|-)studie(-|$)|superlijst|(^|-)gids(-|$)|brochure/, 'Publicatie'],
  [/campagne|campaign|(^|-)actie(-|$)|actieweek|challenge|week-van|(^|-)maand(-|$)/, 'Campagne'],
  [/themadag|world-.*-day|dag-van/, 'Themadag'],
  [/(^|-)event|evenement|festival|congres|forum|beurs|symposium|(^|-)markt(-|$)|conferentie/, 'Event'],
];

export const AUDIENCE_HINTS: [RegExp, TargetGroup][] = [
  [/student|kot|campus|hogeschool|universiteit|unief/, 'Hoger onderwijs'],
  [/chef|grootkeuken|horeca|catering|foodservice/, 'Chefs & grootkeukens'],
  [/zorg|ziekenhuis|dietist|diëtist|woonzorg/, 'Zorg'],
  [/boer|landbouw|teelt|akker/, 'Landbouwers'],
  [/pers|media|journalist/, 'Media'],
  [/professional|b2b|sector|beleid/, 'Professionals'],
];

export const ORG_HINTS: [RegExp, string][] = [
  [/proveg/, 'ProVeg'],
  [/lidl/, 'Lidl'],
  [/plantbaseduniversities|plant-based-universities|pbu/, 'Plant-Based Universities'],
  [/vlam/, 'VLAM'],
  [/gezondleven/, 'Vlaams Instituut Gezond Leven'],
  [/rikolto/, 'Rikolto'],
  [/ilvo/, 'ILVO'],
  [/gaia/, 'GAIA'],
  [/delhaize/, 'Delhaize'],
  [/colruyt/, 'Colruyt Group'],
];

const pad = (n: number) => String(n).padStart(2, '0');

export function validDate(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

interface DateHit {
  start: string;
  end?: string;
  unsure: boolean;
  /** slug words that belonged to the date, so we can drop them from the title */
  words: string[];
}

function findDate(words: string[]): DateHit | null {
  const monthNames = Object.keys(MONTHS).join('|');
  const joined = words.join('-');
  // 2027-03-04 (optionally followed by a second date = range)
  let m = joined.match(/(20\d\d)-(\d{1,2})-(\d{1,2})(?:-(?:tot-|tem-)?(20\d\d)-(\d{1,2})-(\d{1,2}))?/);
  if (m) {
    const start = validDate(+m[1], +m[2], +m[3]);
    const end = m[4] ? validDate(+m[4], +m[5], +m[6]) : null;
    if (start) return { start, end: end ?? undefined, unsure: false, words: m[0].split('-') };
  }
  // 4-maart-2027, 4-7-maart-2027 (range), 04-03-2027
  m = joined.match(new RegExp(`(\\d{1,2})(?:-(?:tot-|tem-)?(\\d{1,2}))?-(${monthNames})-(20\\d\\d)`));
  if (m) {
    const month = MONTHS[m[3]];
    const start = validDate(+m[4], month, +m[1]);
    const end = m[2] ? validDate(+m[4], month, +m[2]) : null;
    if (start) return { start, end: end ?? undefined, unsure: false, words: m[0].split('-') };
  }
  m = joined.match(/(\d{1,2})-(\d{1,2})-(20\d\d)/);
  if (m) {
    const start = validDate(+m[3], +m[2], +m[1]);
    if (start) return { start, unsure: false, words: m[0].split('-') };
  }
  // maart-2027 → month known, day not
  m = joined.match(new RegExp(`(${monthNames})-(20\\d\\d)`));
  if (m) {
    return { start: `${m[2]}-${pad(MONTHS[m[1]])}-01`, unsure: true, words: m[0].split('-') };
  }
  return null;
}

function titleCase(words: string[]): string {
  const s = words.join(' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fakeExtract(rawUrl: string): PrefillResult {
  let url: URL | null = null;
  try {
    url = new URL(rawUrl.trim().match(/^https?:\/\//) ? rawUrl.trim() : `https://${rawUrl.trim()}`);
  } catch {
    url = null;
  }
  const host = url?.hostname.replace(/^www\./, '') ?? '';
  const path = decodeURIComponent(url?.pathname ?? rawUrl).toLowerCase();
  const segments = path.split('/').filter(Boolean);
  // The most descriptive part is usually the last segment with letters in it.
  const slug =
    [...segments].reverse().find((s) => /[a-z]{3,}/.test(s) && !/^(nl|fr|en|index\.html?)$/.test(s)) ?? '';
  const words = slug
    .replace(/\.(html?|php|aspx?)$/, '')
    .split(/[-_+.]+/)
    .filter(Boolean);

  const haystack = `${host} ${path}`.replace(/[^a-z0-9%]+/g, '-');
  const type = TYPE_HINTS.find(([re]) => re.test(haystack))?.[1] ?? 'Event';
  const targetGroup = AUDIENCE_HINTS.find(([re]) => re.test(haystack))?.[1];
  const organiserGuess = ORG_HINTS.find(([re]) => re.test(host))?.[1];

  const date = findDate(words);
  const titleWords = date ? words.filter((w) => !date.words.includes(w)) : words;
  const cleaned = titleWords.filter((w) => !/^\d+$/.test(w));
  const title = cleaned.length ? titleCase(cleaned) : host ? `Nieuw moment van ${host}` : 'Nieuw moment';

  // The demo link gets a slightly richer result, the way a real AI would read the page.
  if (rawUrl.trim() === DEMO_LINK && date) {
    return {
      title: "Kookworkshop 'Plantaardig op kot'",
      type: 'Workshop',
      startDate: date.start,
      dateUnsure: false,
      targetGroup: 'Hoger onderwijs',
      organiserGuess: 'ProVeg',
      foundDate: true,
      description:
        'Kookworkshop voor studenten: snel, goedkoop en lekker plantaardig koken op kot. Max. 25 deelnemers per sessie.',
    };
  }

  if (date) {
    return {
      title,
      type,
      startDate: date.start,
      endDate: date.end,
      dateUnsure: date.unsure,
      targetGroup,
      organiserGuess,
      foundDate: true,
      description: `${type} “${title}”. (Samenvatting door AI – gesimuleerd in dit prototype.)`,
    };
  }
  // No date in the link: honest fallback, like the real AI would do when the page has none.
  return {
    title,
    type,
    startDate: `${monthKey(addMonths(todayISO(), 2))}-01`,
    dateUnsure: true,
    targetGroup,
    organiserGuess,
    foundDate: false,
    description: `${type} “${title}”. (Samenvatting door AI – gesimuleerd in dit prototype.)`,
  };
}
