// Personal calendar feed: subscribe to this URL in Outlook or Google Agenda.
// GET /feed?token=<personal feed token>&scope=alle|uitgelicht|mijn
import { adminClient } from '../_shared/common.ts';
import { buildIcs } from '../_shared/app/lib/ics.ts';
import { momentFromRow } from '../_shared/app/data/mappers.ts';
import { isOwnedBy } from '../_shared/app/lib/moments.ts';

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const scope = url.searchParams.get('scope') ?? 'alle';
  if (!/^[0-9a-f-]{36}$/i.test(token)) return text('Ongeldige agenda-link.', 400);

  const db = adminClient();
  const { data: p } = await db.from('profiles').select('org, status').eq('feed_token', token).maybeSingle();
  if (!p || p.status !== 'active') return text('Deze agenda-link werkt niet (meer).', 404);

  const { data: rows, error } = await db.from('moments').select('*');
  if (error) return text('Er ging iets mis.', 500);
  let moments = (rows ?? []).map(momentFromRow);
  if (scope === 'uitgelicht') moments = moments.filter((m) => m.featured);
  if (scope === 'mijn') moments = moments.filter((m) => isOwnedBy(m, p.org ?? ''));

  const name = scope === 'uitgelicht' ? 'Eiwitshift-kalender (uitgelicht)' : scope === 'mijn' ? `Eiwitshift-kalender (${p.org})` : 'Eiwitshift-kalender';
  return new Response(buildIcs(moments, name), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="eiwitshift-kalender.ics"',
      'Cache-Control': 'max-age=900',
    },
  });
});
