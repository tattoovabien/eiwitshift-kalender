import { useEffect, useRef, useState } from 'react';
import { Bell, ChartGantt, ChevronDown, LayoutDashboard, Leaf, List, LogIn, LogOut, Plus, RotateCcw, Rss, UserRound } from 'lucide-react';
import { ROLES } from '../roles';
import { useStore } from '../store';
import type { RoleId } from '../types';

export type View = 'overzicht' | 'tijdlijn' | 'dashboard';

export function DemoBanner({ onReset }: { onReset: () => void }) {
  const { live } = useStore();
  if (live) {
    return (
      <div className="border-b border-sky-200 bg-sky-50 text-sky-950">
        <p className="mx-auto max-w-7xl px-4 py-1.5 text-xs font-semibold sm:text-sm">
          Testversie – echte gegevens, e-mails worden echt verstuurd. “Plak een link” is nog gesimuleerd.
        </p>
      </div>
    );
  }
  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-950">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1 text-xs sm:text-sm">
        <p className="font-semibold">Prototype – demodata, niets wordt echt verstuurd</p>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-2 font-semibold underline-offset-2 hover:bg-amber-100 hover:underline"
        >
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Reset demo
        </button>
      </div>
    </div>
  );
}

export function Header({
  view,
  onNavigate,
  onAdd,
  onOpenFeed,
  onToggleNotifications,
  unread,
  notificationsOpen,
  onRoleChange,
}: {
  view: View;
  onNavigate: (v: View) => void;
  onAdd: () => void;
  onOpenFeed: () => void;
  onToggleNotifications: () => void;
  unread: number;
  notificationsOpen: boolean;
  onRoleChange: (r: RoleId) => void;
}) {
  const { role, live } = useStore();
  const isCoordinator = role.id === 'coordinator';
  const loggedIn = role.id !== 'anon';

  const tabs: { id: View; label: string; icon: typeof List }[] = [
    { id: 'overzicht', label: 'Overzicht', icon: List },
    { id: 'tijdlijn', label: 'Tijdlijn', icon: ChartGantt },
    ...(isCoordinator ? [{ id: 'dashboard' as View, label: 'Dashboard', icon: LayoutDashboard }] : []),
  ];

  const tabButtons = (compact: boolean) =>
    tabs.map((t) => {
      const active = view === t.id;
      return (
        <button
          key={t.id}
          type="button"
          onClick={() => onNavigate(t.id)}
          aria-current={active ? 'page' : undefined}
          className={`relative inline-flex min-h-11 items-center gap-2 px-3 text-sm font-semibold transition-colors ${
            compact ? 'flex-1 justify-center' : 'rounded-lg'
          } ${
            active
              ? compact
                ? 'text-brand-800 after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-full after:bg-brand-700'
                : 'bg-brand-50 text-brand-800'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <t.icon className="size-4" aria-hidden="true" />
          {t.label}
        </button>
      );
    });

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4">
        <a href="#/overzicht" className="flex min-w-0 shrink items-center gap-2.5 rounded-lg" onClick={() => onNavigate('overzicht')}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Leaf className="size-5" aria-hidden="true" />
          </span>
          <span className="hidden min-w-0 leading-tight min-[420px]:block md:hidden lg:block">
            <span className="block truncate text-[15px] font-bold text-gray-900">Eiwitshift-kalender</span>
            <span className="block truncate text-xs text-gray-600">Green Deal Eiwitshift · partners</span>
          </span>
        </a>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Hoofdnavigatie">
          {tabButtons(false)}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button type="button" className="icon-btn" onClick={onOpenFeed} aria-label="Agenda-feed" title="Agenda-feed">
            <Rss className="size-5" aria-hidden="true" />
          </button>
          {loggedIn && (
            <button
              type="button"
              className={`icon-btn relative ${notificationsOpen ? 'bg-gray-100' : ''}`}
              onClick={onToggleNotifications}
              aria-label={unread ? `Meldingen, ${unread} ongelezen` : 'Meldingen'}
              aria-expanded={notificationsOpen}
              data-bell
            >
              <Bell className="size-5" aria-hidden="true" />
              {unread > 0 && (
                <span className="absolute top-1.5 right-1.5 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] leading-5 font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          )}
          {live ? (
            <AccountMenu />
          ) : (
            /* Native select for accessibility, with a compact visible label on top. */
            <div className="relative flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white pr-8 pl-3 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-200 hover:bg-gray-50">
              <UserRound className="size-4 shrink-0 text-gray-600" aria-hidden="true" />
              <span className="leading-tight" aria-hidden="true">
                <span className="block text-[11px] font-semibold text-gray-600">Demo-rol</span>
                <span className="block max-w-[7.5rem] truncate text-sm font-bold text-gray-900 sm:max-w-none">{role.short}</span>
              </span>
              <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-gray-600" aria-hidden="true" />
              <label className="sr-only" htmlFor="role-switch">
                Demo-rol
              </label>
              <select
                id="role-switch"
                value={role.id}
                onChange={(e) => onRoleChange(e.target.value as RoleId)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              >
                {ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {loggedIn && (
            <button type="button" className="btn-primary hidden whitespace-nowrap md:inline-flex" onClick={onAdd}>
              <Plus className="size-4" aria-hidden="true" />
              Moment toevoegen
            </button>
          )}
        </div>
      </div>

      <div className="flex items-stretch border-t border-gray-100 md:hidden">
        <nav className="flex flex-1" aria-label="Hoofdnavigatie">
          {tabButtons(true)}
        </nav>
        {loggedIn && (
          <button
            type="button"
            onClick={onAdd}
            className="m-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white hover:bg-brand-800"
            aria-label="Moment toevoegen"
          >
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden min-[400px]:inline">Toevoegen</span>
          </button>
        )}
      </div>
    </header>
  );
}

/** Live version: log in, or show who you are with a log-out option. */
function AccountMenu() {
  const { live, role } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!live) return null;
  if (!live.email) {
    return (
      <button type="button" className="btn-secondary" onClick={() => live.setLoginOpen(true)}>
        <LogIn className="size-4" aria-hidden="true" />
        Inloggen
      </button>
    );
  }
  const p = live.profile;
  const status = p?.status === 'pending' ? 'wacht op goedkeuring' : p?.status === 'blocked' ? 'geen toegang' : role.short;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white pr-8 pl-3 text-left hover:bg-gray-50"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <UserRound className="size-4 shrink-0 text-gray-600" aria-hidden="true" />
        <span className="leading-tight">
          <span className="block max-w-[7.5rem] truncate text-[11px] font-semibold text-gray-600 sm:max-w-[12rem]">
            {p?.name || live.email}
          </span>
          <span className="block max-w-[7.5rem] truncate text-sm font-bold text-gray-900 sm:max-w-[12rem]">{status}</span>
        </span>
        <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-gray-600" aria-hidden="true" />
      </button>
      {open && (
        <div className="anim-pop-in absolute right-0 z-40 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
          <div className="px-2 py-1.5 text-sm">
            <p className="font-semibold text-gray-900">{p?.name || 'Zonder naam'}</p>
            <p className="break-all text-gray-600">{live.email}</p>
            <p className="mt-1 text-gray-700">
              {p?.org ?? p?.requestedOrg ?? '—'}
              {role.id === 'coordinator' && ' · coördinator'}
            </p>
          </div>
          <button
            type="button"
            className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-sm font-semibold text-gray-800 hover:bg-gray-100"
            onClick={() => {
              setOpen(false);
              live.signOut();
            }}
          >
            <LogOut className="size-4" aria-hidden="true" />
            Uitloggen
          </button>
        </div>
      )}
    </div>
  );
}
