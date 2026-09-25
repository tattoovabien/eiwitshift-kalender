import { useEffect, useRef } from 'react';
import { Bell, Handshake, Inbox, Mail, MessageSquare, Plus, ShieldAlert, UserPlus } from 'lucide-react';
import type { AppNotification } from '../types';
import { useStore } from '../store';
import { COORDINATOR_ORG, isForMe } from '../roles';
import { fmtRelative } from '../lib/dates';
import { notificationEmail, notificationLine, notificationTitle } from '../lib/emails';
import { EmailPreview } from './EmailPreview';
import { Modal, SimNote } from './ui';

const ICONS = {
  reaction: Handshake,
  comment: MessageSquare,
  new_moment: Plus,
  signal: ShieldAlert,
  access_request: UserPlus,
};

export function NotificationsPanel({
  open,
  onClose,
  onPreview,
}: {
  open: boolean;
  onClose: () => void;
  onPreview: (id: string) => void;
}) {
  const { state, dispatch, role, live } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const list = state.notifications
    .filter((n) => isForMe(n, role))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const unread = list.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current?.contains(t) || t.closest('[data-bell]')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Meldingen"
      className="anim-pop-in fixed inset-x-2 top-[calc(var(--header-h,64px)+4px)] z-40 flex max-h-[75dvh] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:inset-x-auto sm:right-4 sm:w-[26rem]"
    >
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
        <div>
          <h2 className="font-bold text-gray-900">Meldingen</h2>
          <p className="text-xs text-gray-600">
            voor {role.org}
            {role.id === 'coordinator' && role.org !== COORDINATOR_ORG && ' en de coördinatoren'}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            className="min-h-10 rounded-lg px-2 text-sm font-semibold text-brand-800 hover:bg-brand-50"
            onClick={() => dispatch({ type: 'markAllRead', role })}
          >
            Alles gelezen
          </button>
        )}
      </div>
      {list.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-10 text-center">
          <Inbox className="size-9 text-gray-400" aria-hidden="true" />
          <p className="mt-2 font-semibold text-gray-900">Nog geen meldingen</p>
          <p className="mt-1 text-sm text-gray-600">
            Je krijgt hier een melding als een partner aanhaakt of reageert op een moment van jouw organisatie.
          </p>
        </div>
      ) : (
        <ul className="flex-1 divide-y divide-gray-100 overflow-y-auto">
          {list.map((n) => (
            <NotificationRow key={n.id} n={n} onClick={() => onPreview(n.id)} />
          ))}
        </ul>
      )}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600">
        <Mail className="mr-1 inline size-3.5 align-[-2px]" aria-hidden="true" />
        {live
          ? 'Je krijgt elke melding ook per e-mail. Klik op een melding om die e-mail te bekijken.'
          : 'In de echte versie krijg je dit ook per e-mail. Klik op een melding om de e-mail te bekijken.'}
      </div>
    </div>
  );
}

function NotificationRow({ n, onClick }: { n: AppNotification; onClick: () => void }) {
  const { state } = useStore();
  const m = state.moments.find((x) => x.id === n.momentId);
  const Icon = ICONS[n.kind] ?? Bell;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`flex w-full gap-3 px-4 py-3 text-left hover:bg-gray-50 ${n.read ? '' : 'bg-brand-50/50'}`}
      >
        <span
          className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${
            n.kind === 'signal' || n.kind === 'access_request' ? 'bg-amber-100 text-amber-900' : 'bg-brand-100 text-brand-800'
          }`}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${n.read ? 'text-gray-800' : 'font-semibold text-gray-900'}`}>{notificationTitle(n, m)}</span>
          <span className="mt-0.5 line-clamp-2 block text-sm text-gray-600">{notificationLine(n)}</span>
          <span className="mt-0.5 block text-xs text-gray-600">{fmtRelative(n.createdAt)}</span>
        </span>
        {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-brand-600" aria-label="ongelezen" />}
      </button>
    </li>
  );
}

export function NotificationEmailModal({
  notificationId,
  onClose,
  onOpenMoment,
  onOpenAccess,
}: {
  notificationId: string | null;
  onClose: () => void;
  onOpenMoment: (id: string) => void;
  onOpenAccess: () => void;
}) {
  const { state, live } = useStore();
  const n = notificationId ? state.notifications.find((x) => x.id === notificationId) : undefined;
  const m = n ? state.moments.find((x) => x.id === n.momentId) : undefined;
  return (
    <Modal
      open={!!n}
      onClose={onClose}
      size="lg"
      title="E-mail preview"
      subtitle="Zo ziet de e-mail eruit die bij deze melding hoort."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Sluiten
          </button>
          {m && (
            <button type="button" className="btn-primary" onClick={() => onOpenMoment(m.id)}>
              Open moment in de kalender
            </button>
          )}
          {n?.kind === 'access_request' && (
            <button type="button" className="btn-primary" onClick={onOpenAccess}>
              Naar Toegang
            </button>
          )}
        </>
      }
    >
      {n && (
        <div className="space-y-3">
          <EmailPreview email={notificationEmail(n, m)} />
          {!live && <SimNote>Niets wordt echt verstuurd: dit is een voorbeeld van de e-mail in de echte versie.</SimNote>}
        </div>
      )}
    </Modal>
  );
}
