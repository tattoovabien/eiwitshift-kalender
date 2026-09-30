// Sends the monthly digest to every active user. Two ways in:
// - "Verstuur digest nu" (Dashboard → Digest-preview): coordinators only, with their edits.
// - {"auto": true} from the database's hourly pg_cron job (private.run_auto_digest). No login needed, like
//   "notify": it only sends when automatic sending is on, it is time (src/lib/digestSchedule.ts) and this
//   month's automatic digest did not leave yet.
import { adminClient, APP_URL, cors, json, personalise, sendMail } from '../_shared/common.ts';
import { digestEmail, sanitizeEmail, type Email } from '../_shared/app/lib/emails.ts';
import { autoDigestDue, brusselsNow } from '../_shared/app/lib/digestSchedule.ts';
import { momentFromRow, reactionFromRow } from '../_shared/app/data/mappers.ts';
import type { AppState } from '../_shared/app/types.ts';

type Db = ReturnType<typeof adminClient>;

/** The automatic digest, built from what is in the calendar now. */
async function buildDigest(db: Db): Promise<Email> {
  const [moments, reactions] = await Promise.all([db.from('moments').select('*'), db.from('reactions').select('*')]);
  const failed = moments.error ?? reactions.error;
  if (failed) throw new Error(failed.message);
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
  const email = digestEmail(state, brusselsNow().date);
  email.ctaUrl = APP_URL;
  return email;
}

async function sendToAll(db: Db, email: Email): Promise<{ sent: number; errors: string[] }> {
  const { data: people, error } = await db.from('profiles').select('email, name').eq('status', 'active');
  if (error) throw new Error(error.message);
  let sent = 0;
  const errors: string[] = [];
  for (const p of people ?? []) {
    try {
      await sendMail(p, personalise(email, p));
      sent++;
    } catch (e) {
      errors.push(String(e));
    }
  }
  if (errors.length) console.error('digest', errors);
  return { sent, errors };
}

async function autoRun(db: Db): Promise<Response> {
  const { data: settings } = await db.from('digest_settings').select('auto_send').maybeSingle();
  if (!settings?.auto_send) return json({ skipped: 'Automatisch versturen staat uit' });

  const now = brusselsNow();
  const { data: last } = await db
    .from('digest_runs')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const lastSent = last ? brusselsNow(new Date(last.created_at)).date : null;
  if (!autoDigestDue(now, lastSent)) return json({ skipped: 'Nog niet aan de beurt' });

  const email = await buildDigest(db);
  // Claim this month first, so it leaves at most once even if this is called twice.
  const { data: run, error } = await db
    .from('digest_runs')
    .insert({ kind: 'auto', period: now.date.slice(0, 7), subject: email.subject })
    .select('id')
    .single();
  if (error) return error.code === '23505' ? json({ skipped: 'Deze maand al verstuurd' }) : json({ error: error.message }, 500);

  const { sent, errors } = await sendToAll(db, email);
  if (sent === 0 && errors.length) {
    // Nothing went out: release the claim so the next hourly run tries again.
    await db.from('digest_runs').delete().eq('id', run.id);
    return json({ error: errors[0] }, 502);
  }
  await db.from('digest_runs').update({ recipients: sent }).eq('id', run.id);
  return json({ sent, errors });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: { email?: unknown; auto?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // no body: send the automatic digest
  }

  const db = adminClient();
  try {
    if (body.auto === true) return await autoRun(db);

    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: auth } = await db.auth.getUser(jwt);
    if (!auth?.user) return json({ error: 'Niet ingelogd' }, 401);
    const { data: me } = await db
      .from('profiles')
      .select('status, is_coordinator, name, email')
      .eq('user_id', auth.user.id)
      .maybeSingle();
    if (!me || me.status !== 'active' || !me.is_coordinator) {
      return json({ error: 'Enkel coördinatoren kunnen de digest versturen' }, 403);
    }

    const email = await buildDigest(db);
    // The coordinator may have edited subject, greeting and content; sender, recipients and footer stay ours.
    if (body.email !== undefined) {
      const edited = sanitizeEmail(body.email);
      if (!edited) return json({ error: 'De aangepaste digest is ongeldig' }, 400);
      email.subject = edited.subject;
      email.greeting = edited.greeting;
      email.sections = edited.sections;
    }

    const { sent, errors } = await sendToAll(db, email);
    if (sent === 0 && errors.length) return json({ error: errors[0] }, 502);
    await db.from('digest_runs').insert({
      kind: 'manual',
      sent_by: auth.user.id,
      sent_by_name: me.name || me.email,
      subject: email.subject,
      recipients: sent,
    });
    return json({ sent, errors });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
