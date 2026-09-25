import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Crosshair } from 'lucide-react';
import { MOMENT_TYPES, type Moment } from '../types';
import { useStore } from '../store';
import { byStart, effectiveRange, isOpenEnded, whenLabel } from '../lib/moments';
import {
  dayOfMonth,
  daysInMonth,
  fmtMonthAbbr,
  monthKey,
  monthsBetween,
  TIMELINE_END,
  TIMELINE_START,
  todayISO,
} from '../lib/dates';
import { TYPE_STYLE } from './ui';

const MONTHS = monthsBetween(monthKey(TIMELINE_START), monthKey(TIMELINE_END));
const ROW_H = 44;

/** Horizontal position of a date, in "month units" (0 = start of first month). */
function pos(iso: string, edge: 'start' | 'end'): number {
  if (iso < TIMELINE_START) return 0;
  if (iso > TIMELINE_END) return MONTHS.length;
  const k = monthKey(iso);
  const i = MONTHS.indexOf(k);
  const d = dayOfMonth(iso) - (edge === 'start' ? 1 : 0);
  return i + d / daysInMonth(k);
}

function useIsNarrow() {
  const [narrow, setNarrow] = useState(() => window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}

export function TimelineView({ moments, onOpen }: { moments: Moment[]; onOpen: (id: string) => void }) {
  const { role } = useStore();
  const limited = role.id === 'anon';
  const scroller = useRef<HTMLDivElement>(null);
  const today = todayISO();
  const narrow = useIsNarrow();
  const monthW = narrow ? 84 : 112;
  const labelW = narrow ? 150 : 280;
  const totalW = MONTHS.length * monthW;

  const rows = useMemo(
    () =>
      moments
        .filter((m) => {
          const [s, e] = effectiveRange(m);
          return e >= TIMELINE_START && s <= TIMELINE_END;
        })
        .sort(byStart),
    [moments],
  );

  const todayX = today >= TIMELINE_START && today <= TIMELINE_END ? pos(today, 'start') * monthW : null;

  // Put "today" about a quarter into the visible bars area (no scroll if it already fits).
  const todayScroll = () => {
    const el = scroller.current;
    if (!el || todayX === null) return 0;
    return Math.max(0, todayX - (el.clientWidth - labelW) * 0.25);
  };
  const scrollToToday = () => scroller.current?.scrollTo({ left: todayScroll(), behavior: 'smooth' });

  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = todayScroll();
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Year labels across the header
  const years = MONTHS.reduce<{ year: string; from: number; span: number }[]>((acc, k, i) => {
    const y = k.slice(0, 4);
    const last = acc[acc.length - 1];
    if (last && last.year === y) last.span++;
    else acc.push({ year: y, from: i, span: 1 });
    return acc;
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-gray-700" aria-label="Legende">
          {MOMENT_TYPES.map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-sm ${TYPE_STYLE[t].bar}`} aria-hidden="true" />
              {t}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <span className="bar-unsure size-3 rounded-sm bg-gray-500" aria-hidden="true" />
            timing nog niet vast
          </li>
        </ul>
        <button type="button" className="btn-secondary" onClick={scrollToToday}>
          <Crosshair className="size-4" aria-hidden="true" />
          Naar vandaag
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-14 text-center">
          <CalendarClock className="size-10 text-gray-400" aria-hidden="true" />
          <p className="mt-3 font-semibold text-gray-900">Geen momenten voor deze filters</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div ref={scroller} className="relative overflow-x-auto overscroll-x-contain" tabIndex={0} aria-label="Tijdlijn, scroll horizontaal">
            <div className="relative" style={{ width: labelW + totalW }}>
              {/* Header */}
              <div className="sticky top-0 z-20 flex border-b border-gray-200 bg-white">
                <div
                  className="sticky left-0 z-30 flex shrink-0 items-end border-r border-gray-200 bg-white px-3 pb-2 text-xs font-semibold text-gray-600"
                  style={{ width: labelW }}
                >
                  {rows.length} momenten
                </div>
                <div className="relative" style={{ width: totalW }}>
                  {todayX !== null && (
                    <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-brand-600" style={{ left: todayX }} aria-hidden="true">
                      <span className="absolute top-1 left-1.5 rounded bg-brand-700 px-1.5 text-[11px] leading-4 font-bold whitespace-nowrap text-white">
                        vandaag
                      </span>
                    </div>
                  )}
                  <div className="flex h-6 border-b border-gray-100">
                    {years.map((y) => (
                      <div
                        key={y.year}
                        className="border-l border-gray-300 px-2 text-xs leading-6 font-bold text-gray-800"
                        style={{ width: y.span * monthW }}
                      >
                        {y.year}
                      </div>
                    ))}
                  </div>
                  <div className="flex h-7">
                    {MONTHS.map((k) => (
                      <div
                        key={k}
                        className={`border-l border-gray-200 px-2 text-xs leading-7 font-semibold capitalize ${
                          k === monthKey(today) ? 'bg-brand-50 text-brand-800' : 'text-gray-600'
                        }`}
                        style={{ width: monthW }}
                      >
                        {fmtMonthAbbr(k).replace('.', '')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="relative">
                {/* Month grid lines + today line */}
                <div className="pointer-events-none absolute inset-y-0 flex" style={{ left: labelW, width: totalW }} aria-hidden="true">
                  {MONTHS.map((k, i) => (
                    <div
                      key={k}
                      className={`h-full border-l ${k.endsWith('-01') ? 'border-gray-300' : 'border-gray-100'} ${
                        i % 2 ? 'bg-gray-50/60' : ''
                      }`}
                      style={{ width: monthW }}
                    />
                  ))}
                  {todayX !== null && <div className="absolute inset-y-0 z-10 w-0.5 bg-brand-600/70" style={{ left: todayX }} />}
                </div>

                <ul>
                  {rows.map((m) => {
                    const [s, e] = effectiveRange(m);
                    const x1 = pos(s, 'start') * monthW;
                    const x2 = pos(e, 'end') * monthW;
                    const w = Math.max(12, x2 - x1);
                    const openEnd = isOpenEnded(m);
                    const openStart = s < TIMELINE_START;
                    const label = `${m.title} — ${whenLabel(m)}${limited ? '' : ` — ${m.type}`}`;
                    return (
                      <li key={m.id} className="group relative flex border-b border-gray-100 last:border-b-0" style={{ height: ROW_H }}>
                        <button
                          type="button"
                          onClick={() => onOpen(m.id)}
                          className="sticky left-0 z-10 flex shrink-0 flex-col justify-center border-r border-gray-200 bg-white px-3 text-left group-hover:bg-brand-50"
                          style={{ width: labelW }}
                          aria-label={`Open ${label}`}
                        >
                          <span className="line-clamp-1 text-[13px] leading-tight font-semibold text-gray-900 sm:text-sm">{m.title}</span>
                          <span className="line-clamp-1 text-[11px] text-gray-600 sm:text-xs">{whenLabel(m)}</span>
                        </button>
                        <div className="relative" style={{ width: totalW }}>
                          <button
                            type="button"
                            onClick={() => onOpen(m.id)}
                            title={label}
                            aria-label={`Open ${label}`}
                            tabIndex={-1}
                            className={`absolute top-1/2 h-6 -translate-y-1/2 rounded-md shadow-sm ring-1 ring-black/5 transition-transform hover:scale-y-110 hover:ring-2 hover:ring-gray-900/40 ${
                              TYPE_STYLE[m.type].bar
                            } ${m.dateUnsure ? 'bar-unsure opacity-80' : ''} ${openStart ? 'rounded-l-none' : ''} ${
                              openEnd ? 'rounded-r-none' : ''
                            }`}
                            style={{
                              left: x1,
                              width: w,
                              ...(openEnd
                                ? { maskImage: 'linear-gradient(90deg, #000 80%, transparent)', WebkitMaskImage: 'linear-gradient(90deg, #000 80%, transparent)' }
                                : {}),
                            }}
                          >
                            {w > 120 && (
                              <span className="block truncate px-2 text-left text-xs leading-6 font-semibold text-white">{m.title}</span>
                            )}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
      <p className="text-sm text-gray-600">
        Lange balken zijn campagnes die over meerdere maanden lopen; zo zie je meteen waar momenten overlappen. Gestreepte balken
        hebben nog geen vaste datum. Klik op een balk voor details.
      </p>
    </div>
  );
}
