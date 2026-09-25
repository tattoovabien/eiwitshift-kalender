import { Leaf } from 'lucide-react';
import type { Email } from '../lib/emails';

/** Renders a simulated e-mail inside a mail-client-like frame. */
export function EmailPreview({ email }: { email: Email }) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 bg-gray-50">
      <div className="space-y-1 border-b border-gray-200 bg-white px-4 py-3 text-sm">
        <MetaRow label="Van" value={email.from} />
        <MetaRow label="Aan" value={email.to} />
        <MetaRow label="Onderwerp" value={email.subject} strong />
      </div>
      <div className="p-3 sm:p-5">
        <div className="mx-auto max-w-xl rounded-lg bg-white shadow-sm ring-1 ring-gray-200">
          <div className="flex items-center gap-2 rounded-t-lg bg-brand-700 px-5 py-3 text-white">
            <Leaf className="size-4" aria-hidden="true" />
            <span className="text-sm font-semibold">Eiwitshift-kalender</span>
          </div>
          <div className="space-y-4 px-5 py-5 text-[15px] leading-relaxed text-gray-800">
            <p>{email.greeting}</p>
            {email.sections.map((s, i) => (
              <section key={i} className="space-y-2">
                {s.heading && (
                  <h4 className="border-b border-gray-200 pb-1 text-sm font-bold tracking-wide text-brand-800 uppercase">
                    {s.heading}
                  </h4>
                )}
                {s.paragraphs?.map((p, j) => <p key={j}>{p}</p>)}
                {s.items && s.items.length === 0 && s.empty && <p className="text-gray-600 italic">{s.empty}</p>}
                {s.items && s.items.length > 0 && (
                  <ul className="space-y-2.5">
                    {s.items.map((it, j) => (
                      <li key={j} className="rounded-md bg-gray-50 px-3 py-2">
                        <div className="font-semibold text-gray-900">{it.title}</div>
                        <div className="text-sm text-gray-600">{it.meta}</div>
                        {it.note && <div className="mt-0.5 text-sm text-brand-800">→ {it.note}</div>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            {email.cta && (
              <p className="pt-1">
                <span className="inline-block rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white">
                  {email.cta}
                </span>
              </p>
            )}
          </div>
          <div className="rounded-b-lg border-t border-gray-200 px-5 py-3 text-xs text-gray-600">{email.footer}</div>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="w-20 shrink-0 text-gray-600">{label}</span>
      <span className={`min-w-0 break-words ${strong ? 'font-semibold text-gray-900' : 'text-gray-800'}`}>{value}</span>
    </div>
  );
}
