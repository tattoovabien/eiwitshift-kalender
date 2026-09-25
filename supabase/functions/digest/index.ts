// "Verstuur digest nu" (Dashboard → Digest-preview). Coordinators only.
// Builds the same digest as the in-app preview and sends it to every active user.
import { adminClient, APP_URL, cors, json, personalise, sendMail } from '../_shared/common.ts';
import { digestEmail } from '../_shared/app/lib/emails.ts';
import { momentFromRow, reactionFromRow } from '../_shared/app/data/mappers.ts';
import type { AppState } from '../_shared/app/types.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const db = adminClient();
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth?.user) return json({ error: 'Niet ingelogd' }, 401);
  const { data: me } = await db.from('profiles').select('status, is_coordinator').eq('user_id', auth.user.id).maybeSingle();
  if (!me || me.status !== 'active' || !me.is_coordinator) {
    return json({ error: 'Enkel coördinatoren kunnen de digest versturen' }, 403);
  }

  const [moments, reactions, people] = await Promise.all([
    db.from('moments').select('*'),
    db.from('reactions').select('*'),
    db.from('profiles').select('email, name').eq('status', 'active'),
  ]);
  const failed = moments.error ?? reactions.error ?? people.error;
  if (failed) return json({ error: failed.message }, 500);

  const state = {
    version: 1,
    role: 'coordinator',
    moments: (moments.data ?? []).map(momentFromRow),
    reactions: (reactions.data ?? []).map(reactionFromRow),
    comments: [],
    signals: [],
    notifications: [],
    fieldDefs: [],
  } satisfies AppState;
  const email = digestEmail(state);
  email.ctaUrl = APP_URL;

  let sent = 0;
  const errors: string[] = [];
  for (const p of people.data ?? []) {
    try {
      await sendMail(p, personalise(email, p));
      sent++;
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (errors.length) console.error('digest', errors);
  if (sent === 0 && errors.length) return json({ error: errors[0] }, 502);
  return json({ sent, errors });
});
