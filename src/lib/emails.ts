// Builds the (simulated) e-mails: notifications, the monthly digest and intro mails.
// Nothing is ever sent; these objects are only rendered as previews.
import type { AppNotification, AppState, Moment } from '../types';
import { COORDINATOR_ORG } from '../roles';
import { addMonths, addMonthsKeepDay, fmtMonthTitle, fmtMonthYearKey, monthKey, monthsBetween, todayISO } from './dates';
import { byStart, effectiveRange, isOpenEnded, isPast, organiserLabel, whenLabel } from './moments';

export const SENDER = 'Eiwitshift-kalender <kalender@eiwitshift.example>';

export interface EmailItem {
  title: string;
  meta: string;
  note?: string;
  /** The organiser is looking for partners: shown as a label next to the title. */
  seeking?: boolean;
}

/** Label next to the title of a moment that looks for partners (an emoji, because mail clients drop SVG icons). */
export const SEEKING_LABEL = '🤝 Zoekt partners';

/** Replaced by each recipient's first name in the greeting. */
export const NAME_PLACEHOLDER = '[voornaam]';

/** "Dag [voornaam]," → "Dag Lucas,", or "Dag," when there is no name. */
export function fillGreeting(greeting: string, name?: string | null): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  if (first) return greeting.split(NAME_PLACEHOLDER).join(first);
  return greeting
    .split(NAME_PLACEHOLDER)
    .join('')
    .replace(/ +([,.!?])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export interface EmailSection {
  heading?: string;
  paragraphs?: string[];
  items?: EmailItem[];
  empty?: string;
}

export interface Email {
  from: string;
  to: string;
  subject: string;
  greeting: string;
  sections: EmailSection[];
  cta?: string;
  /** Where the button links to (set by the server when the e-mail is really sent). */
  ctaUrl?: string;
  footer: string;
}

const FOOTER_PARTNER = 'Je krijgt deze e-mail als gebruiker van de Eiwitshift-kalender van de Green Deal Eiwitshift.';

/** Extra context that is not stored on the notification itself (looked up by refId). */
export interface NotificationExtra {
  /** The text a partner wrote with a signal (coordinators only). */
  signalNote?: string;
}

function momentItem(m: Moment, note?: string): EmailItem {
  return { title: m.title, meta: `${whenLabel(m)} · ${m.type} · ${organiserLabel(m)}`, note };
}

/** A moment in the digest; one that looks for partners gets the label and its question as note. */
function digestItem(m: Moment): EmailItem {
  const need = m.need?.trim();
  return need ? { ...momentItem(m, `Zoekt: ${need}`), seeking: true } : momentItem(m);
}

export function notificationTitle(n: AppNotification, m: Moment | undefined): string {
  const t = m ? m.title : 'een verwijderd moment';
  switch (n.kind) {
    case 'reaction':
      return `Nieuwe reactie op jouw moment: ${t}`;
    case 'comment':
      return `Nieuwe opmerking bij: ${t}`;
    case 'new_moment':
      return `Nieuw moment toegevoegd: ${t}`;
    case 'signal':
      return `Nieuw signaal bij: ${t}`;
    case 'access_request':
      return `Nieuwe toegangsaanvraag: ${n.detail ?? 'onbekend adres'}`;
  }
}

export function notificationLine(n: AppNotification, extra: NotificationExtra = {}): string {
  switch (n.kind) {
    case 'reaction':
      return `${n.fromOrg} koos “${n.detail ?? 'reageerde'}”`;
    case 'comment':
      return `${n.fromOrg}: “${n.detail ?? ''}”`;
    case 'new_moment':
      return `Toegevoegd door ${n.fromOrg}`;
    case 'signal': {
      const note = extra.signalNote ? `: “${extra.signalNote}”` : '';
      return `${n.detail ?? 'Bezorgdheid'}${note} · gemeld door ${n.fromOrg === 'Anoniem' ? 'een anonieme partner' : n.fromOrg}`;
    }
    case 'access_request':
      return `${n.detail ?? 'Iemand'} wil inloggen. Keur goed via Dashboard → Toegang.`;
  }
}

export function notificationEmail(n: AppNotification, m: Moment | undefined, extra: NotificationExtra = {}): Email {
  const to = n.toOrg === COORDINATOR_ORG ? 'Coördinatoren Green Deal Eiwitshift' : `${n.toOrg} (contactpersoon)`;
  const sections: EmailSection[] = [];
  if (n.kind === 'reaction') {
    sections.push({
      paragraphs: [
        `Goed nieuws: ${n.fromOrg} reageerde op jouw moment in de communicatiekalender en koos “${n.detail}”.`,
        'Neem gerust contact op om af te stemmen. Zijn jullie al in contact? Zet dat dan even aan in de kalender, zo weten de coördinatoren dat het loopt.',
      ],
    });
  } else if (n.kind === 'comment') {
    sections.push({
      paragraphs: [`${n.fromOrg} plaatste een opmerking:`, `“${n.detail}”`],
    });
  } else if (n.kind === 'new_moment') {
    sections.push({
      paragraphs: [`${n.fromOrg} voegde een nieuw moment toe aan de kalender.`],
    });
  } else if (n.kind === 'access_request') {
    sections.push({
      paragraphs: [
        `${n.detail ?? 'Iemand'} logde voor het eerst in en vraagt toegang tot de communicatiekalender.`,
        'Keur de aanvraag goed (en kies de organisatie) via Dashboard → Toegang. Tip: zet een heel domein op de toegangslijst, dan komen collega’s van dezelfde organisatie voortaan meteen binnen.',
      ],
    });
  } else {
    sections.push({
      paragraphs: [
        `Er is een bezorgdheid gemeld: “${n.detail}”. Deze melding is enkel zichtbaar voor de coördinatoren.`,
        ...(extra.signalNote ? [`Toelichting: “${extra.signalNote}”`] : ['Er werd geen toelichting gegeven.']),
        n.fromOrg === 'Anoniem' ? 'De melder koos om anoniem te blijven.' : `Gemeld door ${n.fromOrg}.`,
      ],
    });
  }
  if (m) sections.push({ heading: 'Het moment', items: [momentItem(m, m.need ? `Zoekt: ${m.need}` : undefined)] });
  return {
    from: SENDER,
    to,
    subject: notificationTitle(n, m),
    greeting: n.toOrg === COORDINATOR_ORG ? 'Dag Enya en Kristof,' : 'Dag,',
    sections,
    cta: 'Bekijk in de kalender',
    footer: FOOTER_PARTNER,
  };
}

// ---------------------------------------------------------------------------
// Monthly digest ("nudge mail")

export function digestEmail(state: AppState, today = todayISO()): Email {
  const windowEnd = addMonthsKeepDay(today, 2);
  const live = state.moments.filter((m) => !isPast(m, today));
  const reactionCount = (id: string) => state.reactions.filter((r) => r.momentId === id).length;

  const upcoming = live
    .filter((m) => {
      if (isOpenEnded(m)) return false;
      const [s] = effectiveRange(m);
      return s >= today && s <= windowEnd;
    })
    .sort(byStart);

  const seeking = live.filter((m) => m.need?.trim()).sort(byStart);
  // Moments that look for partners are marked in the first list; the others (later or ongoing) get a short list of their own.
  const upcomingIds = new Set(upcoming.map((m) => m.id));
  const seekingLater = seeking.filter((m) => !upcomingIds.has(m.id));

  const popular = live
    .map((m) => ({ m, n: reactionCount(m.id) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || byStart(a.m, b.m))
    .slice(0, 3);

  // Quiet months in the coming year: where would extra moments help most?
  const months = monthsBetween(monthKey(addMonths(today, 2)), monthKey(addMonths(today, 11)));
  const perMonth = months.map((k) => ({
    k,
    n: live.filter((m) => {
      const [s] = effectiveRange(m);
      return !isOpenEnded(m) && monthKey(s) === k;
    }).length,
  }));
  const quiet = [...perMonth].sort((a, b) => a.n - b.n || (a.k < b.k ? -1 : 1)).slice(0, 2).sort((a, b) => (a.k < b.k ? -1 : 1));

  const monthName = fmtMonthTitle(monthKey(today));
  const subject = `Eiwitshift-kalender ${monthName.toLowerCase()}: ${upcoming.length} momenten de komende 2 maanden, ${seeking.length} zoeken partners`;

  const quietText = quiet
    .map((q) => `${fmtMonthYearKey(q.k)} (${q.n === 0 ? 'nog niets' : q.n === 1 ? '1 moment' : `${q.n} momenten`})`)
    .join(' en ');

  return {
    from: SENDER,
    to: 'Alle partners van de Green Deal Eiwitshift',
    subject,
    greeting: `Dag ${NAME_PLACEHOLDER},`,
    sections: [
      {
        paragraphs: [
          'Hier is je maandelijkse overzicht uit de gedeelde communicatiekalender. Zo zie je in één oogopslag wat eraan komt, waar je kan aanhaken en wie partners zoekt.',
        ],
      },
      {
        heading: 'Komende 2 maanden',
        items: upcoming.map(digestItem),
        empty: 'Nog geen momenten gepland in de komende 2 maanden.',
      },
      ...(seekingLater.length ? [{ heading: 'Zoekt ook partners (later of doorlopend)', items: seekingLater.map(digestItem) }] : []),
      {
        heading: 'Populairste momenten',
        items: popular.map(({ m, n }) => momentItem(m, `${n} ${n === 1 ? 'partner haakt' : 'partners haken'} aan of verspreiden mee`)),
        empty: 'Nog geen reacties deze maand.',
      },
      {
        heading: 'Vul de agenda aan',
        paragraphs: [
          `Staat jouw campagne, event of publicatie er nog niet in? Voeg ze toe, dan kunnen andere partners aanhaken. Het rustigst is het nog in ${quietText}.`,
          'Tip: plak gewoon de link naar je webpagina, de kalender vult de rest voor je in.',
        ],
      },
    ],
    cta: 'Open de kalender',
    footer: FOOTER_PARTNER,
  };
}

// ---------------------------------------------------------------------------
// Intro mail from the coordinators to connect organiser and interested partners

export function introEmail(m: Moment, orgs: string[]): Email {
  return {
    from: `Coördinatie Green Deal Eiwitshift (via ${SENDER})`,
    to: `${organiserLabel(m)}; ${orgs.join('; ')}`,
    subject: `Kennismaking: samen aan de slag rond '${m.title}'`,
    greeting: 'Dag allemaal,',
    sections: [
      {
        paragraphs: [
          `In de communicatiekalender gaven ${orgs.join(', ')} aan dat ze willen aanhaken bij of mee willen verspreiden rond ‘${m.title}’ van ${organiserLabel(m)}.`,
          'Met deze mail brengen we jullie graag met elkaar in contact. Beantwoord gerust met ‘allen beantwoorden’ om af te spreken.',
        ],
      },
      { heading: 'Het moment', items: [momentItem(m, m.need ? `Zoekt: ${m.need}` : undefined)] },
    ],
    footer: 'Hartelijke groet, de coördinatoren van de Green Deal Eiwitshift',
  };
}

// ---------------------------------------------------------------------------
// Editing the digest before sending (coordinators)

export interface DigestEdits {
  subject: string;
  /** "Dag [voornaam]," — the placeholder becomes each recipient's first name. */
  greeting: string;
  /** The opening paragraphs ("Hier is je maandelijkse overzicht …"). */
  intro: string;
  /** Paragraph text of the "Vul de agenda aan" section. */
  closing: string;
  /** Items left out, as "sectionIndex:itemIndex". */
  excluded: string[];
}

/** Start values for the editor, taken from the automatic digest. */
export function digestEditsFrom(base: Email): DigestEdits {
  const closing = base.sections.find((s) => s.heading === 'Vul de agenda aan');
  return {
    subject: base.subject,
    greeting: base.greeting,
    intro: (base.sections[0]?.paragraphs ?? []).join(PARAGRAPH_BREAK),
    closing: (closing?.paragraphs ?? []).join(PARAGRAPH_BREAK),
    excluded: [],
  };
}

/** Paragraphs are separated by an empty line in the editor's text boxes. */
const PARAGRAPH_BREAK = String.fromCharCode(10, 10);

const paragraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

/** The automatic digest with the coordinator's changes applied. */
export function applyDigestEdits(base: Email, edits: DigestEdits): Email {
  const excluded = new Set(edits.excluded);
  const sections: EmailSection[] = base.sections.map((s, si) => {
    if (si === 0) return { ...s, paragraphs: paragraphs(edits.intro) };
    if (s.heading === 'Vul de agenda aan') return { ...s, paragraphs: paragraphs(edits.closing) };
    if (s.items) return { ...s, items: s.items.filter((_, ii) => !excluded.has(`${si}:${ii}`)) };
    return s;
  });
  return { ...base, subject: edits.subject.trim() || base.subject, greeting: edits.greeting.trim() || base.greeting, sections };
}

const cap = (v: unknown, max: number): string => (typeof v === 'string' ? v.slice(0, max) : '');

/** Server-side check of an edited e-mail sent by the browser: shape and lengths only. */
export function sanitizeEmail(input: unknown): Pick<Email, 'subject' | 'greeting' | 'sections'> | null {
  if (!input || typeof input !== 'object') return null;
  const o = input as Record<string, unknown>;
  const subject = cap(o.subject, 200).trim();
  if (!subject || !Array.isArray(o.sections)) return null;
  const greeting = cap(o.greeting, 200).trim() || `Dag ${NAME_PLACEHOLDER},`;
  const sections: EmailSection[] = o.sections.slice(0, 12).map((raw) => {
    const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const section: EmailSection = {};
    if (s.heading) section.heading = cap(s.heading, 120);
    if (Array.isArray(s.paragraphs)) section.paragraphs = s.paragraphs.slice(0, 20).map((p) => cap(p, 3000)).filter(Boolean);
    if (Array.isArray(s.items)) {
      section.items = s.items.slice(0, 100).map((it) => {
        const i = (it && typeof it === 'object' ? it : {}) as Record<string, unknown>;
        return {
          title: cap(i.title, 300),
          meta: cap(i.meta, 300),
          ...(i.note ? { note: cap(i.note, 600) } : {}),
          ...(i.seeking === true ? { seeking: true } : {}),
        };
      });
    }
    if (s.empty) section.empty = cap(s.empty, 300);
    return section;
  });
  return { subject, greeting, sections };
}

/** Plain-text version. `withHeaders` adds subject/from/to lines (for "kopieer als tekst"). */
export function emailToText(e: Email, withHeaders = true): string {
  const out: string[] = withHeaders ? [`Onderwerp: ${e.subject}`, `Van: ${e.from}`, `Aan: ${e.to}`, ''] : [];
  out.push(e.greeting, '');
  for (const s of e.sections) {
    if (s.heading) out.push(s.heading.toUpperCase(), '');
    for (const p of s.paragraphs ?? []) out.push(p, '');
    if (s.items) {
      if (!s.items.length && s.empty) out.push(s.empty, '');
      for (const it of s.items) {
        out.push(`• ${it.title}${it.seeking ? `  (${SEEKING_LABEL})` : ''}`, `  ${it.meta}`);
        if (it.note) out.push(`  → ${it.note}`);
      }
      if (s.items.length) out.push('');
    }
  }
  if (e.cta) out.push(`${e.cta}: ${e.ctaUrl ?? 'https://kalender.eiwitshift.example'}`, '');
  out.push('—', e.footer);
  return out.join('\n');
}
