// Called by the database (trigger email_notification) for every new notification.
// E-mails it to every active user of the receiving organisation (or to all coordinators).
// No login needed to call it, but it only sends notifications that exist and were not sent yet.
import { adminClient, APP_URL, json, personalise, sendMail } from '../_shared/common.ts';
import { notificationEmail } from '../_shared/app/lib/emails.ts';
import { momentFromRow, notificationFromRow } from '../_shared/app/data/mappers.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let id: string | undefined;
  try {
    ({ id } = await req.json());
  } catch {
    // no body
  }
  if (!id) return json({ error: 'id ontbreekt' }, 400);

  const db = adminClient();
  // Claim it first, so it is e-mailed at most once even if this is called twice.
  const { data: n, error } = await db
    .from('notifications')
    .update({ emailed_at: new Date().toISOString() })
    .eq('id', id)
    .is('emailed_at', null)
    .select()
    .maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!n) return json({ skipped: true });

  const moment = n.moment_id ? (await db.from('moments').select('*').eq('id', n.moment_id).maybeSingle()).data : null;

  let query = db.from('profiles').select('email, name').eq('status', 'active');
  query = n.to_coordinators ? query.eq('is_coordinator', true) : query.eq('org', n.to_org);
  const { data: people, error: peopleError } = await query;
  if (peopleError) return json({ error: peopleError.message }, 500);

  const email = notificationEmail(notificationFromRow(n), moment ? momentFromRow(moment) : undefined);
  email.ctaUrl =
    n.kind === 'access_request'
      ? `${APP_URL}#/dashboard/toegang`
      : moment
        ? `${APP_URL}#/overzicht?m=${encodeURIComponent(moment.id)}`
        : APP_URL;

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
  if (errors.length) console.error('notify', id, errors);
  return json({ sent, errors });
});
