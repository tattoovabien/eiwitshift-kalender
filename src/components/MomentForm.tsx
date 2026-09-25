import { useMemo, useState } from 'react';
import { CircleAlert, Link as LinkIcon, LoaderCircle, Sparkles, TriangleAlert } from 'lucide-react';
import {
  FOCUSES,
  MOMENT_TYPES,
  REGION_SUGGESTIONS,
  TARGET_GROUPS,
  type Focus,
  type Moment,
  type MomentType,
  type TargetGroup,
} from '../types';
import { newId, useStore } from '../store';
import { findSimilar, orgsOf, whenLabel } from '../lib/moments';
import { fmtMonthTitle, monthKey, monthsBetween, nowStamp, todayISO } from '../lib/dates';
import { DEMO_LINK, fakeExtract } from '../lib/prefill';
import { Modal, SimNote, Switch, useToast } from './ui';

type DateMode = 'single' | 'range' | 'ongoing' | 'unsure';

interface Draft {
  title: string;
  type: MomentType;
  dateMode: DateMode;
  startDate: string;
  endDate: string;
  unsureMonth: string;
  unsureNote: string;
  targetGroup: TargetGroup;
  focus: Focus;
  free: boolean;
  region: string;
  organiser: string;
  coOrganisers: string;
  isGreenDealPartner: boolean;
  link: string;
  description: string;
  halfhalfLink: boolean;
  need: string;
  featured: boolean;
  customFields: Record<string, string>;
}

const MONTH_CHOICES = monthsBetween(monthKey(todayISO()), '2028-12');

function toDraft(m: Moment | undefined, org: string): Draft {
  if (!m) {
    return {
      title: '',
      type: 'Event',
      dateMode: 'single',
      startDate: '',
      endDate: '',
      unsureMonth: '',
      unsureNote: '',
      targetGroup: 'Breed',
      focus: '100% plantaardig',
      free: true,
      region: 'Vlaanderen',
      organiser: org,
      coOrganisers: '',
      isGreenDealPartner: true,
      link: '',
      description: '',
      halfhalfLink: false,
      need: '',
      featured: false,
      customFields: {},
    };
  }
  const dateMode: DateMode = m.dateUnsure ? 'unsure' : m.ongoing ? 'ongoing' : m.endDate && m.endDate !== m.startDate ? 'range' : 'single';
  return {
    title: m.title,
    type: m.type,
    dateMode,
    startDate: m.startDate ?? '',
    endDate: m.endDate ?? '',
    unsureMonth: m.dateUnsure && m.startDate ? monthKey(m.startDate) : '',
    unsureNote: m.unsureNote ?? '',
    targetGroup: m.targetGroup,
    focus: m.focus,
    free: m.free,
    region: m.region,
    organiser: m.organiser,
    coOrganisers: m.coOrganisers ?? '',
    isGreenDealPartner: m.isGreenDealPartner,
    link: m.link ?? '',
    description: m.description ?? '',
    halfhalfLink: m.halfhalfLink,
    need: m.need ?? '',
    featured: m.featured,
    customFields: { ...m.customFields },
  };
}

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.title.trim()) e.title = 'Geef een titel op.';
  if (!d.organiser.trim()) e.organiser = 'Wie organiseert dit?';
  if (d.dateMode === 'single' && !d.startDate) e.startDate = 'Kies een datum.';
  if (d.dateMode === 'range') {
    if (!d.startDate) e.startDate = 'Kies een startdatum.';
    if (!d.endDate) e.endDate = 'Kies een einddatum.';
    else if (d.startDate && d.endDate < d.startDate) e.endDate = 'De einddatum ligt vóór de startdatum.';
  }
  if (d.dateMode === 'unsure' && !d.unsureMonth) e.unsureMonth = 'Kies minstens de maand.';
  if (d.link.trim() && !/^https?:\/\/\S+\.\S+/.test(d.link.trim())) e.link = 'Een link begint met https://';
  return e;
}

export function MomentForm({
  open,
  editId,
  onClose,
  onSaved,
}: {
  open: boolean;
  editId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { state } = useStore();
  const editing = editId ? state.moments.find((m) => m.id === editId) : undefined;
  if (!open) return null;
  return <FormInner key={editId ?? 'new'} editing={editing} onClose={onClose} onSaved={onSaved} />;
}

function FormInner({
  editing,
  onClose,
  onSaved,
}: {
  editing: Moment | undefined;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { state, dispatch, role } = useStore();
  const toast = useToast();
  const isCoordinator = role.id === 'coordinator';
  const [d, setD] = useState<Draft>(() => toDraft(editing, isCoordinator ? '' : role.org));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pasteUrl, setPasteUrl] = useState('');
  const [reading, setReading] = useState(false);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [aiNote, setAiNote] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setD((prev) => ({ ...prev, [k]: v }));
    if (aiFields.has(k)) setAiFields((s) => new Set([...s].filter((x) => x !== k)));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: '' }));
  };

  const similar = useMemo(() => findSimilar(d.title, state.moments, editing?.id), [d.title, state.moments, editing?.id]);
  const knownOrgs = useMemo(() => Array.from(new Set(state.moments.flatMap(orgsOf))).sort(), [state.moments]);
  const formFields = state.fieldDefs.filter((f) => f.showInForm);

  const readLink = (raw: string) => {
    const url = raw.trim();
    if (!url) return;
    setReading(true);
    setAiNote(null);
    setTimeout(() => {
      const r = fakeExtract(url);
      setD((prev) => ({
        ...prev,
        title: r.title,
        type: r.type,
        dateMode: r.dateUnsure ? 'unsure' : r.endDate ? 'range' : 'single',
        startDate: r.dateUnsure ? '' : r.startDate,
        endDate: r.endDate ?? '',
        unsureMonth: r.dateUnsure ? monthKey(r.startDate) : '',
        targetGroup: r.targetGroup ?? prev.targetGroup,
        link: /^https?:\/\//.test(url) ? url : `https://${url}`,
        description: r.description ?? prev.description,
        organiser: isCoordinator && r.organiserGuess ? r.organiserGuess : prev.organiser,
      }));
      const filled = ['title', 'type', 'dateMode', 'startDate', 'endDate', 'unsureMonth', 'link', 'description'];
      if (r.targetGroup) filled.push('targetGroup');
      if (isCoordinator && r.organiserGuess) filled.push('organiser');
      setAiFields(new Set(filled));
      setErrors({});
      setReading(false);
      setAiNote(
        r.foundDate
          ? 'Titel, type en datum zijn ingevuld. Kijk ze even na voor je opslaat.'
          : 'Titel en type zijn ingevuld. Op de pagina stond geen duidelijke datum, dus we zetten ‘timing nog niet vast’. Pas aan waar nodig.',
      );
    }, 1500);
  };

  const save = () => {
    const e = validate(d);
    setErrors(e);
    if (Object.values(e).some(Boolean)) {
      toast('Nog niet alles is ingevuld', 'warning');
      return;
    }
    const base: Moment = {
      id: editing?.id ?? newId('m'),
      title: d.title.trim(),
      startDate:
        d.dateMode === 'unsure' ? `${d.unsureMonth}-01` : d.dateMode === 'ongoing' ? d.startDate || null : d.startDate,
      endDate: d.dateMode === 'range' || (d.dateMode === 'ongoing' && d.endDate) ? d.endDate || undefined : undefined,
      ongoing: d.dateMode === 'ongoing',
      dateUnsure: d.dateMode === 'unsure',
      unsureNote: d.dateMode === 'unsure' && d.unsureNote.trim() ? d.unsureNote.trim() : undefined,
      type: d.type,
      targetGroup: d.targetGroup,
      focus: d.focus,
      free: d.free,
      region: d.region.trim() || 'Vlaanderen',
      organiser: d.organiser.trim(),
      coOrganisers: d.coOrganisers.trim() || undefined,
      isGreenDealPartner: d.isGreenDealPartner,
      link: d.link.trim() || undefined,
      description: d.description.trim() || undefined,
      halfhalfLink: d.halfhalfLink,
      need: d.need.trim() || undefined,
      featured: d.featured,
      customFields: Object.fromEntries(Object.entries(d.customFields).filter(([, v]) => v)),
      createdBy: editing?.createdBy ?? role.org,
      createdAt: editing?.createdAt ?? nowStamp(),
      updatedAt: editing ? nowStamp() : undefined,
    };
    dispatch({ type: 'saveMoment', moment: base, isNew: !editing, byOrg: role.org });
    toast(
      editing
        ? 'Wijzigingen bewaard'
        : isCoordinator
          ? 'Moment toegevoegd'
          : 'Moment toegevoegd. De coördinatoren krijgen een melding.',
    );
    onSaved(base.id);
  };

  const ai = (k: string) =>
    aiFields.has(k) ? (
      <span className="ml-2 inline-flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[11px] font-semibold text-violet-900 ring-1 ring-violet-200">
        <Sparkles className="size-3" aria-hidden="true" /> ingevuld door AI
      </span>
    ) : null;
  const aiRing = (k: string) => (aiFields.has(k) ? 'ring-2 ring-violet-200 border-violet-400' : '');
  const err = (k: string) =>
    errors[k] ? (
      <p className="mt-1 flex items-center gap-1 text-sm font-medium text-red-700" id={`err-${k}`}>
        <CircleAlert className="size-4" aria-hidden="true" /> {errors[k]}
      </p>
    ) : null;
  const errProps = (k: string) =>
    errors[k] ? { 'aria-invalid': true as const, 'aria-describedby': `err-${k}` } : {};

  const dateModes: { id: DateMode; label: string }[] = [
    { id: 'single', label: 'Eén dag' },
    { id: 'range', label: 'Periode' },
    { id: 'ongoing', label: 'Doorlopend' },
    { id: 'unsure', label: 'Nog niet vast' },
  ];

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? 'Moment bewerken' : 'Moment toevoegen'}
      subtitle={
        editing
          ? `Je bewerkt als ${role.label.replace('Partner: ', '')}.`
          : 'Deel je campagne, event of publicatie met de andere partners.'
      }
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Annuleren
          </button>
          <button type="button" className="btn-primary" onClick={save} disabled={reading}>
            {editing ? 'Wijzigingen bewaren' : 'Moment toevoegen'}
          </button>
        </>
      }
    >
      <form
        className="space-y-7"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {!editing && (
          <section className="rounded-xl bg-violet-50/60 p-4 ring-1 ring-violet-200 ring-inset">
            <label htmlFor="paste-link" className="flex items-center gap-2 text-base font-bold text-gray-900">
              <Sparkles className="size-5 text-violet-700" aria-hidden="true" />
              Plak een link
            </label>
            <p className="mt-0.5 text-sm text-gray-700">Plak de link naar je webpagina, dan vullen we het formulier voor je in.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <LinkIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                <input
                  id="paste-link"
                  type="url"
                  inputMode="url"
                  className="input pl-9"
                  placeholder="https://…"
                  value={pasteUrl}
                  disabled={reading}
                  onChange={(e) => setPasteUrl(e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    if (/^\s*(https?:\/\/|www\.)/.test(text)) {
                      e.preventDefault();
                      setPasteUrl(text.trim());
                      readLink(text);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      readLink(pasteUrl);
                    }
                  }}
                  data-autofocus
                />
              </div>
              <button type="button" className="btn bg-violet-700 text-white hover:bg-violet-800" disabled={reading || !pasteUrl.trim()} onClick={() => readLink(pasteUrl)}>
                {reading ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
                Lees pagina
              </button>
            </div>
            {!pasteUrl && !reading && (
              <button
                type="button"
                className="mt-2 min-h-9 text-sm font-semibold text-violet-800 underline underline-offset-2 hover:text-violet-950"
                onClick={() => {
                  setPasteUrl(DEMO_LINK);
                  readLink(DEMO_LINK);
                }}
              >
                Probeer met een voorbeeldlink
              </button>
            )}
            <div aria-live="polite">
              {reading && (
                <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-violet-900">
                  <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  AI leest de pagina…
                </div>
              )}
              {aiNote && !reading && (
                <p className="mt-3 flex items-start gap-2 text-sm text-violet-950">
                  <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {aiNote}
                </p>
              )}
            </div>
            <div className="mt-3">
              <SimNote>
                Gesimuleerd: dit prototype haalt de gegevens uit de tekst van de link zelf. In de echte versie leest AI de volledige
                webpagina.
              </SimNote>
            </div>
          </section>
        )}

        <fieldset disabled={reading} className={`space-y-7 ${reading ? 'pointer-events-none' : ''}`}>
          {/* WAT */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold tracking-wide text-gray-600 uppercase">Wat</h3>
            <div>
              <label htmlFor="f-title" className="field-label">
                Titel <span className="text-red-700">*</span>
                {ai('title')}
              </label>
              {reading ? (
                <div className="shimmer h-11 rounded-lg" />
              ) : (
                <input
                  id="f-title"
                  className={`input ${aiRing('title')}`}
                  value={d.title}
                  onChange={(e) => set('title', e.target.value)}
                  placeholder="bv. Week van de Peulvrucht"
                  {...errProps('title')}
                />
              )}
              {err('title')}
              {similar.length > 0 && (
                <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 ring-1 ring-amber-300 ring-inset" role="status">
                  <p className="flex items-center gap-2 font-semibold">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                    Lijkt op {similar.length === 1 ? 'een moment dat al in de kalender staat' : 'momenten die al in de kalender staan'}:
                  </p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-6">
                    {similar.map((m) => (
                      <li key={m.id}>
                        <strong>{m.title}</strong> · {whenLabel(m)} · {m.organiser}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-amber-900">Is het hetzelfde? Reageer dan liever op het bestaande moment.</p>
                </div>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="f-type" className="field-label">
                  Type {ai('type')}
                </label>
                <select id="f-type" className={`select ${aiRing('type')}`} value={d.type} onChange={(e) => set('type', e.target.value as MomentType)}>
                  {MOMENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-focus" className="field-label">
                  Focus
                </label>
                <select id="f-focus" className="select" value={d.focus} onChange={(e) => set('focus', e.target.value as Focus)}>
                  {FOCUSES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* WANNEER */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold tracking-wide text-gray-600 uppercase">
              Wanneer {ai('dateMode')}
            </h3>
            <div role="radiogroup" aria-label="Soort datum" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 sm:grid-cols-4">
              {dateModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  role="radio"
                  aria-checked={d.dateMode === mode.id}
                  onClick={() => set('dateMode', mode.id)}
                  className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors ${
                    d.dateMode === mode.id ? 'bg-white text-brand-800 shadow-sm ring-1 ring-gray-200' : 'text-gray-700 hover:bg-white/60'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            {reading ? (
              <div className="shimmer h-11 rounded-lg" />
            ) : d.dateMode === 'unsure' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="f-month" className="field-label">
                    Maand <span className="text-red-700">*</span>
                  </label>
                  <select
                    id="f-month"
                    className={`select ${aiRing('unsureMonth')}`}
                    value={d.unsureMonth}
                    onChange={(e) => set('unsureMonth', e.target.value)}
                    {...errProps('unsureMonth')}
                  >
                    <option value="">Kies een maand</option>
                    {(d.unsureMonth && !MONTH_CHOICES.includes(d.unsureMonth) ? [d.unsureMonth, ...MONTH_CHOICES] : MONTH_CHOICES).map((k) => (
                      <option key={k} value={k}>
                        {fmtMonthTitle(k)}
                      </option>
                    ))}
                  </select>
                  {err('unsureMonth')}
                </div>
                <div>
                  <label htmlFor="f-unsure-note" className="field-label">
                    Wat weet je al? (optioneel)
                  </label>
                  <input
                    id="f-unsure-note"
                    className="input"
                    value={d.unsureNote}
                    onChange={(e) => set('unsureNote', e.target.value)}
                    placeholder="bv. 11 of 12 mei"
                  />
                </div>
                <p className="text-sm text-gray-600 sm:col-span-2">Wordt getoond als “timing nog niet vast” in de gekozen maand.</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="f-start" className="field-label">
                    {d.dateMode === 'single' ? 'Datum' : 'Startdatum'}
                    {d.dateMode !== 'ongoing' && <span className="text-red-700"> *</span>}
                    {d.dateMode === 'ongoing' && <span className="font-normal text-gray-600"> (optioneel)</span>}
                  </label>
                  <input
                    id="f-start"
                    type="date"
                    className={`input ${aiRing('startDate')}`}
                    value={d.startDate}
                    onChange={(e) => set('startDate', e.target.value)}
                    {...errProps('startDate')}
                  />
                  {err('startDate')}
                </div>
                {(d.dateMode === 'range' || d.dateMode === 'ongoing') && (
                  <div>
                    <label htmlFor="f-end" className="field-label">
                      Einddatum
                      {d.dateMode === 'range' ? <span className="text-red-700"> *</span> : <span className="font-normal text-gray-600"> (leeg = loopt door)</span>}
                    </label>
                    <input
                      id="f-end"
                      type="date"
                      className={`input ${aiRing('endDate')}`}
                      value={d.endDate}
                      min={d.startDate || undefined}
                      onChange={(e) => set('endDate', e.target.value)}
                      {...errProps('endDate')}
                    />
                    {err('endDate')}
                  </div>
                )}
              </div>
            )}
          </section>

          {/* VOOR WIE */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold tracking-wide text-gray-600 uppercase">Voor wie en waar</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="f-target" className="field-label">
                  Doelgroep {ai('targetGroup')}
                </label>
                <select
                  id="f-target"
                  className={`select ${aiRing('targetGroup')}`}
                  value={d.targetGroup}
                  onChange={(e) => set('targetGroup', e.target.value as TargetGroup)}
                >
                  {TARGET_GROUPS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="f-region" className="field-label">
                  Regio
                </label>
                <input
                  id="f-region"
                  className="input"
                  list="region-options"
                  value={d.region}
                  onChange={(e) => set('region', e.target.value)}
                  placeholder="Vlaanderen, Brussel, provincie of stad"
                />
                <datalist id="region-options">
                  {REGION_SUGGESTIONS.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </div>
            </div>
            <fieldset>
              <legend className="field-label">Toegang</legend>
              <div className="flex gap-2">
                {[
                  { v: true, label: 'Gratis' },
                  { v: false, label: 'Betalend' },
                ].map((o) => (
                  <label
                    key={o.label}
                    className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold sm:flex-none ${
                      d.free === o.v ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <input type="radio" name="free" className="sr-only" checked={d.free === o.v} onChange={() => set('free', o.v)} />
                    {o.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          {/* WIE */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold tracking-wide text-gray-600 uppercase">Organisatie</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="f-org" className="field-label">
                  Organisator <span className="text-red-700">*</span> {ai('organiser')}
                </label>
                {isCoordinator ? (
                  <>
                    <input
                      id="f-org"
                      className={`input ${aiRing('organiser')}`}
                      list="org-options"
                      value={d.organiser}
                      onChange={(e) => set('organiser', e.target.value)}
                      {...errProps('organiser')}
                    />
                    <datalist id="org-options">
                      {knownOrgs.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <input id="f-org" className="input bg-gray-100 text-gray-700" value={d.organiser} readOnly />
                )}
                {err('organiser')}
              </div>
              <div>
                <label htmlFor="f-co" className="field-label">
                  Samen met <span className="font-normal text-gray-600">(optioneel)</span>
                </label>
                <input
                  id="f-co"
                  className="input"
                  value={d.coOrganisers}
                  onChange={(e) => set('coOrganisers', e.target.value)}
                  placeholder="bv. Rikolto, Stad Gent"
                />
              </div>
            </div>
            {!isCoordinator && (
              <p className="-mt-2 text-sm text-gray-600">Partners voegen momenten toe namens hun eigen organisatie. Co-organisatoren kunnen het moment ook bewerken.</p>
            )}
            <div>
              <label htmlFor="f-need" className="field-label">
                Wat zoek je? <span className="font-normal text-gray-600">(optioneel)</span>
              </label>
              <textarea
                id="f-need"
                className="input"
                rows={2}
                value={d.need}
                onChange={(e) => set('need', e.target.value)}
                placeholder="bv. zoeken partners om mee te verspreiden, sprekers, een locatie…"
              />
              <p className="mt-1 text-sm text-gray-600">Momenten met een vraag krijgen het label ‘Zoekt partners’ en komen in de maandelijkse digest.</p>
            </div>
            {isCoordinator && (
              <div className="grid gap-x-6 sm:grid-cols-2">
                <Switch checked={d.isGreenDealPartner} onChange={(v) => set('isGreenDealPartner', v)} label="Organisator is Green Deal-partner" />
                <Switch checked={d.featured} onChange={(v) => set('featured', v)} label="Uitgelicht (enkel coördinatoren)" />
              </div>
            )}
          </section>

          {/* MEER INFO */}
          <section className="space-y-4">
            <h3 className="text-sm font-bold tracking-wide text-gray-600 uppercase">Meer info</h3>
            <div>
              <label htmlFor="f-link" className="field-label">
                Link {ai('link')}
              </label>
              <input
                id="f-link"
                type="url"
                inputMode="url"
                className={`input ${aiRing('link')}`}
                value={d.link}
                onChange={(e) => set('link', e.target.value)}
                placeholder="https://"
                {...errProps('link')}
              />
              {err('link')}
            </div>
            <div>
              <label htmlFor="f-desc" className="field-label">
                Korte beschrijving {ai('description')}
              </label>
              {reading ? (
                <div className="shimmer h-24 rounded-lg" />
              ) : (
                <textarea
                  id="f-desc"
                  className={`input ${aiRing('description')}`}
                  rows={3}
                  value={d.description}
                  onChange={(e) => set('description', e.target.value)}
                />
              )}
            </div>
            <Switch checked={d.halfhalfLink} onChange={(v) => set('halfhalfLink', v)} label="Heeft een link met halfhalf" />
          </section>

          {formFields.length > 0 && (
            <section className="space-y-4">
              <h3 className="text-sm font-bold tracking-wide text-gray-600 uppercase">Extra velden</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                {formFields.map((f) => {
                  const id = `cf-${f.id}`;
                  const value = d.customFields[f.id] ?? '';
                  const setCf = (v: string) => set('customFields', { ...d.customFields, [f.id]: v });
                  if (f.type === 'yesno') {
                    return (
                      <div key={f.id} className="sm:col-span-1">
                        <Switch checked={value === 'ja'} onChange={(v) => setCf(v ? 'ja' : 'nee')} label={f.name} />
                      </div>
                    );
                  }
                  return (
                    <div key={f.id}>
                      <label htmlFor={id} className="field-label">
                        {f.name}
                      </label>
                      {f.type === 'dropdown' ? (
                        <select id={id} className="select" value={value} onChange={(e) => setCf(e.target.value)}>
                          <option value="">—</option>
                          {f.options.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      ) : (
                        <input id={id} className="input" value={value} onChange={(e) => setCf(e.target.value)} />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </fieldset>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  );
}
