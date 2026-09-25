import { useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  Handshake,
  Mail,
  Pencil,
  Plus,
  Send,
  Settings2,
  ShieldAlert,
  Trash,
  UserCheck,
  Users,
} from 'lucide-react';
import type { FieldDef, FieldType, Moment } from '../types';
import { newId, REACTION_LABEL, useStore } from '../store';
import { isPast, organiserLabel, whenLabel } from '../lib/moments';
import { fmtRelative, todayISO } from '../lib/dates';
import { digestEmail, emailToText, introEmail } from '../lib/emails';
import { buildCsv, buildIcs, copyText, downloadFile } from '../lib/files';
import { EmailPreview } from './EmailPreview';
import { AccessManager } from './AccessManager';
import { sendDigestNow } from '../data/live';
import { Modal, SimNote, Switch, TypeBadge, useToast } from './ui';

export type DashTab = 'matches' | 'signalen' | 'velden' | 'digest' | 'export' | 'toegang';

const TABS: { id: DashTab; label: string; icon: typeof Users }[] = [
  { id: 'matches', label: 'Matches', icon: Handshake },
  { id: 'signalen', label: 'Signalen', icon: ShieldAlert },
  { id: 'velden', label: 'Velden beheren', icon: Settings2 },
  { id: 'digest', label: 'Digest-preview', icon: Mail },
  { id: 'export', label: 'Export', icon: FileSpreadsheet },
];

const ACCESS_TAB = { id: 'toegang' as DashTab, label: 'Toegang', icon: UserCheck };

export function Dashboard({
  tab,
  onTab,
  onOpen,
}: {
  tab: DashTab;
  onTab: (t: DashTab) => void;
  onOpen: (id: string) => void;
}) {
  const { state, live } = useStore();
  const tabs = live ? [...TABS, ACCESS_TAB] : TABS;
  const today = todayISO();
  const upcoming = state.moments.filter((m) => !isPast(m, today)).length;
  const seeking = state.moments.filter((m) => !isPast(m, today) && m.need?.trim()).length;
  const openSignals = state.signals.filter((s) => !s.resolved).length;

  const stats = [
    { label: 'Komende momenten', value: upcoming },
    { label: 'Reacties van partners', value: state.reactions.length },
    { label: 'Zoeken partners', value: seeking },
    { label: 'Open signalen', value: openSignals, warn: openSignals > 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Coördinator-dashboard</h1>
        <p className="mt-1 text-gray-700">Enkel zichtbaar voor de coördinatoren van Departement Omgeving.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`card px-4 py-3 ${s.warn ? 'border-amber-300 bg-amber-50' : ''}`}>
            <dt className="text-sm text-gray-600">{s.label}</dt>
            <dd className="text-3xl font-bold text-gray-900">{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Dashboard-onderdelen" className="flex min-w-max gap-1 border-b border-gray-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={tab === t.id}
              onClick={() => onTab(t.id)}
              className={`-mb-px inline-flex min-h-11 items-center gap-2 border-b-[3px] px-3 text-sm font-semibold ${
                tab === t.id ? 'border-brand-700 text-brand-800' : 'border-transparent text-gray-700 hover:border-gray-300'
              }`}
            >
              <t.icon className="size-4" aria-hidden="true" />
              {t.label}
              {t.id === 'signalen' && openSignals > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 text-xs leading-5 text-white">{openSignals}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {tab === 'matches' && <Matches onOpen={onOpen} />}
        {tab === 'signalen' && <Signals onOpen={onOpen} />}
        {tab === 'velden' && <FieldsManager />}
        {tab === 'digest' && <Digest />}
        {tab === 'export' && <Export />}
        {__LIVE__ && tab === 'toegang' && live && <AccessManager />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Matches({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, live } = useStore();
  const toast = useToast();
  const [intro, setIntro] = useState<{ m: Moment; orgs: string[] } | null>(null);
  const today = todayISO();
  const matches = useMemo(
    () =>
      state.moments
        .map((m) => ({ m, rs: state.reactions.filter((r) => r.momentId === m.id) }))
        .filter((x) => x.rs.length >= 2)
        .sort((a, b) => b.rs.length - a.rs.length),
    [state.moments, state.reactions],
  );

  return (
    <div className="space-y-4">
      <p className="text-gray-700">
        Momenten waar minstens twee partners op reageerden, gesorteerd op aantal. Zo zie je waar samenwerking ontstaat en wie nog
        niet met elkaar in contact is.
      </p>
      {matches.length === 0 && <p className="card p-6 text-gray-600">Nog geen momenten met twee of meer reacties.</p>}
      <ul className="grid gap-4">
        {matches.map(({ m, rs }) => {
          const notInContact = rs.filter((r) => !r.inContact);
          return (
            <li key={m.id} className="card p-4 sm:p-5">
              <div className="flex items-start gap-4">
                <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-700 text-white">
                  <span className="text-2xl leading-none font-bold">{rs.length}</span>
                  <span className="text-[10px] font-semibold uppercase">reacties</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <TypeBadge type={m.type} />
                    {isPast(m, today) && <span className="text-xs text-gray-600">voorbij</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(m.id)}
                    className="mt-1 text-left text-lg leading-snug font-bold text-gray-900 underline-offset-2 hover:text-brand-800 hover:underline"
                  >
                    {m.title}
                  </button>
                  <p className="text-sm text-gray-700">
                    {whenLabel(m)} · {organiserLabel(m)}
                  </p>
                </div>
              </div>
              <ul className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-200">
                {rs.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
                    <span>
                      <strong className="text-gray-900">{r.org}</strong>
                      <span className="text-gray-600"> · {REACTION_LABEL[r.kind]}</span>
                      {r.note && <span className="block text-gray-700">“{r.note}”</span>}
                    </span>
                    {r.inContact ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">
                        <Check className="size-3.5" aria-hidden="true" /> al in contact
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-900">nog niet in contact</span>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-gray-600">
                  {notInContact.length === 0
                    ? 'Iedereen is al in contact met de organisator.'
                    : `${notInContact.length} ${notInContact.length === 1 ? 'partner is' : 'partners zijn'} nog niet in contact.`}
                </p>
                {notInContact.length > 0 && (
                  <button type="button" className="btn-soft" onClick={() => setIntro({ m, orgs: notInContact.map((r) => r.org) })}>
                    <Mail className="size-4" aria-hidden="true" />
                    Breng in contact
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={!!intro}
        onClose={() => setIntro(null)}
        size="lg"
        title="Kennismakingsmail (preview)"
        subtitle="Een mail die organisator en geïnteresseerde partners met elkaar in contact brengt."
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={async () => {
                if (!intro) return;
                const ok = await copyText(emailToText(introEmail(intro.m, intro.orgs)));
                toast(ok ? 'Mail gekopieerd als tekst' : 'Kopiëren lukte niet', ok ? 'success' : 'warning');
              }}
            >
              <Copy className="size-4" aria-hidden="true" />
              Kopieer als tekst
            </button>
            <button type="button" className="btn-primary" onClick={() => setIntro(null)}>
              Sluiten
            </button>
          </>
        }
      >
        {intro && (
          <div className="space-y-3">
            <EmailPreview email={introEmail(intro.m, intro.orgs)} />
            <SimNote>
              {live
                ? 'Deze kennismakingsmail wordt (nog) niet automatisch verstuurd. Kopieer de tekst en stuur hem zelf.'
                : 'Niets wordt echt verstuurd. In de echte versie gaat deze mail naar de contactpersonen van elke organisatie.'}
            </SimNote>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Signals({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, dispatch } = useStore();
  const [showResolved, setShowResolved] = useState(false);
  const list = state.signals
    .filter((s) => showResolved || !s.resolved)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-gray-700">Bezorgdheden die partners meldden. Enkel jullie zien deze, de organisatoren niet.</p>
        <Switch checked={showResolved} onChange={setShowResolved} label="Toon ook opgevolgde" size="sm" />
      </div>
      {list.length === 0 && <p className="card p-6 text-gray-600">Geen open signalen. 🎉</p>}
      <ul className="grid gap-3">
        {list.map((s) => {
          const m = state.moments.find((x) => x.id === s.momentId);
          return (
            <li key={s.id} className={`card p-4 ${s.resolved ? 'opacity-70' : 'border-amber-300'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-950">
                  <ShieldAlert className="size-3.5" aria-hidden="true" /> {s.kind}
                </span>
                <span className="text-sm text-gray-600">
                  {s.anonymous ? 'Anoniem gemeld' : `Gemeld door ${s.fromOrg}`} · {fmtRelative(s.createdAt)}
                </span>
                {s.resolved && <span className="text-sm font-semibold text-brand-800">✓ opgevolgd</span>}
              </div>
              {m && (
                <button
                  type="button"
                  onClick={() => onOpen(m.id)}
                  className="mt-2 text-left font-bold text-gray-900 underline-offset-2 hover:text-brand-800 hover:underline"
                >
                  {m.title}
                </button>
              )}
              {m && <p className="text-sm text-gray-600">{whenLabel(m)} · {organiserLabel(m)}</p>}
              {s.note && <p className="mt-2 text-gray-800">“{s.note}”</p>}
              <div className="mt-3">
                <button type="button" className="btn-secondary" onClick={() => dispatch({ type: 'toggleSignalResolved', id: s.id })}>
                  {s.resolved ? 'Heropen' : (
                    <>
                      <Check className="size-4" aria-hidden="true" /> Markeer als opgevolgd
                    </>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------

const TYPE_LABEL: Record<FieldType, string> = { text: 'Tekst', dropdown: 'Keuzelijst', yesno: 'Ja/nee' };

function FieldsManager() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('dropdown');
  const [options, setOptions] = useState('');
  const [showInForm, setShowInForm] = useState(true);
  const [toDelete, setToDelete] = useState<FieldDef | null>(null);

  const parseOptions = (s: string) =>
    Array.from(new Set(s.split(',').map((o) => o.trim()).filter(Boolean)));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === 'dropdown' && parseOptions(options).length < 2) {
      toast('Geef minstens twee keuzes op, gescheiden door komma’s', 'warning');
      return;
    }
    dispatch({
      type: 'addField',
      def: { id: newId('f'), name: name.trim(), type, options: type === 'dropdown' ? parseOptions(options) : [], showInForm },
    });
    toast(`Veld ‘${name.trim()}’ toegevoegd`);
    setName('');
    setOptions('');
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-3">
        <p className="text-gray-700">
          Extra velden verschijnen automatisch in het formulier, de detailweergave, de filters en de CSV-export. Zo kan de kalender
          meegroeien zonder dat er een ontwikkelaar aan te pas komt.
        </p>
        {state.fieldDefs.length === 0 && <p className="card p-6 text-gray-600">Nog geen extra velden.</p>}
        <ul className="grid gap-3">
          {state.fieldDefs.map((f) => (
            <FieldRow key={f.id} f={f} onDelete={() => setToDelete(f)} />
          ))}
        </ul>
      </div>

      <form onSubmit={add} className="card h-fit space-y-4 bg-gray-50 p-4">
        <h3 className="flex items-center gap-2 font-bold text-gray-900">
          <Plus className="size-4" aria-hidden="true" /> Nieuw veld
        </h3>
        <div>
          <label htmlFor="nf-name" className="field-label">
            Naam
          </label>
          <input id="nf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="bv. Doelpubliek bereik" />
        </div>
        <div>
          <label htmlFor="nf-type" className="field-label">
            Soort
          </label>
          <select id="nf-type" className="select" value={type} onChange={(e) => setType(e.target.value as FieldType)}>
            <option value="text">Tekst</option>
            <option value="dropdown">Keuzelijst</option>
            <option value="yesno">Ja/nee</option>
          </select>
        </div>
        {type === 'dropdown' && (
          <div>
            <label htmlFor="nf-options" className="field-label">
              Keuzes <span className="font-normal text-gray-600">(gescheiden door komma’s)</span>
            </label>
            <input
              id="nf-options"
              className="input"
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="bv. < 100, 100–1000, > 1000"
            />
          </div>
        )}
        <Switch checked={showInForm} onChange={setShowInForm} label="Tonen in het formulier" size="sm" />
        <button type="submit" className="btn-primary w-full" disabled={!name.trim()}>
          Veld toevoegen
        </button>
      </form>

      <Modal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Veld verwijderen?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setToDelete(null)}>
              Annuleren
            </button>
            <button
              type="button"
              className="btn bg-red-700 text-white hover:bg-red-800"
              onClick={() => {
                if (toDelete) dispatch({ type: 'removeField', id: toDelete.id });
                toast('Veld verwijderd');
                setToDelete(null);
              }}
            >
              Verwijderen
            </button>
          </>
        }
      >
        <p className="text-gray-800">
          Het veld ‘{toDelete?.name}’ en de ingevulde waarden bij alle momenten worden verwijderd.
        </p>
      </Modal>
    </div>
  );
}

function FieldRow({ f, onDelete }: { f: FieldDef; onDelete: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState(f.name);
  const [options, setOptions] = useState(f.options.join(', '));
  const used = state.moments.filter((m) => m.customFields[f.id]).length;

  const commitName = () => {
    const n = name.trim();
    if (!n) return setName(f.name);
    if (n !== f.name) {
      dispatch({ type: 'updateField', def: { ...f, name: n } });
      toast(`Hernoemd naar ‘${n}’`);
    }
  };
  const commitOptions = () => {
    const opts = Array.from(new Set(options.split(',').map((o) => o.trim()).filter(Boolean)));
    if (opts.join('|') !== f.options.join('|') && opts.length) {
      dispatch({ type: 'updateField', def: { ...f, options: opts } });
      toast('Keuzes bijgewerkt');
    }
    setOptions(opts.join(', '));
  };

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor={`fn-${f.id}`} className="field-label flex items-center gap-1.5">
            <Pencil className="size-3.5" aria-hidden="true" /> Naam
          </label>
          <input
            id={`fn-${f.id}`}
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          />
        </div>
        <div className="pb-2.5 text-sm text-gray-700">
          <span className="rounded-md bg-gray-100 px-2 py-1 font-semibold">{TYPE_LABEL[f.type]}</span>
        </div>
        <button type="button" className="btn-danger" onClick={onDelete} aria-label={`Verwijder veld ${f.name}`}>
          <Trash className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Verwijder</span>
        </button>
      </div>
      {f.type === 'dropdown' && (
        <div className="mt-3">
          <label htmlFor={`fo-${f.id}`} className="field-label">
            Keuzes <span className="font-normal text-gray-600">(gescheiden door komma’s)</span>
          </label>
          <input
            id={`fo-${f.id}`}
            className="input"
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            onBlur={commitOptions}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          />
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <Switch
          size="sm"
          checked={f.showInForm}
          onChange={(v) => dispatch({ type: 'updateField', def: { ...f, showInForm: v } })}
          label="Tonen in het formulier"
        />
        <span className="text-sm text-gray-600">Ingevuld bij {used} {used === 1 ? 'moment' : 'momenten'}</span>
      </div>
    </li>
  );
}

// ---------------------------------------------------------------------------

function Digest() {
  const { state, live } = useStore();
  const toast = useToast();
  const email = useMemo(() => digestEmail(state), [state]);
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async () => {
    setSending(true);
    try {
      const n = __LIVE__ ? await sendDigestNow() : 0;
      toast(`Digest verstuurd naar ${n} ${n === 1 ? 'persoon' : 'personen'}`);
      setConfirm(false);
    } catch (e) {
      toast(`Versturen mislukt: ${(e as Error).message}`, 'warning');
    }
    setSending(false);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-gray-700">
            De maandelijkse ‘nudge’-mail aan alle partners, automatisch samengesteld uit de kalender.
            {live
              ? ' Met ‘Verstuur digest nu’ gaat hij meteen naar alle gebruikers met toegang.'
              : ' In de echte versie vertrekt die op de eerste werkdag van de maand.'}
          </p>
          <p className="mt-2 text-sm text-gray-600">
            <strong className="text-gray-900">Onderwerp:</strong> {email.subject}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
        {live && (
          <button type="button" className="btn-primary" onClick={() => setConfirm(true)}>
            <Send className="size-4" aria-hidden="true" />
            Verstuur digest nu
          </button>
        )}
        <button
          type="button"
          className={live ? 'btn-secondary' : 'btn-primary'}
          onClick={async () => {
            const ok = await copyText(emailToText(email));
            setCopied(ok);
            toast(ok ? 'Digest gekopieerd als tekst' : 'Kopiëren lukte niet', ok ? 'success' : 'warning');
            if (ok) setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
          Kopieer als tekst
        </button>
        </div>
      </div>
      <EmailPreview email={email} />
      {!live && <SimNote>Niets wordt echt verstuurd. De inhoud verandert mee met wat er in de kalender staat.</SimNote>}
      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        size="sm"
        title="Digest nu versturen?"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirm(false)} disabled={sending}>
              Annuleren
            </button>
            <button type="button" className="btn-primary" onClick={send} disabled={sending}>
              <Send className="size-4" aria-hidden="true" />
              {sending ? 'Bezig…' : 'Versturen'}
            </button>
          </>
        }
      >
        <p className="text-gray-800">
          Iedereen met toegang tot de kalender krijgt deze e-mail, met het onderwerp “{email.subject}”.
        </p>
      </Modal>
    </div>
  );
}

function Export() {
  const { state } = useStore();
  const toast = useToast();
  const date = todayISO();
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card p-5">
        <FileSpreadsheet className="size-8 text-brand-700" aria-hidden="true" />
        <h3 className="mt-2 text-lg font-bold text-gray-900">Export CSV</h3>
        <p className="mt-1 text-gray-700">
          Alle {state.moments.length} momenten met alle velden, reacties en extra velden. Opent in Excel (puntkomma als
          scheidingsteken).
        </p>
        <button
          type="button"
          className="btn-primary mt-4"
          onClick={() => {
            downloadFile(`eiwitshift-momenten-${date}.csv`, buildCsv(state.moments, state.reactions, state.fieldDefs), 'text/csv;charset=utf-8');
            toast('CSV gedownload');
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Download CSV
        </button>
      </div>
      <div className="card p-5">
        <CalendarDays className="size-8 text-brand-700" aria-hidden="true" />
        <h3 className="mt-2 text-lg font-bold text-gray-900">Alle momenten als agenda</h3>
        <p className="mt-1 text-gray-700">Eén .ics-bestand om in Outlook of Google Agenda te importeren.</p>
        <button
          type="button"
          className="btn-secondary mt-4"
          onClick={() => {
            downloadFile(`eiwitshift-kalender-${date}.ics`, buildIcs(state.moments), 'text/calendar;charset=utf-8');
            toast('Agenda-bestand gedownload');
          }}
        >
          <Download className="size-4" aria-hidden="true" />
          Download .ics
        </button>
      </div>
    </div>
  );
}
