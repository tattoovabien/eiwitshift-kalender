import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from './store';
import { getRole, isForMe } from './roles';
import type { RoleId } from './types';
import { EMPTY_FILTERS, isPast, matchesFilters, type Filters } from './lib/moments';
import { todayISO } from './lib/dates';
import { DemoBanner, Header, type View } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { ListView } from './components/ListView';
import { TimelineView } from './components/TimelineView';
import { DetailPanel } from './components/DetailPanel';
import { MomentForm } from './components/MomentForm';
import { NotificationEmailModal, NotificationsPanel } from './components/Notifications';
import { Dashboard, type DashTab } from './components/Dashboard';
import { FeedModal } from './components/FeedModal';
import { Modal, useToast } from './components/ui';
import { LoginDialog } from './components/LoginDialog';
import { Hourglass } from 'lucide-react';

// ---------------------------------------------------------------------------
// Tiny hash router: #/overzicht, #/tijdlijn, #/dashboard/matches, plus ?m=<momentId>.
// Works from file:// too, and the browser back button closes the side panel.

interface Route {
  view: View;
  tab: DashTab;
  momentId: string | null;
}

const DASH_TABS: DashTab[] = ['matches', 'signalen', 'velden', 'digest', 'export', 'toegang'];

function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [first, second] = path.split('/');
  const view: View = first === 'tijdlijn' || first === 'dashboard' ? first : 'overzicht';
  const tab = DASH_TABS.includes(second as DashTab) ? (second as DashTab) : 'matches';
  const momentId = new URLSearchParams(query).get('m');
  return { view, tab, momentId };
}

function toHash(r: Route): string {
  const path = r.view === 'dashboard' ? `dashboard/${r.tab}` : r.view;
  return `#/${path}${r.momentId ? `?m=${encodeURIComponent(r.momentId)}` : ''}`;
}

function useHashRoute(): [Route, (r: Partial<Route>, replace?: boolean) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const navigate = useCallback((patch: Partial<Route>, replace = false) => {
    const next = { ...parseHash(window.location.hash), ...patch };
    const hash = toHash(next);
    if (hash === window.location.hash) return;
    if (replace) {
      history.replaceState(null, '', hash);
      setRoute(next);
    } else {
      window.location.hash = hash;
    }
  }, []);
  return [route, navigate];
}

// ---------------------------------------------------------------------------

export default function App() {
  const { state, dispatch, role, live } = useStore();
  const toast = useToast();
  const [route, navigate] = useHashRoute();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [form, setForm] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null });
  const [feedOpen, setFeedOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const today = todayISO();
  const limited = role.id === 'anon';
  const isCoordinator = role.id === 'coordinator';

  // Keep --header-h in sync so sticky month headings sit right below the header.
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const set = () => document.documentElement.style.setProperty('--header-h', `${header.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // The dashboard is for coordinators only.
  useEffect(() => {
    if (route.view === 'dashboard' && !isCoordinator) navigate({ view: 'overzicht' }, true);
  }, [route.view, isCoordinator, navigate]);

  const filtered = useMemo(
    () =>
      state.moments.filter((m) => {
        if (!matchesFilters(m, filters, { today, fieldDefs: state.fieldDefs, limited })) return false;
        // The timeline always shows its whole range; the list hides past moments unless asked.
        if (route.view === 'overzicht' && !filters.showPast && isPast(m, today)) return false;
        return true;
      }),
    [state.moments, state.fieldDefs, filters, today, limited, route.view],
  );

  const hiddenPast = useMemo(
    () =>
      route.view === 'overzicht' && !filters.showPast
        ? state.moments.filter(
            (m) => isPast(m, today) && matchesFilters(m, filters, { today, fieldDefs: state.fieldDefs, limited }),
          ).length
        : 0,
    [state.moments, state.fieldDefs, filters, today, limited, route.view],
  );

  const resultLabel =
    `${filtered.length} ${filtered.length === 1 ? 'moment' : 'momenten'}` +
    (hiddenPast ? ` · ${hiddenPast} ${hiddenPast === 1 ? 'voorbij moment' : 'voorbije momenten'} verborgen` : '');

  const unread = state.notifications.filter((n) => isForMe(n, role) && !n.read).length;

  const openMoment = useCallback((id: string) => navigate({ momentId: id }), [navigate]);
  const closeMoment = useCallback(() => navigate({ momentId: null }, true), [navigate]);

  const changeRole = (r: RoleId) => {
    dispatch({ type: 'setRole', role: r });
    setNotifOpen(false);
    setPreviewId(null);
    const next = getRole(r);
    toast(r === 'anon' ? 'Je bekijkt de kalender nu zonder in te loggen' : `Je bekijkt de kalender nu als ${next.label.replace('Partner: ', '')}`, 'info');
  };

  const openPreview = (id: string) => {
    dispatch({ type: 'markRead', id });
    setNotifOpen(false);
    setPreviewId(id);
  };

  const main = (() => {
    if (route.view === 'dashboard' && isCoordinator) {
      return <Dashboard tab={route.tab} onTab={(t) => navigate({ tab: t }, true)} onOpen={openMoment} />;
    }
    const isList = route.view === 'overzicht';
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{isList ? 'Communicatiekalender' : 'Tijdlijn'}</h1>
          <p className="mt-1 max-w-3xl text-gray-700">
            {isList
              ? 'Campagnes, events en publicaties van de partners van de Green Deal Eiwitshift. Zie wat eraan komt, haak aan of verspreid mee.'
              : 'September 2026 tot december 2027. Elke balk is een moment: zo zie je in één oogopslag waar campagnes overlappen.'}
          </p>
        </div>
        <FilterBar
          filters={filters}
          setFilters={setFilters}
          moments={state.moments}
          fieldDefs={state.fieldDefs}
          limited={limited}
          showPastToggle={isList}
          resultLabel={resultLabel}
        />
        {isList ? (
          <ListView
            moments={filtered}
            filters={filters}
            onOpen={openMoment}
            onClearFilters={() => setFilters({ ...EMPTY_FILTERS, showPast: true })}
          />
        ) : (
          <TimelineView moments={filtered} onOpen={openMoment} />
        )}
      </div>
    );
  })();

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main')?.focus();
        }}
      >
        Naar de inhoud
      </a>
      <DemoBanner onReset={() => setConfirmReset(true)} />
      <Header
        view={route.view}
        onNavigate={(v) => navigate({ view: v, momentId: null })}
        onAdd={() => setForm({ open: true, editId: null })}
        onOpenFeed={() => setFeedOpen(true)}
        onToggleNotifications={() => setNotifOpen((o) => !o)}
        unread={unread}
        notificationsOpen={notifOpen}
        onRoleChange={changeRole}
      />

      {live?.profile && live.profile.status !== 'active' && (
        <div className="border-b border-amber-200 bg-amber-50">
          <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-3 text-sm text-amber-950">
            <Hourglass className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {live.profile.status === 'pending'
              ? 'Je aanvraag is verstuurd. Zodra een coördinator ze goedkeurt, zie je hier alle details (dat gebeurt automatisch, je hoeft niet te herladen).'
              : 'Je hebt (nog) geen toegang tot de details van de kalender. Neem contact op met de coördinatoren.'}
          </p>
        </div>
      )}

      <main id="main" tabIndex={-1} className={`mx-auto w-full flex-1 px-4 py-6 outline-none sm:py-8 ${route.view === 'overzicht' ? 'max-w-5xl' : 'max-w-7xl'}`}>
        {main}
      </main>

      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-5 text-sm text-gray-600">
          Prototype van een gedeelde communicatiekalender voor de partners van de Green Deal Eiwitshift. Alle gegevens zijn
          demodata en blijven in deze browser; er wordt niets verstuurd.
        </div>
      </footer>

      <NotificationsPanel open={notifOpen} onClose={() => setNotifOpen(false)} onPreview={openPreview} />
      <NotificationEmailModal
        notificationId={previewId}
        onClose={() => setPreviewId(null)}
        onOpenAccess={() => {
          setPreviewId(null);
          navigate({ view: 'dashboard', tab: 'toegang', momentId: null });
        }}
        onOpenMoment={(id) => {
          setPreviewId(null);
          openMoment(id);
        }}
      />
      <DetailPanel
        momentId={route.momentId}
        onClose={closeMoment}
        onEdit={(id) => setForm({ open: true, editId: id })}
      />
      <MomentForm
        open={form.open}
        editId={form.editId}
        onClose={() => setForm({ open: false, editId: null })}
        onSaved={(id) => {
          setForm({ open: false, editId: null });
          openMoment(id);
        }}
      />
      <FeedModal open={feedOpen} onClose={() => setFeedOpen(false)} />
      {__LIVE__ && <LoginDialog />}
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Demo terugzetten?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-secondary" onClick={() => setConfirmReset(false)}>
              Annuleren
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                dispatch({ type: 'reset' });
                setConfirmReset(false);
                setFilters(EMPTY_FILTERS);
                navigate({ momentId: null }, true);
                toast('Demodata teruggezet');
              }}
            >
              Reset demo
            </button>
          </>
        }
      >
        <p className="text-gray-800">
          Alle wijzigingen (nieuwe momenten, reacties, opmerkingen, velden) worden gewist en de oorspronkelijke demodata komt terug.
        </p>
      </Modal>
    </div>
  );
}
