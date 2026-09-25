// Downloads, clipboard, .ics and .csv generation.
import type { FieldDef, Moment, Reaction } from '../types';
import { whenLabel } from './moments';

export { buildIcs } from './ics';

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'moment'
  );
}

// ---------------------------------------------------------------------------
// CSV (semicolon separated + BOM so Excel with Belgian settings opens it cleanly)

function csvCell(v: unknown): string {
  const s = v === undefined || v === null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsv(moments: Moment[], reactions: Reaction[], fieldDefs: FieldDef[]): string {
  const yn = (b: boolean) => (b ? 'ja' : 'nee');
  const header = [
    'Titel',
    'Start',
    'Einde',
    'Timing nog niet vast',
    'Doorlopend',
    'Wanneer (leesbaar)',
    'Type',
    'Doelgroep',
    'Focus',
    'Gratis',
    'Regio',
    'Organisator',
    'Samen met',
    'Green Deal-partner',
    'Link',
    'Beschrijving',
    'Link met halfhalf',
    'Organisator zoekt',
    'Uitgelicht',
    'Aantal reacties',
    'Haken aan',
    'Verspreiden mee',
    ...fieldDefs.map((d) => d.name),
  ];
  const rows = moments.map((m) => {
    const rs = reactions.filter((r) => r.momentId === m.id);
    return [
      m.title,
      m.startDate ?? '',
      m.endDate ?? '',
      yn(m.dateUnsure),
      yn(m.ongoing),
      whenLabel(m),
      m.type,
      m.targetGroup,
      m.focus,
      yn(m.free),
      m.region,
      m.organiser,
      m.coOrganisers ?? '',
      yn(m.isGreenDealPartner),
      m.link ?? '',
      m.description ?? '',
      yn(m.halfhalfLink),
      m.need ?? '',
      yn(m.featured),
      rs.length,
      rs.filter((r) => r.kind === 'join').map((r) => r.org).join(', '),
      rs.filter((r) => r.kind === 'spread').map((r) => r.org).join(', '),
      ...fieldDefs.map((d) => m.customFields[d.id] ?? ''),
    ];
  });
  return '\uFEFF' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
}
