import { useMemo, useState } from 'react';
import { Clock, Eye, Handshake, Search, SlidersHorizontal, Star, X } from 'lucide-react';
import { FOCUSES, MOMENT_TYPES, TARGET_GROUPS, type FieldDef, type Moment } from '../types';
import { countAdvancedFilters, EMPTY_FILTERS, hasAnyFilter, orgsOf, type Filters } from '../lib/moments';
import { fmtMonthTitle, monthKey, monthsBetween, TIMELINE_END, TIMELINE_START } from '../lib/dates';

const MONTH_OPTIONS = monthsBetween(monthKey(TIMELINE_START), monthKey(TIMELINE_END));

export function FilterBar({
  filters,
  setFilters,
  moments,
  fieldDefs,
  limited,
  showPastToggle,
  resultLabel,
}: {
  filters: Filters;
  setFilters: React.Dispatch<React.SetStateAction<Filters>>;
  moments: Moment[];
  fieldDefs: FieldDef[];
  limited: boolean;
  showPastToggle: boolean;
  resultLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((prev) => ({ ...prev, [k]: v }));
  const advancedCount = countAdvancedFilters(filters);

  const regions = useMemo(() => Array.from(new Set(moments.map((m) => m.region).filter(Boolean))).sort(), [moments]);
  const organisers = useMemo(
    () => Array.from(new Set(moments.flatMap(orgsOf))).sort((a, b) => a.localeCompare(b, 'nl')),
    [moments],
  );
  const filterableFields = fieldDefs.filter((d) => d.type !== 'text');

  const chip = (on: boolean, onClick: () => void, icon: React.ReactNode, label: string) => (
    <button type="button" className={on ? 'chip-on' : 'chip-off'} aria-pressed={on} onClick={onClick}>
      {icon}
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
          <label htmlFor="filter-q" className="sr-only">
            Zoeken
          </label>
          <input
            id="filter-q"
            type="search"
            className="input pl-9"
            placeholder={limited ? 'Zoek op titel…' : 'Zoek op titel, organisator, beschrijving…'}
            value={filters.q}
            onChange={(e) => set('q', e.target.value)}
          />
        </div>
        <button
          type="button"
          className={`btn-secondary relative ${open ? 'border-brand-600! bg-brand-50! text-brand-800!' : ''}`}
          aria-expanded={open}
          aria-controls="filter-panel"
          onClick={() => setOpen((o) => !o)}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Filters</span>
          {advancedCount > 0 && (
            <span className="rounded-full bg-brand-700 px-1.5 text-xs leading-5 text-white">{advancedCount}</span>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {chip(filters.nowOnly, () => set('nowOnly', !filters.nowOnly), <Clock className="size-4" aria-hidden="true" />, 'Nu bezig')}
        {!limited &&
          chip(
            filters.seeksPartners,
            () => set('seeksPartners', !filters.seeksPartners),
            <Handshake className="size-4" aria-hidden="true" />,
            'Zoekt partners',
          )}
        {!limited &&
          chip(filters.featured, () => set('featured', !filters.featured), <Star className="size-4" aria-hidden="true" />, 'Uitgelicht')}
        {showPastToggle &&
          chip(filters.showPast, () => set('showPast', !filters.showPast), <Eye className="size-4" aria-hidden="true" />, 'Toon voorbije')}
        {hasAnyFilter(filters) && (
          <button
            type="button"
            className="chip border-transparent text-brand-800 underline-offset-2 hover:underline"
            onClick={() => setFilters((prev) => ({ ...EMPTY_FILTERS, showPast: prev.showPast }))}
          >
            <X className="size-4" aria-hidden="true" />
            Wis filters
          </button>
        )}
      </div>

      {open && (
        <div id="filter-panel" className="card anim-fade-in bg-gray-50 p-4">
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
            <Select label="Vanaf maand" value={filters.fromMonth} onChange={(v) => set('fromMonth', v)} allLabel="Begin">
              {MONTH_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {fmtMonthTitle(k)}
                </option>
              ))}
            </Select>
            <Select label="Tot en met maand" value={filters.toMonth} onChange={(v) => set('toMonth', v)} allLabel="Einde">
              {MONTH_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {fmtMonthTitle(k)}
                </option>
              ))}
            </Select>
            {!limited && (
              <>
                <Select label="Type" value={filters.type} onChange={(v) => set('type', v)}>
                  {MOMENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                <Select label="Doelgroep" value={filters.targetGroup} onChange={(v) => set('targetGroup', v)}>
                  {TARGET_GROUPS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                <Select label="Focus" value={filters.focus} onChange={(v) => set('focus', v)}>
                  {FOCUSES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </Select>
                <Select label="Gratis of betalend" value={filters.free} onChange={(v) => set('free', v as Filters['free'])}>
                  <option value="free">Gratis</option>
                  <option value="paid">Betalend</option>
                </Select>
                <Select label="Regio" value={filters.region} onChange={(v) => set('region', v)}>
                  {regions.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
                <Select label="Organisator" value={filters.organiser} onChange={(v) => set('organiser', v)}>
                  {organisers.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </Select>
                {filterableFields.map((d) => (
                  <Select
                    key={d.id}
                    label={d.name}
                    value={filters.custom[d.id] ?? ''}
                    onChange={(v) => setFilters((prev) => ({ ...prev, custom: { ...prev.custom, [d.id]: v } }))}
                  >
                    {d.type === 'yesno' ? (
                      <>
                        <option value="ja">Ja</option>
                        <option value="nee">Nee</option>
                      </>
                    ) : (
                      d.options.map((o) => <option key={o}>{o}</option>)
                    )}
                  </Select>
                ))}
              </>
            )}
          </div>
          {limited && (
            <p className="mt-3 text-sm text-gray-600">Log in om ook te filteren op type, doelgroep, organisator en meer.</p>
          )}
        </div>
      )}

      <p className="text-sm text-gray-600" aria-live="polite">
        {resultLabel}
      </p>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
  allLabel = 'Alle',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  allLabel?: string;
}) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select id={id} className={`select ${value ? 'border-brand-600! bg-brand-50!' : ''}`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allLabel}</option>
        {children}
      </select>
    </div>
  );
}
