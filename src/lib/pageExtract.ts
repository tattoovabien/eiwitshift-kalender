// "Plak een link": reads a fetched web page (HTML) and turns it into form values.
// Step 1 (always, free): structured event data (schema.org JSON-LD), meta tags and Dutch dates in the text.
// Step 2 (optional): an AI model reads the page text; its answer is checked here and merged with step 1.
// No browser APIs: the "read-link" edge function runs this code (copied by scripts/sync-shared.mjs).
import { FOCUSES, MOMENT_TYPES, TARGET_GROUPS, type Focus, type MomentType, type TargetGroup } from '../types';
import { AUDIENCE_HINTS, MONTHS, ORG_HINTS, TYPE_HINTS, validDate, type PrefillResult } from './prefill';

export interface PageData {
  url: string;
  title: string;
  siteName: string;
  description: string;
  /** Flattened schema.org objects found in <script type="application/ld+json">. */
  jsonLd: Record<string, unknown>[];
  /** Visible text, whitespace collapsed. */
  text: string;
}

// ---------------------------------------------------------------------------
// HTML → PageData (regex based: no DOM needed, and pages are only read, never rendered)

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', euml: 'ë', iuml: 'ï',
  ouml: 'ö', uuml: 'ü', agrave: 'à', ccedil: 'ç', hellip: '…', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', euro: '€', middot: '·', bull: '•', copy: '©', reg: '®',
  trade: '™', shy: '', deg: '°', aacute: 'á', iacute: 'í', oacute: 'ó', uacute: 'ú', acirc: 'â', ecirc: 'ê',
  ocirc: 'ô', ucirc: 'û', auml: 'ä', szlig: 'ß', times: '×', sbquo: '‚', bdquo: '„', prime: '′', thinsp: ' ', ensp: ' ', emsp: ' ',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

const clean = (s: string) => decodeEntities(s).replace(/\s+/g, ' ').trim();

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    out[m[1].toLowerCase()] = m[3] ?? m[4] ?? m[5] ?? '';
  }
  return out;
}

function flattenLd(node: unknown, out: Record<string, unknown>[], depth = 0) {
  if (!node || depth > 5) return;
  if (Array.isArray(node)) {
    for (const n of node) flattenLd(n, out, depth + 1);
    return;
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if (obj['@type']) out.push(obj);
    if (obj['@graph']) flattenLd(obj['@graph'], out, depth + 1);
  }
}

export function parseHtml(html: string, url: string): PageData {
  const meta: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attrs(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase();
    if (key && a.content && !meta[key]) meta[key] = clean(a.content);
  }

  const jsonLd: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      flattenLd(JSON.parse(m[1].trim()), jsonLd);
    } catch {
      // Broken JSON-LD happens; skip it.
    }
  }

  const titleTag = clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const h1 = clean((html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').replace(/<[^>]+>/g, ' '));

  const body = (html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html)
    .replace(/<(script|style|noscript|svg|template|iframe|nav|footer|form)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr|\/section|\/article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  const text = decodeEntities(body)
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');

  return {
    url,
    title: meta['og:title'] || meta['twitter:title'] || h1 || titleTag,
    siteName: meta['og:site_name'] || '',
    description: meta['og:description'] || meta['description'] || meta['twitter:description'] || '',
    jsonLd,
    text,
  };
}

// ---------------------------------------------------------------------------
// Dates in (Dutch or English) text

const MONTH_ALT = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');
const M = `(${MONTH_ALT})\\.?`;
const RANGE = `(?:-|–|—|tot(?:\\s+en\\s+met)?|t\\/m|tem|to|until)`;

export interface FoundDate {
  start: string;
  end?: string;
  unsure: boolean;
  index: number;
}

/** All dates in a text, in reading order. */
export function findDates(text: string): FoundDate[] {
  const t = text.toLowerCase();
  const out: FoundDate[] = [];
  const add = (index: number, start: string | null, end?: string | null, unsure = false) => {
    if (start) out.push({ start, end: end && end > start ? end : undefined, unsure, index });
  };
  const patterns: [RegExp, (m: RegExpMatchArray) => void][] = [
    // 30 november - 2 december 2026
    [new RegExp(`\\b(\\d{1,2})\\s+${M}\\s*${RANGE}\\s*(\\d{1,2})\\s+${M}\\s+(20\\d\\d)`, 'g'), (m) =>
      add(m.index!, validDate(+m[5], MONTHS[m[2]], +m[1]), validDate(+m[5], MONTHS[m[4]], +m[3]))],
    // 4-7 maart 2027, 4 en 5 maart 2027
    [new RegExp(`\\b(\\d{1,2})\\s*(?:${RANGE}|en|&)\\s*(\\d{1,2})\\s+${M}\\s+(20\\d\\d)`, 'g'), (m) =>
      add(m.index!, validDate(+m[4], MONTHS[m[3]], +m[1]), validDate(+m[4], MONTHS[m[3]], +m[2]))],
    // 4 maart 2027, 4de maart 2027
    [new RegExp(`\\b(\\d{1,2})(?:e|ste|de)?\\s+${M}\\s+(20\\d\\d)`, 'g'), (m) =>
      add(m.index!, validDate(+m[3], MONTHS[m[2]], +m[1]))],
    // March 4, 2027
    [new RegExp(`\\b${M}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d\\d)`, 'g'), (m) =>
      add(m.index!, validDate(+m[3], MONTHS[m[1]], +m[2]))],
    // 04/03/2027 or 4.3.2027 (day first, as in Belgium)
    [/\b(\d{1,2})[/.](\d{1,2})[/.](20\d\d)\b/g, (m) => add(m.index!, validDate(+m[3], +m[2], +m[1]))],
    // 2027-03-04
    [/\b(20\d\d)-(\d{2})-(\d{2})\b/g, (m) => add(m.index!, validDate(+m[1], +m[2], +m[3]))],
  ];
  for (const [re, fn] of patterns) for (const m of t.matchAll(re)) fn(m);
  // Only a month: "maart 2027" → timing not fixed yet (skip if a full date already covers this spot)
  for (const m of t.matchAll(new RegExp(`\\b${M}\\s+(20\\d\\d)\\b`, 'g'))) {
    if (!out.some((d) => Math.abs(d.index - m.index!) < 12)) {
      add(m.index!, validDate(+m[2], MONTHS[m[1]], 1), null, true);
    }
  }
  // Several patterns can match the same spot: keep the most specific (a range beats a single day).
  out.sort((a, b) => a.index - b.index || Number(!!b.end) - Number(!!a.end));
  return out.filter((d, i) => i === 0 || Math.abs(d.index - out[i - 1].index) > 3);
}

/** The first date that has not passed yet (pages also show publish dates, past editions, …). */
export function pickDate(dates: FoundDate[], today: string): FoundDate | undefined {
  return dates.find((d) => (d.unsure ? d.start.slice(0, 7) >= today.slice(0, 7) : (d.end ?? d.start) >= today));
}

// ---------------------------------------------------------------------------
// Page → form values, without AI

const REGIONS: [RegExp, string][] = [
  [/\bonline\b|\bwebinar\b|\blivestream\b|\bdigitaal\b/, 'Online'],
  [/\bbrussel\b|\bbruxelles\b|\bbrussels\b/, 'Brussel'],
  [/\bgent\b|\bghent\b/, 'Gent'],
  [/\bbrugge\b|\bbruges\b/, 'Brugge'],
  [/\bleuven\b/, 'Leuven'],
  [/\bhasselt\b/, 'Hasselt'],
  [/\bkortrijk\b/, 'Kortrijk'],
  [/\bmechelen\b/, 'Mechelen'],
  [/\boostende\b/, 'Oostende'],
  [/\baalst\b/, 'Aalst'],
  [/\bgenk\b/, 'Genk'],
  [/\broeselare\b/, 'Roeselare'],
  [/\bsint-niklaas\b/, 'Sint-Niklaas'],
  [/\bturnhout\b/, 'Turnhout'],
  [/\bwest-vlaanderen\b/, 'West-Vlaanderen'],
  [/\boost-vlaanderen\b/, 'Oost-Vlaanderen'],
  [/\bvlaams-brabant\b/, 'Vlaams-Brabant'],
  [/\blimburg\b/, 'Limburg'],
  [/\bantwerpen\b|\bantwerp\b/, 'Antwerpen'],
];

const FOCUS_HINTS: [RegExp, Focus][] = [
  [/halfhalf|half\s*half/, 'halfhalf'],
  [/100\s*%\s*plantaardig|volledig plantaardig|\bvegan\b|veganistisch|plant-based/, '100% plantaardig'],
  [/eiwitshift|eiwittransitie|peulvrucht|vegetari|flexitari|minder vlees|plantaardig/, 'breder eiwitshift'],
];

// Ticket and event platforms: their name is not the organiser.
const PLATFORMS = /eventbrite|facebook|meetup|uitinvlaanderen|linkedin|instagram|weezevent|ticketmaster|google/i;

const str = (v: unknown): string => (typeof v === 'string' ? clean(v) : '');
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);

function isEvent(o: Record<string, unknown>): boolean {
  return asArray(o['@type']).some((t) => typeof t === 'string' && /event|festival|course/i.test(t));
}

function ldDate(v: unknown): string {
  const s = str(v);
  const m = s.match(/^(20\d\d)-(\d{2})-(\d{2})/);
  return m ? (validDate(+m[1], +m[2], +m[3]) ?? '') : '';
}

function ldName(v: unknown): string {
  const first = asArray(v)[0];
  if (typeof first === 'string') return clean(first);
  if (first && typeof first === 'object') return str((first as Record<string, unknown>).name);
  return '';
}

function ldPlace(ev: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const loc of asArray(ev.location)) {
    if (typeof loc === 'string') parts.push(loc);
    else if (loc && typeof loc === 'object') {
      const l = loc as Record<string, unknown>;
      if (/virtual/i.test(String(l['@type']))) parts.push('online');
      parts.push(str(l.name));
      const addr = l.address;
      if (typeof addr === 'string') parts.push(addr);
      else if (addr && typeof addr === 'object') {
        const a = addr as Record<string, unknown>;
        parts.push(str(a.addressLocality), str(a.addressRegion));
      }
    }
  }
  if (/online/i.test(String(ev.eventAttendanceMode))) parts.push('online');
  return parts.filter(Boolean).join(' ');
}

function ldFree(ev: Record<string, unknown>): boolean | undefined {
  if (ev.isAccessibleForFree === true || ev.isAccessibleForFree === 'true') return true;
  const prices = asArray(ev.offers)
    .map((o) => (o && typeof o === 'object' ? Number((o as Record<string, unknown>).price) : NaN))
    .filter((n) => Number.isFinite(n));
  if (prices.length) return prices.every((p) => p === 0);
  return undefined;
}

/** Remove the site name that pages append to their title ("Titel | Site"). */
export function cleanTitle(title: string, siteName: string, host: string): string {
  const parts = title.split(/\s+[|–—·•]\s+|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return title.trim();
  const site = siteName.toLowerCase();
  const hostWord = host.replace(/^www\./, '').split('.')[0].toLowerCase();
  const kept = parts.filter((p) => {
    const low = p.toLowerCase();
    return !(site && (low === site || low.includes(site))) && !low.replace(/[^a-z0-9]/g, '').includes(hostWord);
  });
  return (kept.length ? kept : parts).join(' – ');
}

function shorten(s: string, max = 400): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max * 0.5 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(' '))}…`;
}

const slugged = (s: string) => s.toLowerCase().replace(/[^a-z0-9%áéíóúëïöüàèç]+/g, '-');

/** Form values from the page itself: free, instant, no AI. */
export function prefillFromPage(page: PageData, today: string): PrefillResult {
  const host = (() => {
    try {
      return new URL(page.url).hostname;
    } catch {
      return '';
    }
  })();
  const ev = page.jsonLd.find(isEvent);

  const rawTitle = str(ev?.name) || page.title || host;
  const title = cleanTitle(rawTitle, page.siteName, host) || 'Nieuw moment';
  const description = shorten(str(ev?.description) || page.description);
  const head = `${title} ${description}`; // the most reliable part of a page
  const headSlug = slugged(`${head} ${page.url}`);

  // Dates: structured data first, then title/description, then the page text.
  let startDate = ldDate(ev?.startDate);
  let endDate = ldDate(ev?.endDate);
  let dateUnsure = false;
  if (!startDate) {
    const found = pickDate(findDates(head), today) ?? pickDate(findDates(page.text.slice(0, 20000)), today);
    if (found) {
      startDate = found.start;
      endDate = found.end ?? '';
      dateUnsure = found.unsure;
    }
  }
  const foundDate = !!startDate;

  const hinted = TYPE_HINTS.find(([re]) => re.test(headSlug))?.[1];
  const type: MomentType = hinted ?? (ev && /online/i.test(String(ev.eventAttendanceMode)) ? 'Webinar' : 'Event');

  const placeText = `${ev ? ldPlace(ev) : ''} ${title}`.toLowerCase();
  const region = REGIONS.find(([re]) => re.test(placeText))?.[1];

  const lowHead = head.toLowerCase();
  const free = (ev ? ldFree(ev) : undefined) ?? (/\bgratis\b|\bkosteloos\b|\bfree\b/.test(lowHead) ? true : undefined);

  return {
    title,
    type,
    startDate: startDate || '',
    endDate: endDate && endDate !== startDate ? endDate : undefined,
    dateUnsure,
    targetGroup: AUDIENCE_HINTS.find(([re]) => re.test(headSlug))?.[1],
    focus: FOCUS_HINTS.find(([re]) => re.test(lowHead))?.[1],
    region,
    free,
    organiserGuess:
      (ev && ldName(ev.organizer)) ||
      ORG_HINTS.find(([re]) => re.test(host))?.[1] ||
      (page.siteName && !PLATFORMS.test(page.siteName) ? page.siteName : undefined),
    description: description || undefined,
    foundDate,
  };
}

// ---------------------------------------------------------------------------
// Optional AI step: shared prompt, JSON schema and a strict check of the answer

export const AI_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Korte, duidelijke titel van de activiteit, in de taal van de pagina.' },
    type: { type: 'string', enum: [...MOMENT_TYPES] },
    target_group: { type: 'string', enum: [...TARGET_GROUPS] },
    focus: { type: 'string', enum: [...FOCUSES, 'onbekend'] },
    start_date: { type: 'string', description: 'Startdatum als JJJJ-MM-DD, of leeg als die niet vermeld is.' },
    end_date: { type: 'string', description: 'Einddatum als JJJJ-MM-DD als het meerdere dagen duurt, anders leeg.' },
    unsure_month: { type: 'string', description: 'JJJJ-MM als enkel de maand bekend is, anders leeg.' },
    unsure_note: { type: 'string', description: 'Wat al bekend is over de timing als de datum niet vastligt, anders leeg.' },
    region: { type: 'string', description: 'Vlaanderen, Brussel, een provincie, een stad of Online. Leeg als onbekend.' },
    free: { type: 'string', enum: ['gratis', 'betalend', 'onbekend'] },
    organiser: { type: 'string', description: 'Naam van de organiserende organisatie, of leeg.' },
    description: { type: 'string', description: 'Samenvatting in het Nederlands, maximaal 2 zinnen.' },
  },
  required: [
    'title', 'type', 'target_group', 'focus', 'start_date', 'end_date', 'unsure_month', 'unsure_note', 'region', 'free',
    'organiser', 'description',
  ],
  additionalProperties: false,
} as const;

export const AI_SYSTEM = `Je leest één webpagina en haalt er de gegevens uit van één activiteit (campagne, event, webinar, workshop, publicatie, themadag of persbericht) voor de gedeelde communicatiekalender van de partners van de Green Deal Eiwitshift in Vlaanderen.
Neem enkel over wat op de pagina staat; verzin geen datums, prijzen of plaatsen. Laat een veld leeg (of kies "onbekend") als het niet op de pagina staat.
Doelgroep "Breed" is voor iedereen/het grote publiek. Focus: "100% plantaardig" (volledig plantaardig/vegan), "halfhalf" (de halfhalf-richtlijn: helft plantaardige eiwitten) of "breder eiwitshift" (minder/ander vlees, peulvruchten, algemeen).
Schrijf de samenvatting in het Nederlands.`;

export function buildAiInput(page: PageData, today: string): string {
  // Cap the page text: the useful part of a page comes first, and the tail is mostly menus and footers.
  const text = page.text.slice(0, 20000);
  const ld = page.jsonLd.length ? JSON.stringify(page.jsonLd).slice(0, 6000) : '';
  return [
    `Vandaag is het ${today} (gebruik dit om een jaartal te bepalen als het ontbreekt).`,
    `URL: ${page.url}`,
    `Titel: ${page.title}`,
    page.siteName && `Website: ${page.siteName}`,
    page.description && `Beschrijving: ${page.description}`,
    ld && `Gestructureerde gegevens (JSON-LD): ${ld}`,
    `Tekst van de pagina:\n${text}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const isoDate = (v: unknown): string => {
  const m = String(v ?? '').match(/^(20\d\d)-(\d{2})-(\d{2})$/);
  return m ? (validDate(+m[1], +m[2], +m[3]) ?? '') : '';
};

/** Check the AI answer field by field; anything invalid is dropped (the page values stay). */
export function normalizeAiOutput(raw: unknown): Partial<PrefillResult> {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const out: Partial<PrefillResult> = {};
  const title = str(o.title);
  if (title) out.title = title.slice(0, 200);
  if ((MOMENT_TYPES as readonly string[]).includes(String(o.type))) out.type = o.type as MomentType;
  if ((TARGET_GROUPS as readonly string[]).includes(String(o.target_group))) out.targetGroup = o.target_group as TargetGroup;
  if ((FOCUSES as readonly string[]).includes(String(o.focus))) out.focus = o.focus as Focus;
  const start = isoDate(o.start_date);
  const end = isoDate(o.end_date);
  const month = String(o.unsure_month ?? '').match(/^(20\d\d)-(\d{2})$/);
  if (start) {
    out.startDate = start;
    out.endDate = end && end > start ? end : undefined;
    out.dateUnsure = false;
    out.foundDate = true;
  } else if (month && +month[2] >= 1 && +month[2] <= 12) {
    out.startDate = `${month[1]}-${month[2]}-01`;
    out.endDate = undefined;
    out.dateUnsure = true;
    out.foundDate = true;
    const note = str(o.unsure_note);
    if (note) out.unsureNote = note.slice(0, 80);
  }
  const region = str(o.region);
  if (region) out.region = region.slice(0, 60);
  if (o.free === 'gratis') out.free = true;
  if (o.free === 'betalend') out.free = false;
  const organiser = str(o.organiser);
  if (organiser) out.organiserGuess = organiser.slice(0, 100);
  const description = str(o.description);
  if (description) out.description = shorten(description, 500);
  return out;
}

/** AI values win, but only where the AI actually found something. */
export function mergePrefill(base: PrefillResult, ai: Partial<PrefillResult>): PrefillResult {
  const merged: PrefillResult = { ...base };
  for (const [k, v] of Object.entries(ai)) {
    if (v !== undefined && v !== '') (merged as unknown as Record<string, unknown>)[k] = v;
  }
  // Dates travel together: if the AI found a date, don't keep an end date from the page.
  if (ai.startDate) merged.endDate = ai.endDate;
  if (ai.startDate && !ai.dateUnsure) merged.unsureNote = undefined;
  return merged;
}
