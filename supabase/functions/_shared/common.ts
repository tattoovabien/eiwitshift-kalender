// Shared helpers for the edge functions: database access with the service role,
// sending e-mail through Brevo, and small response helpers.
import { createClient } from 'npm:@supabase/supabase-js@2';
import type { Email } from './app/lib/emails.ts';
import { emailToText, fillGreeting } from './app/lib/emails.ts';
import { emailToHtml } from './app/lib/emailHtml.ts';

/** The public web address of the calendar (for links in e-mails). */
export const APP_URL = (Deno.env.get('APP_URL') ?? '').replace(/#.*$/, '');

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

/** The project's secret key: new-style (SUPABASE_SECRET_KEYS) with a fallback to the legacy service_role key. */
function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const dict = JSON.parse(keys) as Record<string, string>;
      const key = dict['default'] ?? Object.values(dict)[0];
      if (key) return key;
    } catch {
      // fall through to the legacy key
    }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!legacy) throw new Error('Geen Supabase secret key beschikbaar');
  return legacy;
}

/** Full database access. Only ever used inside these functions, never in the browser. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface Recipient {
  email: string;
  name?: string | null;
}

/** Same e-mail, with "[voornaam]" in the greeting replaced by the recipient's first name. */
export function personalise(email: Email, to: Recipient): Email {
  return { ...email, greeting: fillGreeting(email.greeting, to.name) };
}

export async function sendMail(to: Recipient, email: Email): Promise<void> {
  const apiKey = Deno.env.get('BREVO_API_KEY');
  const sender = Deno.env.get('SENDER_EMAIL');
  if (!apiKey || !sender) throw new Error('BREVO_API_KEY of SENDER_EMAIL is niet ingesteld');
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: Deno.env.get('SENDER_NAME') ?? 'Eiwitshift-kalender', email: sender },
      replyTo: { email: Deno.env.get('REPLY_TO') ?? sender },
      to: [{ email: to.email, ...(to.name ? { name: to.name } : {}) }],
      subject: email.subject,
      htmlContent: emailToHtml(email),
      textContent: emailToText(email, false),
    }),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}
