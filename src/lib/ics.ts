// iCalendar (RFC 5545) export. No browser APIs here: the "feed" edge function reuses it.
import type { Moment } from '../types';
import { addDays, todayISO } from './dates';
import { effectiveRange, organiserLabel, whenLabel } from './moments';

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines at 75 octets as the spec requires. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = '';
  let currentBytes = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + len > limit) {
      parts.push(current);
      current = '';
      currentBytes = 0;
    }
    current += ch;
    currentBytes += len;
  }
  parts.push(current);
  return parts.join('\r\n ');
}

const icsDate = (iso: string) => iso.replace(/-/g, '');

function vevent(m: Moment, limited: boolean): string[] {
  let [start, end] = effectiveRange(m);
  // Open-ended moments become a single all-day entry on their start (or today).
  if (m.ongoing) {
    if (!m.startDate) start = todayISO();
    if (!m.endDate || end < start) end = start;
  }
  let summary = m.title;
  if (m.dateUnsure) summary += ' (timing nog niet vast)';
  if (m.ongoing && !m.endDate) summary += ' (loopt door)';
  const desc = (limited
    ? [`Wanneer: ${whenLabel(m)}`, 'Log in op de kalender voor details.']
    : [
    `${m.type} · ${m.targetGroup}`,
    `Wanneer: ${whenLabel(m)}`,
    `Organisator: ${organiserLabel(m)}`,
    m.description ?? '',
    m.need ? `Organisator zoekt: ${m.need}` : '',
    'Bron: communicatiekalender Green Deal Eiwitshift',
  ])
    .filter(Boolean)
    .join('\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VEVENT',
    `UID:${m.id}@eiwitshift-kalender.example`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${icsDate(start)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(end, 1))}`,
    `SUMMARY:${icsEscape(summary)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    m.region && !limited ? `LOCATION:${icsEscape(m.region)}` : '',
    m.link && !limited ? `URL:${m.link}` : '',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ].filter(Boolean);
}

/** `limited`: only titles and dates (for visitors who are not logged in). */
export function buildIcs(moments: Moment[], calName = 'Eiwitshift-kalender', limited = false): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Green Deal Eiwitshift//Communicatiekalender//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(calName)}`,
    ...moments.flatMap((m) => vevent(m, limited)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
