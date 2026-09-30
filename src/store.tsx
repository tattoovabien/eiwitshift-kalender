import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import type {
  AppNotification,
  AppState,
  FieldDef,
  Moment,
  Profile,
  ReactionKind,
  Role,
  RoleId,
  SignalKind,
} from './types';
import { seedState, STATE_VERSION } from './seed';
import { COORDINATOR_ORG, getRole, isForMe } from './roles';
import { orgsOf } from './lib/moments';
import { nowStamp } from './lib/dates';

const STORAGE_KEY = 'eiwitshift-kalender-prototype';

export const REACTION_LABEL: Record<ReactionKind, string> = {
  join: 'Ik haak aan',
  spread: 'Ik kan mee verspreiden',
};

let idCounter = 0;
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}${Math.random().toString(36).slice(2, 6)}`;
}

export type Action =
  | { type: 'setRole'; role: RoleId }
  | { type: 'reset' }
  | { type: 'saveMoment'; moment: Moment; isNew: boolean; byOrg: string }
  | { type: 'deleteMoment'; id: string }
  | { type: 'addReaction'; momentId: string; kind: ReactionKind; org: string; name: string; id?: string }
  | { type: 'removeReaction'; id: string }
  | { type: 'setReactionNote'; id: string; note: string }
  | { type: 'toggleContact'; id: string }
  | { type: 'addComment'; momentId: string; org: string; text: string; id?: string; authorId?: string }
  | { type: 'editComment'; id: string; text: string }
  | { type: 'deleteComment'; id: string }
  | { type: 'addSignal'; momentId: string; kind: SignalKind; note: string; anonymous: boolean; org: string; id?: string }
  | { type: 'toggleSignalResolved'; id: string }
  | { type: 'markRead'; id: string }
  | { type: 'markAllRead'; role: Role }
  | { type: 'addField'; def: FieldDef }
  | { type: 'updateField'; def: FieldDef }
  | { type: 'removeField'; id: string }
  | { type: 'setDigestAuto'; on: boolean };

function notify(
  state: AppState,
  toOrgs: string[],
  n: Omit<AppNotification, 'id' | 'toOrg' | 'createdAt' | 'read'>,
): AppNotification[] {
  const unique = Array.from(new Set(toOrgs.filter((o) => o && o !== n.fromOrg)));
  const created = unique.map((toOrg) => ({
    ...n,
    id: newId('n'),
    toOrg,
    createdAt: nowStamp(),
    read: false,
  }));
  return [...created, ...state.notifications];
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setRole':
      return { ...state, role: action.role };

    case 'reset':
      return { ...seedState(), role: state.role };

    case 'saveMoment': {
      const exists = state.moments.some((m) => m.id === action.moment.id);
      const moments = exists
        ? state.moments.map((m) => (m.id === action.moment.id ? action.moment : m))
        : [...state.moments, action.moment];
      let notifications = state.notifications;
      if (action.isNew && action.byOrg !== COORDINATOR_ORG) {
        notifications = notify(state, [COORDINATOR_ORG], {
          momentId: action.moment.id,
          kind: 'new_moment',
          fromOrg: action.byOrg,
          refId: action.moment.id,
        });
      }
      return { ...state, moments, notifications };
    }

    case 'deleteMoment':
      return {
        ...state,
        moments: state.moments.filter((m) => m.id !== action.id),
        reactions: state.reactions.filter((r) => r.momentId !== action.id),
        comments: state.comments.filter((c) => c.momentId !== action.id),
        signals: state.signals.filter((s) => s.momentId !== action.id),
        notifications: state.notifications.filter((n) => n.momentId !== action.id),
      };

    case 'addReaction': {
      const m = state.moments.find((x) => x.id === action.momentId);
      if (!m) return state;
      const already = state.reactions.some(
        (r) => r.momentId === action.momentId && r.org === action.org && r.kind === action.kind,
      );
      if (already) return state;
      const reaction = {
        id: action.id ?? newId('r'),
        momentId: action.momentId,
        org: action.org,
        name: action.name,
        kind: action.kind,
        inContact: false,
        createdAt: nowStamp(),
      };
      return {
        ...state,
        reactions: [...state.reactions, reaction],
        notifications: notify(state, orgsOf(m), {
          momentId: m.id,
          kind: 'reaction',
          fromOrg: action.org,
          detail: REACTION_LABEL[action.kind],
          refId: reaction.id,
        }),
      };
    }

    case 'removeReaction': {
      const r = state.reactions.find((x) => x.id === action.id);
      if (!r) return state;
      // Withdrawing also withdraws the organiser's notification, if it wasn't read yet.
      const stale = (n: AppNotification) =>
        !n.read &&
        n.kind === 'reaction' &&
        (n.refId ? n.refId === r.id : n.momentId === r.momentId && n.fromOrg === r.org && n.detail === REACTION_LABEL[r.kind]);
      return {
        ...state,
        reactions: state.reactions.filter((x) => x.id !== action.id),
        notifications: state.notifications.filter((n) => !stale(n)),
      };
    }

    case 'setReactionNote':
      return {
        ...state,
        reactions: state.reactions.map((r) => (r.id === action.id ? { ...r, note: action.note || undefined } : r)),
      };

    case 'toggleContact':
      return {
        ...state,
        reactions: state.reactions.map((r) => (r.id === action.id ? { ...r, inContact: !r.inContact } : r)),
      };

    case 'addComment': {
      const m = state.moments.find((x) => x.id === action.momentId);
      if (!m) return state;
      const comment = {
        id: action.id ?? newId('c'),
        momentId: m.id,
        org: action.org,
        text: action.text,
        createdAt: nowStamp(),
        authorId: action.authorId,
      };
      // The organiser is notified, and so is everyone who already took part in the thread.
      const participants = state.comments.filter((c) => c.momentId === m.id).map((c) => c.org);
      return {
        ...state,
        comments: [...state.comments, comment],
        notifications: notify(state, [...orgsOf(m), ...participants], {
          momentId: m.id,
          kind: 'comment',
          fromOrg: action.org,
          detail: action.text,
          refId: comment.id,
        }),
      };
    }

    case 'editComment':
      return {
        ...state,
        comments: state.comments.map((c) => (c.id === action.id ? { ...c, text: action.text, editedAt: nowStamp() } : c)),
        notifications: state.notifications.map((n) =>
          n.kind === 'comment' && n.refId === action.id ? { ...n, detail: action.text } : n,
        ),
      };

    case 'deleteComment':
      return {
        ...state,
        comments: state.comments.filter((c) => c.id !== action.id),
        notifications: state.notifications.filter((n) => !(n.kind === 'comment' && !n.read && n.refId === action.id)),
      };

    case 'addSignal': {
      const signal = {
        id: action.id ?? newId('s'),
        momentId: action.momentId,
        kind: action.kind,
        note: action.note || undefined,
        anonymous: action.anonymous,
        fromOrg: action.org,
        createdAt: nowStamp(),
        resolved: false,
      };
      return {
        ...state,
        signals: [signal, ...state.signals],
        notifications: notify(state, [COORDINATOR_ORG], {
          momentId: action.momentId,
          kind: 'signal',
          fromOrg: action.anonymous ? 'Anoniem' : action.org,
          detail: action.kind,
          refId: signal.id,
        }),
      };
    }

    case 'toggleSignalResolved':
      return {
        ...state,
        signals: state.signals.map((s) => (s.id === action.id ? { ...s, resolved: !s.resolved } : s)),
      };

    case 'markRead':
      return {
        ...state,
        notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)),
      };

    case 'markAllRead':
      return {
        ...state,
        notifications: state.notifications.map((n) => (isForMe(n, action.role) ? { ...n, read: true } : n)),
      };

    case 'addField':
      return { ...state, fieldDefs: [...state.fieldDefs, action.def] };

    case 'updateField':
      return { ...state, fieldDefs: state.fieldDefs.map((d) => (d.id === action.def.id ? action.def : d)) };

    case 'removeField':
      return {
        ...state,
        fieldDefs: state.fieldDefs.filter((d) => d.id !== action.id),
        moments: state.moments.map((m) => {
          if (!(action.id in m.customFields)) return m;
          const customFields = { ...m.customFields };
          delete customFields[action.id];
          return { ...m, customFields };
        }),
      };

    case 'setDigestAuto':
      return { ...state, digestAuto: action.on };
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === STATE_VERSION && Array.isArray(parsed.moments)) return parsed;
    }
  } catch {
    // Storage blocked or corrupt: fall back to the demo data.
  }
  return seedState();
}

/** Extra API that only exists in the live (Supabase) version. */
export interface LiveApi {
  /** E-mail of the logged-in user, or null. */
  email: string | null;
  profile: Profile | null;
  /** First load (session + data) finished. */
  ready: boolean;
  loginOpen: boolean;
  setLoginOpen: (open: boolean) => void;
  signOut: () => Promise<void>;
  reload: () => Promise<void>;
  saveProfile: (patch: { name?: string; requestedOrg?: string; org?: string }) => Promise<void>;
  functionsUrl: string;
}

export interface StoreValue {
  state: AppState;
  dispatch: (action: Action) => void;
  role: Role;
  /** Null in the offline prototype. */
  live: LiveApi | null;
}

export const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode / storage full: the demo still works, it just won't survive a reload.
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch, role: getRole(state.role), live: null }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore outside StoreProvider');
  return ctx;
}
