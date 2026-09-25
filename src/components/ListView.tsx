import { useMemo } from 'react';
import { CalendarClock, Check, Handshake, Lock, MessageSquare, Repeat, Star, Users } from 'lucide-react';
import type { Moment } from '../types';
import { useStore } from '../store';
import {
  byStart,
  effectiveRange,
  isOpenEnded,
  isPast,
  organiserLabel,
  whenLabel,
  type Filters,
} from '../lib/moments';
import {
  dayOfMonth,
  fmtMonthAbbr,
  fmtMonthTitle,
  fmtShort,
  fmtWeekday,
  monthKey,
  monthsBetween,
  todayISO,
} from '../lib/dates';
import { TYPE_STYLE, TypeBadge } from './ui';

interface Entry {
  m: Moment;
  continued: boolean;
}

interface MonthGroup {
  key: string;
  continuing: Entry[];
  starting: Entry[];
}

function buildGroups(moments: Moment[], f: Filters, today: string) {
  const currentKey = monthKey(today);
  const ongoing: Moment[] = [];
  const groups = new Map<string, MonthGroup>();

  for (const m of moments) {
    if (isOpenEnded(m)) {
      ongoing.push(m);
      continue;
    }
    const [s, e] = effectiveRange(m);
    let from = monthKey(s);
    let to = monthKey(e);
    if (f.fromMonth && from < f.fromMonth) from = f.fromMonth;
    if (f.toMonth && to > f.toMonth) to = f.toMonth;
    if (!f.showPast && from < currentKey && !isPast(m, today)) from = currentKey;
    if (f.nowOnly) from = to = currentKey;
    for (const k of monthsBetween(from, to)) {
      const continued = k > monthKey(s);
      const g = groups.get(k) ?? { key: k, continuing: [], starting: [] };
      (continued ? g.continuing : g.starting).push({ m, continued });
      groups.set(k, g);
    }
  }
  const sorted = [...groups.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const g of sorted) {
    g.starting.sort((a, b) => byStart(a.m, b.m));
    g.continuing.sort((a, b) => (effectiveRange(a.m)[1] < effectiveRange(b.m)[1] ? -1 : 1));
  }
  ongoing.sort(byStart);
  return { ongoing, groups: sorted };
}

export function ListView({
  moments,
  filters,
  onOpen,
  onClearFilters,
}: {
  moments: Moment[];
  filters: Filters;
  onOpen: (id: string) => void;
  onClearFilters: () => void;
}) {
  const { state, role, live } = useStore();
  const today = todayISO();
  const limited = role.id === 'anon';
  const { ongoing, groups } = useMemo(() => buildGroups(moments, filters, today), [moments, filters, today]);

  const stats = useMemo(() => {
    const map = new Map<string, { reactions: number; comments: number; mine: boolean }>();
    for (const m of moments) map.set(m.id, { reactions: 0, comments: 0, mine: false });
    for (const r of state.reactions) {
      const s = map.get(r.momentId);
      if (!s) continue;
      s.reactions++;
      if (r.org === role.org) s.mine = true;
    }
    for (const c of state.comments) {
      const s = map.get(c.momentId);
      if (s) s.comments++;
    }
    return map;
  }, [moments, state.reactions, state.comments, role.org]);

  if (!ongoing.length && !groups.length) {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <CalendarClock className="size-10 text-gray-400" aria-hidden="true" />
        <p className="mt-3 text-base font-semibold text-gray-900">Geen momenten gevonden</p>
        <p className="mt-1 text-sm text-gray-600">Pas je filters aan of toon ook de voorbije momenten.</p>
        <button type="button" className="btn-secondary mt-4" onClick={onClearFilters}>
          Wis filters
        </button>
      </div>
    );
  }

  const card = (e: Entry) => (
    <MomentCard
      key={`${e.m.id}-${e.continued}`}
      m={e.m}
      limited={limited}
      past={isPast(e.m, today)}
      stats={stats.get(e.m.id)}
      onOpen={() => onOpen(e.m.id)}
    />
  );

  return (
    <div className="space-y-8">
      {limited && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700 ring-1 ring-gray-200 ring-inset">
          <p className="flex flex-1 items-start gap-2">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Je bent niet ingelogd: je ziet enkel titels en data. Log in als partner om details, contactinfo en reacties te zien.
          </p>
          {live && !live.email && (
            <button type="button" className="btn-primary" onClick={() => live.setLoginOpen(true)}>
              Inloggen
            </button>
          )}
        </div>
      )}

      {ongoing.length > 0 && (
        <section aria-labelledby="grp-ongoing">
          <MonthHeading id="grp-ongoing" title="Doorlopend" count={ongoing.length} hint="zonder einddatum" />
          <div className="grid gap-3">{ongoing.map((m) => card({ m, continued: false }))}</div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.key} aria-labelledby={`grp-${g.key}`}>
          <MonthHeading
            id={`grp-${g.key}`}
            title={fmtMonthTitle(g.key)}
            count={g.starting.length + g.continuing.length}
            current={g.key === monthKey(today)}
          />
          {g.continuing.length > 0 && (
            <ul className="mb-3 grid gap-2">
              {g.continuing.map((e) => (
                <li key={e.m.id}>
                  <ContinuationRow m={e.m} limited={limited} onOpen={() => onOpen(e.m.id)} />
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3">{g.starting.map(card)}</div>
        </section>
      ))}
    </div>
  );
}

function MonthHeading({
  id,
  title,
  count,
  hint,
  current,
}: {
  id: string;
  title: string;
  count: number;
  hint?: string;
  current?: boolean;
}) {
  return (
    <div className="sticky top-[var(--header-h,64px)] z-10 -mx-4 mb-3 flex items-baseline gap-2 bg-white/95 px-4 py-2 backdrop-blur">
      <h2 id={id} className="text-lg font-bold text-gray-900">
        {title}
      </h2>
      {current && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">deze maand</span>}
      <span className="text-sm text-gray-600">
        {count} {count === 1 ? 'moment' : 'momenten'}
        {hint ? ` · ${hint}` : ''}
      </span>
    </div>
  );
}

function ContinuationRow({ m, limited, onOpen }: { m: Moment; limited: boolean; onOpen: () => void }) {
  const end = effectiveRange(m)[1];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-left hover:border-brand-600 hover:bg-brand-50"
    >
      <Repeat className="size-4 shrink-0 text-gray-500" aria-hidden="true" />
      <span className={`size-2.5 shrink-0 rounded-full ${TYPE_STYLE[m.type].dot}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="font-semibold text-gray-900">{m.title}</span>
        {!limited && <span className="text-sm text-gray-600"> · {m.organiser}</span>}
      </span>
      <span className="shrink-0 rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
        loopt nog tot {fmtShort(end)}
      </span>
    </button>
  );
}

function DateBlock({ m }: { m: Moment }) {
  const [s, e] = effectiveRange(m);
  let top: string;
  let big: string;
  let bottom: string;
  if (m.dateUnsure) {
    top = fmtMonthAbbr(monthKey(s));
    big = '?';
    bottom = 'nog niet vast';
  } else if (isOpenEnded(m)) {
    top = '';
    big = '∞';
    bottom = 'loopt door';
  } else if (s !== e) {
    top = fmtMonthAbbr(monthKey(s));
    big = String(dayOfMonth(s));
    bottom = `t/m ${fmtShort(e)}`;
  } else {
    top = fmtMonthAbbr(monthKey(s));
    big = String(dayOfMonth(s));
    bottom = fmtWeekday(s);
  }
  return (
    <div
      className={`flex w-[4.25rem] shrink-0 flex-col items-center justify-center rounded-lg px-1 py-2 text-center ${
        m.dateUnsure ? 'border border-dashed border-gray-400 bg-white' : 'bg-gray-100'
      }`}
      aria-hidden="true"
    >
      <span className="text-[11px] leading-tight font-semibold text-gray-600 uppercase">{top}</span>
      <span className="text-2xl leading-tight font-bold text-gray-900">{big}</span>
      <span className="text-[11px] leading-tight text-gray-600">{bottom}</span>
    </div>
  );
}

function MomentCard({
  m,
  limited,
  past,
  stats,
  onOpen,
}: {
  m: Moment;
  limited: boolean;
  past: boolean;
  stats?: { reactions: number; comments: number; mine: boolean };
  onOpen: () => void;
}) {
  // The whole card is clickable via the stretched title button (valid, accessible markup).
  return (
    <article
      className={`card group relative flex w-full gap-3 p-3 transition-shadow has-[button:focus-visible]:ring-3 has-[button:focus-visible]:ring-brand-600 has-[button:focus-visible]:ring-offset-2 hover:border-brand-600 hover:shadow-md sm:gap-4 sm:p-4 ${
        m.featured && !limited ? 'border-brand-300 bg-brand-50/40' : ''
      } ${past ? 'opacity-70' : ''}`}
    >
      <DateBlock m={m} />
      <div className="min-w-0 flex-1">
        {!limited && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <TypeBadge type={m.type} />
            {m.featured && (
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-2 py-0.5 text-xs font-semibold text-white">
                <Star className="size-3" aria-hidden="true" /> Uitgelicht
              </span>
            )}
            {m.need?.trim() && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ring-1 ring-amber-200 ring-inset">
                <Handshake className="size-3" aria-hidden="true" /> Zoekt partners
              </span>
            )}
            {past && <span className="rounded-md bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-700">Voorbij</span>}
          </div>
        )}
        <h3 className="text-base leading-snug font-semibold text-gray-900 group-hover:text-brand-800">
          <button
            type="button"
            onClick={onOpen}
            className="text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none"
          >
            {m.title}
          </button>
        </h3>
        <p className="mt-0.5 text-sm text-gray-700">
          {whenLabel(m)}
          {!limited && <> · {organiserLabel(m)}</>}
        </p>
        {!limited && (
          <>
            <p className="text-sm text-gray-600">
              {m.targetGroup} · {m.region} · {m.focus}
              {!m.free && ' · betalend'}
            </p>
            {m.need?.trim() && <p className="mt-1.5 line-clamp-2 text-sm text-amber-900">“{m.need}”</p>}
            {stats && (stats.reactions > 0 || stats.comments > 0 || stats.mine) && (
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                {stats.reactions > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-4" aria-hidden="true" />
                    {stats.reactions} {stats.reactions === 1 ? 'partner doet mee' : 'partners doen mee'}
                  </span>
                )}
                {stats.comments > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="size-4" aria-hidden="true" />
                    {stats.comments}
                  </span>
                )}
                {stats.mine && (
                  <span className="inline-flex items-center gap-1 font-semibold text-brand-800">
                    <Check className="size-4" aria-hidden="true" /> Jouw organisatie doet mee
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </article>
  );
}
