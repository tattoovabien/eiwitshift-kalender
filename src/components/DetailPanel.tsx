import { useEffect, useRef, useState } from 'react';
import {
  Building,
  CalendarDays,
  CalendarPlus,
  Check,
  Copy,
  ExternalLink,
  Handshake,
  Lock,
  MapPin,
  Megaphone,
  MessageSquare,
  Pencil,
  Send,
  ShieldAlert,
  Star,
  Trash,
  X,
} from 'lucide-react';
import type { Comment, Moment, NotificationKind, Reaction, ReactionKind } from '../types';
import { SIGNAL_KINDS, type SignalKind } from '../types';
import { REACTION_LABEL, useStore } from '../store';
import { canEdit, isOwnedBy, isPast, organiserLabel, whenLabel } from '../lib/moments';
import { fmtLongDate, fmtMedium, fmtRelative, todayISO } from '../lib/dates';
import { buildIcs, copyText, downloadFile, slugify } from '../lib/files';
import { COORDINATOR_ORG } from '../roles';
import { Drawer, Modal, Pill, SectionTitle, Switch, TypeBadge, useToast } from './ui';

export const HALFHALF_SENTENCE =
  'Dit initiatief past binnen de halfhalf-richtlijn van het Vlaams Instituut Gezond Leven. Meer info: halfhalf.be';

/** What a clicked notification points at, so the panel can scroll to it and light it up. */
export interface DetailFocus {
  kind: NotificationKind;
  refId?: string;
  fromOrg?: string;
  detail?: string;
}

/** Find the element a notification is about (older notifications have no refId: match on org or text). */
function findFocusTarget(root: HTMLElement, f: DetailFocus): HTMLElement | null {
  const all = (prefix: string) => Array.from(root.querySelectorAll<HTMLElement>(`[data-focus^="${prefix}:"]`));
  const byId = f.refId ? root.querySelector<HTMLElement>(`[data-focus="${f.kind === 'reaction' ? 'reaction' : f.kind}:${f.refId}"]`) : null;
  if (byId) return byId;
  if (f.kind === 'reaction') return all('reaction').find((el) => el.dataset.org === f.fromOrg) ?? null;
  if (f.kind === 'comment') return all('comment').find((el) => !!f.detail && (el.textContent ?? '').includes(f.detail)) ?? null;
  if (f.kind === 'signal') return all('signal')[0] ?? null;
  return null;
}

export function DetailPanel({
  momentId,
  focus,
  onClose,
  onEdit,
}: {
  momentId: string | null;
  focus?: DetailFocus | null;
  onClose: () => void;
  onEdit: (id: string) => void;
}) {
  const { state } = useStore();
  const m = momentId ? state.moments.find((x) => x.id === momentId) : undefined;
  return (
    <Drawer open={!!m} onClose={onClose} label={m ? `Details: ${m.title}` : 'Details'}>
      {m && <DetailContent key={m.id} m={m} focus={focus ?? null} onClose={onClose} onEdit={() => onEdit(m.id)} />}
    </Drawer>
  );
}

function DetailContent({
  m,
  focus,
  onClose,
  onEdit,
}: {
  m: Moment;
  focus: DetailFocus | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { state, dispatch, role, live } = useStore();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const limited = role.id === 'anon';
  const editable = canEdit(m, role);
  const past = isPast(m, todayISO());
  const bodyRef = useRef<HTMLDivElement>(null);

  // Opened from a notification: scroll to what happened and light it up for a moment.
  useEffect(() => {
    if (!focus || focus.kind === 'new_moment') return;
    const t = setTimeout(() => {
      const el = bodyRef.current && findFocusTarget(bodyRef.current, focus);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('focus-flash');
      setTimeout(() => el.classList.remove('focus-flash'), 3200);
    }, 250);
    return () => clearTimeout(t);
  }, [focus]);

  const downloadIcs = () => {
    downloadFile(`${slugify(m.title)}.ics`, buildIcs([m], m.title, limited), 'text/calendar;charset=utf-8');
    toast('Agenda-bestand (.ics) gedownload');
  };

  return (
    <>
      <div className="flex items-center gap-1 border-b border-gray-200 px-3 py-2">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Sluit details" data-autofocus>
          <X className="size-5" />
        </button>
        <span className="flex-1 truncate text-sm font-semibold text-gray-600">Moment</span>
        {editable && (
          <button type="button" className="btn-secondary" onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Bewerken
          </button>
        )}
      </div>

      <div ref={bodyRef} className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-5 py-5 sm:px-6">
          {/* Title block */}
          <div>
            {!limited && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                <TypeBadge type={m.type} />
                {m.featured && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">
                    <Star className="size-3" aria-hidden="true" /> Uitgelicht
                  </span>
                )}
                {m.halfhalfLink && <Pill className="bg-brand-50 text-brand-800">Link met halfhalf</Pill>}
                {past && <Pill>Voorbij</Pill>}
              </div>
            )}
            <h2 className="text-xl leading-snug font-bold text-gray-900 sm:text-2xl">{m.title}</h2>
            <p className="mt-2 flex items-start gap-2 text-gray-800">
              <CalendarDays className="mt-0.5 size-5 shrink-0 text-gray-500" aria-hidden="true" />
              <span>
                {m.startDate && !m.endDate && !m.dateUnsure && !m.ongoing ? fmtLongDate(m.startDate) : whenLabel(m)}
              </span>
            </p>
            {!limited && (
              <>
                <p className="mt-1 flex items-start gap-2 text-gray-800">
                  <Building className="mt-0.5 size-5 shrink-0 text-gray-500" aria-hidden="true" />
                  <span>
                    {organiserLabel(m)}
                    {m.isGreenDealPartner && (
                      <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold text-brand-800">
                        Green Deal-partner
                      </span>
                    )}
                  </span>
                </p>
                <p className="mt-1 flex items-start gap-2 text-gray-800">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-gray-500" aria-hidden="true" />
                  {m.region}
                </p>
              </>
            )}
          </div>

          {limited ? (
            <div className="rounded-xl bg-gray-50 p-5 ring-1 ring-gray-200 ring-inset">
              <p className="flex items-center gap-2 font-semibold text-gray-900">
                <Lock className="size-4" aria-hidden="true" /> Meer details na inloggen
              </p>
              <p className="mt-1 text-sm text-gray-700">
                Organisator, contactinfo, beschrijving en wie er aanhaakt zijn enkel zichtbaar voor partners van de Green Deal
                Eiwitshift.{' '}
                {live
                  ? 'Je logt in met een code die je per e-mail krijgt, zonder wachtwoord.'
                  : 'In de echte versie log je in met een link die je per e-mail krijgt, zonder wachtwoord.'}
              </p>
              {live ? (
                live.profile?.status === 'pending' ? (
                  <p className="mt-3 text-sm font-semibold text-gray-800">Je aanvraag wacht op goedkeuring door een coördinator.</p>
                ) : (
                  !live.email && (
                    <button type="button" className="btn-primary mt-3" onClick={() => live.setLoginOpen(true)}>
                      Inloggen
                    </button>
                  )
                )
              ) : (
                <p className="mt-3 text-sm text-gray-700">Kies bovenaan een partnerrol om dit te demonstreren.</p>
              )}
            </div>
          ) : (
            <>
              {m.need?.trim() && (
                <div className="rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 ring-inset">
                  <p className="flex items-center gap-2 text-sm font-bold text-amber-950">
                    <Handshake className="size-4" aria-hidden="true" /> De organisator zoekt
                  </p>
                  <p className="mt-1 text-amber-950">{m.need}</p>
                </div>
              )}

              <ReactionBlock m={m} />

              <section>
                <SectionTitle>Details</SectionTitle>
                <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm min-[420px]:grid-cols-2">
                  <Field label="Type" value={m.type} />
                  <Field label="Doelgroep" value={m.targetGroup} />
                  <Field label="Focus" value={m.focus} />
                  <Field label="Toegang" value={m.free ? 'Gratis' : 'Betalend'} />
                  <Field label="Regio" value={m.region} />
                  <Field label="Green Deal-partner" value={m.isGreenDealPartner ? 'Ja' : 'Nee'} />
                  <Field label="Link met halfhalf" value={m.halfhalfLink ? 'Ja' : 'Nee'} />
                  {state.fieldDefs.map((d) => {
                    const v = m.customFields[d.id];
                    const shown = d.type === 'yesno' ? (v === 'ja' ? 'Ja' : v === 'nee' ? 'Nee' : '—') : v || '—';
                    return <Field key={d.id} label={d.name} value={shown} extra />;
                  })}
                </dl>
                {m.description && <p className="mt-4 leading-relaxed whitespace-pre-line text-gray-800">{m.description}</p>}
                {m.link && (
                  <a
                    href={m.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-11 items-center gap-2 font-semibold break-all text-brand-800 underline underline-offset-2 hover:text-brand-900"
                  >
                    <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                    {m.link.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </section>

              <section>
                <SectionTitle>Communicatie</SectionTitle>
                <div className="space-y-3">
                  <HalfhalfCopy />
                  <button type="button" className="btn-secondary w-full sm:w-auto" onClick={downloadIcs}>
                    <CalendarPlus className="size-4" aria-hidden="true" />
                    Voeg toe aan agenda (.ics)
                  </button>
                </div>
              </section>

              <Comments m={m} />

              {role.id === 'coordinator' ? <SignalsForCoordinator m={m} /> : <SignalForm m={m} />}

              <p className="border-t border-gray-200 pt-4 text-xs text-gray-600">
                Toegevoegd door {m.createdBy} op {fmtMedium(m.createdAt.slice(0, 10))}
                {m.updatedAt && ` · laatst bewerkt ${fmtRelative(m.updatedAt)}`}
              </p>
              {editable && (
                <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
                  <Trash className="size-4" aria-hidden="true" />
                  Verwijder moment
                </button>
              )}
            </>
          )}

          {limited && (
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={downloadIcs}>
              <CalendarPlus className="size-4" aria-hidden="true" />
              Voeg toe aan agenda (.ics)
            </button>
          )}
        </div>
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Moment verwijderen?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmDelete(false)}>
              Annuleren
            </button>
            <button
              type="button"
              className="btn bg-red-700 text-white hover:bg-red-800"
              onClick={() => {
                dispatch({ type: 'deleteMoment', id: m.id });
                setConfirmDelete(false);
                onClose();
                toast('Moment verwijderd');
              }}
            >
              Verwijderen
            </button>
          </>
        }
      >
        <p className="text-gray-800">
          ‘{m.title}’ en alle reacties en opmerkingen erbij worden verwijderd.
          {live ? ' Dit kan je niet ongedaan maken.' : ' (In de demo kan je alles terugzetten met ‘Reset demo’.)'}
        </p>
      </Modal>
    </>
  );
}

function Field({ label, value, extra }: { label: string; value: string; extra?: boolean }) {
  return (
    <div>
      <dt className="text-gray-600">
        {label}
        {extra && <span className="sr-only"> (extra veld)</span>}
      </dt>
      <dd className="font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ReactionBlock({ m }: { m: Moment }) {
  const { state, dispatch, role } = useStore();
  const toast = useToast();
  const reactions = state.reactions.filter((r) => r.momentId === m.id);
  const own = isOwnedBy(m, role.org);
  const mine = (kind: ReactionKind) => reactions.find((r) => r.org === role.org && r.kind === kind);

  const toggle = (kind: ReactionKind) => {
    const existing = mine(kind);
    if (existing) {
      dispatch({ type: 'removeReaction', id: existing.id });
      toast('Reactie ingetrokken', 'info');
    } else {
      dispatch({ type: 'addReaction', momentId: m.id, kind, org: role.org, name: role.person });
      toast(`Genoteerd: ${REACTION_LABEL[kind]}. ${m.organiser} krijgt een melding.`);
    }
  };

  const canToggleContact = (r: Reaction) => role.id === 'coordinator' || own || r.org === role.org;

  return (
    <section>
      {own ? (
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-200 ring-inset">
          Dit is een moment van jouw organisatie. Je krijgt een melding zodra een partner aanhaakt of reageert.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
          {(['join', 'spread'] as ReactionKind[]).map((kind) => {
            const active = !!mine(kind);
            const Icon = kind === 'join' ? Handshake : Megaphone;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(kind)}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold transition-colors ${
                  active
                    ? 'bg-brand-700 text-white hover:bg-brand-800'
                    : 'border-2 border-brand-700 bg-white text-brand-800 hover:bg-brand-50'
                }`}
              >
                {active ? <Check className="size-5" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
                {REACTION_LABEL[kind]}
              </button>
            );
          })}
        </div>
      )}
      {!own && (
        <p className="mt-2 text-xs text-gray-600">
          Eén klik, namens <strong>{role.org}</strong>. Nog eens klikken trekt je reactie in.
        </p>
      )}

      {reactions.length > 0 && (
        <div className="mt-5">
          <SectionTitle>
            Wie doet mee <span className="font-normal text-gray-600">({reactions.length})</span>
          </SectionTitle>
          <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {reactions.map((r) => (
              <li key={r.id} data-focus={`reaction:${r.id}`} data-org={r.org} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-semibold text-gray-900">
                    {r.org}
                    <span className="ml-1 font-normal text-gray-600">· {r.name}</span>
                  </p>
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      r.kind === 'join' ? 'bg-brand-50 text-brand-800' : 'bg-sky-50 text-sky-900'
                    }`}
                  >
                    {REACTION_LABEL[r.kind]}
                  </span>
                </div>
                {r.note && <p className="mt-1 text-sm text-gray-700">“{r.note}”</p>}
                {r.org === role.org && <NoteEditor r={r} />}
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  {canToggleContact(r) ? (
                    <Switch
                      size="sm"
                      checked={r.inContact}
                      onChange={() => dispatch({ type: 'toggleContact', id: r.id })}
                      label="We zijn al in contact"
                    />
                  ) : (
                    <span className={`text-sm ${r.inContact ? 'font-semibold text-brand-800' : 'text-gray-600'}`}>
                      {r.inContact ? '✓ Al in contact' : 'Nog niet in contact'}
                    </span>
                  )}
                  <span className="text-xs text-gray-600">{fmtRelative(r.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function NoteEditor({ r }: { r: Reaction }) {
  const { dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(r.note ?? '');
  if (!open) {
    return (
      <button type="button" className="mt-1 min-h-9 text-sm font-semibold text-brand-800 underline-offset-2 hover:underline" onClick={() => setOpen(true)}>
        {r.note ? 'Toelichting aanpassen' : '+ Korte toelichting toevoegen (optioneel)'}
      </button>
    );
  }
  return (
    <form
      className="mt-2 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({ type: 'setReactionNote', id: r.id, note: text.trim() });
        setOpen(false);
      }}
    >
      <label htmlFor={`note-${r.id}`} className="sr-only">
        Toelichting
      </label>
      <input
        id={`note-${r.id}`}
        className="input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="bv. wij kunnen een talk geven"
        autoFocus
      />
      <button type="submit" className="btn-primary">
        Bewaar
      </button>
    </form>
  );
}

function HalfhalfCopy() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">Kopieer halfhalf-zinnetje</p>
      <p className="mt-1 text-sm text-gray-700">{HALFHALF_SENTENCE}</p>
      <button
        type="button"
        className="btn-soft mt-3"
        onClick={async () => {
          const ok = await copyText(HALFHALF_SENTENCE);
          setCopied(ok);
          toast(ok ? 'Zinnetje gekopieerd' : 'Kopiëren lukte niet – selecteer de tekst zelf', ok ? 'success' : 'warning');
          if (ok) setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        {copied ? 'Gekopieerd' : 'Kopieer'}
      </button>
    </div>
  );
}

function Comments({ m }: { m: Moment }) {
  const { state, dispatch, role, live } = useStore();
  const toast = useToast();
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const comments = state.comments.filter((c) => c.momentId === m.id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));

  // Live: only the person who wrote it. Prototype (no real users): the same organisation as the demo role.
  const myId = live?.profile?.userId;
  const isMine = (c: Comment) => (live ? !!myId && c.authorId === myId : c.org === role.org);
  const canDelete = (c: Comment) => isMine(c) || role.id === 'coordinator';

  const saveEdit = (c: Comment) => {
    const t = draft.trim();
    if (!t) return;
    if (t !== c.text) {
      dispatch({ type: 'editComment', id: c.id, text: t });
      toast('Opmerking aangepast');
    }
    setEditingId(null);
  };

  return (
    <section>
      <SectionTitle>
        <span className="inline-flex items-center gap-2">
          <MessageSquare className="size-4" aria-hidden="true" /> Opmerkingen{' '}
          <span className="font-normal text-gray-600">({comments.length})</span>
        </span>
      </SectionTitle>
      {comments.length === 0 && <p className="mb-3 text-sm text-gray-600">Nog geen opmerkingen. Stel gerust een vraag aan de organisator.</p>}
      <ul className="mb-3 space-y-3">
        {comments.map((c) => {
          const isMe = c.org === role.org;
          const editing = editingId === c.id;
          return (
            <li key={c.id} data-focus={`comment:${c.id}`} className={`rounded-xl px-4 py-3 ${isMe ? 'bg-brand-50' : 'bg-gray-100'}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {c.org}
                  {c.org === COORDINATOR_ORG && <span className="ml-1 font-normal text-gray-600">(coördinatie)</span>}
                </span>
                <span className="text-xs text-gray-600">
                  {fmtRelative(c.createdAt)}
                  {c.editedAt && ' · aangepast'}
                </span>
              </div>
              {editing ? (
                <form
                  className="mt-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(c);
                  }}
                >
                  <label htmlFor={`edit-${c.id}`} className="sr-only">
                    Opmerking aanpassen
                  </label>
                  <textarea
                    id={`edit-${c.id}`}
                    className="input min-h-20"
                    rows={3}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    autoFocus
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="btn-ghost" onClick={() => setEditingId(null)}>
                      Annuleren
                    </button>
                    <button type="submit" className="btn-primary" disabled={!draft.trim()}>
                      Bewaar
                    </button>
                  </div>
                </form>
              ) : (
                <p className="mt-1 text-[15px] whitespace-pre-line text-gray-800">{c.text}</p>
              )}
              {!editing && (isMine(c) || canDelete(c)) && (
                confirmId === c.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" role="alert">
                    <span className="text-gray-800">Deze opmerking verwijderen?</span>
                    <button
                      type="button"
                      className="btn min-h-9 bg-red-700 px-3 text-white hover:bg-red-800"
                      onClick={() => {
                        dispatch({ type: 'deleteComment', id: c.id });
                        setConfirmId(null);
                        toast('Opmerking verwijderd');
                      }}
                    >
                      Verwijderen
                    </button>
                    <button type="button" className="btn-ghost min-h-9 px-3" onClick={() => setConfirmId(null)}>
                      Annuleren
                    </button>
                  </div>
                ) : (
                  <div className="mt-1 flex gap-1">
                    {isMine(c) && (
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-gray-700 hover:bg-white/70"
                        onClick={() => {
                          setEditingId(c.id);
                          setDraft(c.text);
                        }}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" /> Aanpassen
                      </button>
                    )}
                    {canDelete(c) && (
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-red-700 hover:bg-white/70"
                        onClick={() => setConfirmId(c.id)}
                      >
                        <Trash className="size-3.5" aria-hidden="true" /> Verwijderen
                      </button>
                    )}
                  </div>
                )
              )}
            </li>
          );
        })}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          dispatch({ type: 'addComment', momentId: m.id, org: role.org, text: text.trim(), authorId: myId });
          setText('');
          toast('Opmerking geplaatst');
        }}
      >
        <label htmlFor="comment" className="sr-only">
          Nieuwe opmerking
        </label>
        <textarea
          id="comment"
          className="input min-h-20"
          rows={2}
          placeholder={`Schrijf een opmerking als ${role.org}…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <button type="submit" className="btn-primary" disabled={!text.trim()}>
            <Send className="size-4" aria-hidden="true" />
            Plaats opmerking
          </button>
        </div>
      </form>
    </section>
  );
}

function SignalForm({ m }: { m: Moment }) {
  const { dispatch, role } = useStore();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SignalKind>(SIGNAL_KINDS[0]);
  const [note, setNote] = useState('');
  const [anonymous, setAnonymous] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2 text-left text-sm font-semibold text-gray-700 hover:border-gray-500 hover:bg-gray-50"
        onClick={() => setOpen(true)}
      >
        <ShieldAlert className="size-4 shrink-0" aria-hidden="true" />
        Signaleer bezorgdheid (enkel zichtbaar voor coördinatoren)
      </button>
    );
  }
  return (
    <form
      className="rounded-xl border border-gray-300 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        dispatch({ type: 'addSignal', momentId: m.id, kind, note: note.trim(), anonymous, org: role.org });
        setOpen(false);
        setNote('');
        toast('Bedankt. Je signaal is enkel zichtbaar voor de coördinatoren.');
      }}
    >
      <p className="flex items-center gap-2 font-semibold text-gray-900">
        <ShieldAlert className="size-4" aria-hidden="true" /> Signaleer bezorgdheid
      </p>
      <p className="mt-1 text-sm text-gray-600">Enkel de coördinatoren van Departement Omgeving zien dit. De organisator niet.</p>
      <fieldset className="mt-3">
        <legend className="field-label">Wat is er aan de hand?</legend>
        <div className="space-y-1">
          {SIGNAL_KINDS.map((k) => (
            <label key={k} className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-gray-800">
              <input
                type="radio"
                name="signal-kind"
                className="size-5 accent-brand-700"
                checked={kind === k}
                onChange={() => setKind(k)}
              />
              {k}
            </label>
          ))}
        </div>
      </fieldset>
      <label htmlFor="signal-note" className="field-label mt-3">
        Toelichting (optioneel)
      </label>
      <textarea
        id="signal-note"
        className="input"
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="bv. valt samen met een ander event voor hetzelfde publiek"
      />
      <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800">
        <input type="checkbox" className="size-5 accent-brand-700" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Anoniem melden (ook de coördinatoren zien niet van wie het komt)
      </label>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
          Annuleren
        </button>
        <button type="submit" className="btn-primary">
          Verstuur naar coördinatoren
        </button>
      </div>
    </form>
  );
}

function SignalsForCoordinator({ m }: { m: Moment }) {
  const { state } = useStore();
  const signals = state.signals.filter((s) => s.momentId === m.id);
  return (
    <section className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200 ring-inset">
      <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
        <ShieldAlert className="size-4" aria-hidden="true" /> Signalen (enkel zichtbaar voor coördinatoren)
      </p>
      {signals.length === 0 ? (
        <p className="mt-1 text-sm text-gray-600">Geen signalen bij dit moment.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {signals.map((s) => (
            <li key={s.id} data-focus={`signal:${s.id}`} className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-gray-200">
              <span className="font-semibold text-gray-900">{s.kind}</span>
              <span className="text-gray-600"> · {s.anonymous ? 'anoniem' : s.fromOrg} · {fmtRelative(s.createdAt)}</span>
              {s.resolved && <span className="ml-1 text-brand-800">· opgevolgd</span>}
              {s.note && <p className="mt-0.5 text-gray-800">{s.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
