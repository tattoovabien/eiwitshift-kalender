// Turns an Email (see emails.ts) into simple, inline-styled HTML for real sending.
// Looks like the in-app EmailPreview. Also used by the edge functions.
import { SEEKING_LABEL, type Email } from './emails';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GREEN = '#0f6f47';

export function emailToHtml(e: Email): string {
  const sections = e.sections
    .map((s) => {
      const parts: string[] = [];
      if (s.heading) {
        parts.push(
          `<h2 style="margin:24px 0 8px;padding-bottom:4px;border-bottom:1px solid #e5e7eb;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#0e573a">${esc(s.heading)}</h2>`,
        );
      }
      for (const p of s.paragraphs ?? []) parts.push(`<p style="margin:0 0 12px">${esc(p)}</p>`);
      if (s.items) {
        if (!s.items.length && s.empty) parts.push(`<p style="margin:0 0 12px;color:#4b5563;font-style:italic">${esc(s.empty)}</p>`);
        for (const it of s.items) {
          parts.push(
            `<div style="margin:0 0 8px;padding:8px 12px;background:#f9fafb;border-radius:6px">` +
              `<div style="font-weight:600;color:#111827">${esc(it.title)}` +
              (it.seeking
                ? ` <span style="display:inline-block;margin-left:4px;padding:1px 8px;border-radius:6px;background:#fffbeb;border:1px solid #fde68a;color:#78350f;font-size:12px;font-weight:600;white-space:nowrap">${esc(SEEKING_LABEL)}</span>`
                : '') +
              `</div>` +
              `<div style="font-size:14px;color:#4b5563">${esc(it.meta)}</div>` +
              (it.note ? `<div style="font-size:14px;color:#0e573a">→ ${esc(it.note)}</div>` : '') +
              `</div>`,
          );
        }
      }
      return parts.join('');
    })
    .join('');

  const cta =
    e.cta && e.ctaUrl
      ? `<p style="margin:20px 0 4px"><a href="${esc(e.ctaUrl)}" style="display:inline-block;background:${GREEN};color:#ffffff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:8px">${esc(e.cta)}</a></p>`
      : '';

  return `<!doctype html><html lang="nl"><body style="margin:0;padding:24px 12px;background:#f3f4f6;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb">
<div style="background:${GREEN};color:#ffffff;padding:12px 20px;font-weight:600">Eiwitshift-kalender</div>
<div style="padding:20px">
<p style="margin:0 0 12px">${esc(e.greeting)}</p>
${sections}
${cta}
</div>
<div style="padding:12px 20px;border-top:1px solid #e5e7eb;font-size:12px;color:#4b5563">${esc(e.footer)}</div>
</div></body></html>`;
}
