// "Plak een link": fetch a public web page and turn it into form values.
// Logged-in partners only (so nobody can use this as a free web proxy or burn the AI budget).
// POST { url } → { ok, source: "ai" | "page", provider?, result } or { ok: false, reason, message }
import { adminClient, cors, json } from '../_shared/common.ts';
import { aiConfig, aiExtract } from '../_shared/ai.ts';
import { mergePrefill, parseHtml, prefillFromPage } from '../_shared/app/lib/pageExtract.ts';

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;

/** Only public web addresses: no localhost, private networks or cloud metadata endpoints. */
function isPublicUrl(u: URL): boolean {
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return false;
  if (!h.includes('.') && !h.includes(':')) return false;
  if (h.includes(':')) return false; // IPv6 literals: not needed for normal websites
  const ip = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ip) {
    const [a, b] = [+ip[1], +ip[2]];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224) {
      return false;
    }
  }
  return true;
}

async function fetchPage(start: URL): Promise<{ html: string; url: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isPublicUrl(url)) throw new Error('blocked');
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Eiwitshift-kalender/1.0; +https://tattoovabien.github.io/eiwitshift-kalender/)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.6',
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location')!, url);
      await res.body?.cancel();
      continue;
    }
    if (!res.ok) throw new Error(`http_${res.status}`);
    const type = res.headers.get('content-type') ?? '';
    if (!/html|xml/i.test(type)) throw new Error('not_html');
    // Read at most MAX_BYTES.
    const reader = res.body!.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c.subarray(0, Math.min(c.length, size - offset)), offset);
      offset += c.length;
    }
    const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8';
    let html: string;
    try {
      html = new TextDecoder(charset).decode(bytes);
    } catch {
      html = new TextDecoder('utf-8').decode(bytes);
    }
    return { html, url: url.toString() };
  }
  throw new Error('too_many_redirects');
}

const MESSAGES: Record<string, string> = {
  blocked: 'Dit adres kan niet gelezen worden.',
  not_html: 'Deze link wijst niet naar een gewone webpagina (bv. een pdf of afbeelding).',
  http_403: 'De website weigert om automatisch gelezen te worden.',
  http_404: 'Deze pagina bestaat niet (meer).',
  http_410: 'Deze pagina is niet meer beschikbaar (misschien is de activiteit voorbij).',
  http_429: 'De website vraagt om het later opnieuw te proberen.',
  timeout: 'De website antwoordde niet op tijd.',
  unreachable: 'De website is niet bereikbaar.',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const db = adminClient();
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(jwt);
  if (!auth?.user) return json({ ok: false, reason: 'login', message: 'Log in om een link te laten lezen.' }, 401);
  const { data: me } = await db.from('profiles').select('status').eq('user_id', auth.user.id).maybeSingle();
  if (me?.status !== 'active') return json({ ok: false, reason: 'login', message: 'Je hebt (nog) geen toegang.' }, 403);

  let raw = '';
  try {
    raw = String((await req.json()).url ?? '').trim();
  } catch {
    // no body
  }
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return json({ ok: false, reason: 'invalid', message: 'Dat lijkt geen geldige link.' });
  }

  let page;
  try {
    const fetched = await fetchPage(url);
    page = parseHtml(fetched.html, fetched.url);
  } catch (e) {
    const err = e as Error;
    const reason =
      err.name === 'TimeoutError' ? 'timeout' : err.name === 'TypeError' ? 'unreachable' : err.message || 'unreachable';
    return json({ ok: false, reason, message: MESSAGES[reason] ?? 'Deze pagina kon niet gelezen worden.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  const fromPage = prefillFromPage(page, today);

  const cfg = aiConfig();
  if (!cfg) return json({ ok: true, source: 'page', result: fromPage });
  try {
    const fromAi = await aiExtract(cfg, page, today);
    return json({ ok: true, source: 'ai', provider: cfg.provider, model: cfg.model, result: mergePrefill(fromPage, fromAi) });
  } catch (e) {
    // AI unavailable (quota, wrong key, …): still return what the page itself gave.
    console.error('read-link AI', cfg.provider, String(e));
    return json({ ok: true, source: 'page', aiError: true, result: fromPage });
  }
});
