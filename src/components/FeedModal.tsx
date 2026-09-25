import { useState } from 'react';
import { Check, Copy, Download, LogIn, Rss } from 'lucide-react';
import { useStore } from '../store';
import { buildIcs, copyText, downloadFile, slugify } from '../lib/files';
import { isOwnedBy } from '../lib/moments';
import { todayISO } from '../lib/dates';
import { Modal, SimNote, useToast } from './ui';

type FeedKind = 'alle' | 'uitgelicht' | 'mijn';

export function FeedModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, role, live } = useStore();
  const toast = useToast();
  const [kind, setKind] = useState<FeedKind>('alle');
  const [copied, setCopied] = useState(false);
  const canMine = role.id !== 'anon' && role.id !== 'coordinator';
  const effective: FeedKind = kind === 'mijn' && !canMine ? 'alle' : kind;

  const path = effective === 'alle' ? 'alle-momenten' : effective === 'uitgelicht' ? 'uitgelicht' : `organisatie/${slugify(role.org)}`;
  // Live: a personal link to the "feed" edge function. Prototype: a made-up example link.
  const token = live?.profile?.status === 'active' ? live.profile.feedToken : null;
  const url = live
    ? token
      ? `${live.functionsUrl}/feed?token=${token}&scope=${effective}`
      : ''
    : `webcal://kalender.eiwitshift.example/feed/${path}.ics`;

  const moments = state.moments.filter((m) =>
    effective === 'uitgelicht' ? m.featured : effective === 'mijn' ? isOwnedBy(m, role.org) : true,
  );

  const options: { id: FeedKind; label: string; hint: string }[] = [
    { id: 'alle', label: 'Alle momenten', hint: 'De volledige kalender' },
    { id: 'uitgelicht', label: 'Enkel uitgelicht', hint: 'Wat de coördinatoren extra in de kijker zetten' },
    ...(canMine ? [{ id: 'mijn' as FeedKind, label: `Enkel ${role.org}`, hint: 'Je eigen momenten' }] : []),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="inline-flex items-center gap-2">
          <Rss className="size-5 text-brand-700" aria-hidden="true" /> Agenda-feed
        </span>
      }
      subtitle="Abonneer in Outlook of Google Agenda, zo zie je alles zonder in te loggen."
      footer={
        <button type="button" className="btn-primary" onClick={onClose}>
          Klaar
        </button>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="field-label">Welke momenten?</legend>
          <div className="grid gap-2">
            {options.map((o) => (
              <label
                key={o.id}
                className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${
                  effective === o.id ? 'border-brand-700 bg-brand-50' : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="feed"
                  className="size-5 accent-brand-700"
                  checked={effective === o.id}
                  onChange={() => setKind(o.id)}
                />
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{o.label}</span>
                  <span className="block text-xs text-gray-600">{o.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {live && !token ? (
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-800 ring-1 ring-gray-200 ring-inset">
            <p>Log in om je persoonlijke agenda-link te krijgen.</p>
            <button
              type="button"
              className="btn-primary mt-3"
              onClick={() => {
                onClose();
                live.setLoginOpen(true);
              }}
            >
              <LogIn className="size-4" aria-hidden="true" /> Inloggen
            </button>
          </div>
        ) : (
        <div>
          <label htmlFor="feed-url" className="field-label">
            {live ? 'Jouw persoonlijke abonnementslink' : 'Abonnementslink'}
          </label>
          <div className="flex gap-2">
            <input id="feed-url" className="input font-mono text-sm" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={async () => {
                const ok = await copyText(url);
                setCopied(ok);
                toast(ok ? 'Link gekopieerd' : 'Kopiëren lukte niet', ok ? 'success' : 'warning');
                if (ok) setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              <span className="hidden sm:inline">{copied ? 'Gekopieerd' : 'Kopieer'}</span>
            </button>
          </div>
          {live && (
            <p className="mt-2 text-sm text-gray-600">
              Deze link is persoonlijk: deel hem niet. Werkt hij niet meer, vraag dan een coördinator om je toegang te herstellen.
            </p>
          )}
        </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
            <p className="font-semibold text-gray-900">Outlook</p>
            <p className="mt-1">Agenda → Agenda toevoegen → Abonneren vanaf internet → plak de link.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-800">
            <p className="font-semibold text-gray-900">Google Agenda</p>
            <p className="mt-1">Andere agenda’s → + → Via URL → plak de link.</p>
          </div>
        </div>
        <p className="text-sm text-gray-700">
          Nieuwe en gewijzigde momenten verschijnen dan vanzelf in je eigen agenda. De feed bevat titels, data en organisator,
          maar geen contactgegevens of reacties.
        </p>

        {!live && (
          <SimNote>
            In dit prototype werkt de abonnementslink niet (er is geen server). Wil je het toch proberen? Download de huidige momenten
            als bestand en importeer dat.
          </SimNote>
        )}
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            downloadFile(`eiwitshift-${path.replace('/', '-')}-${todayISO()}.ics`, buildIcs(moments, 'Eiwitshift-kalender', role.id === 'anon'), 'text/calendar;charset=utf-8');
            toast(`${moments.length} momenten gedownload als .ics`);
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Download {moments.length} momenten (.ics)
        </button>
      </div>
    </Modal>
  );
}
