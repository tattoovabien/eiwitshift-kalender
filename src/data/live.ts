// All reads and writes of the live version. The database's access rules decide what each
// user may do; these functions just translate app actions into Supabase calls.
import type { Action } from '../store';
import type { AppState, Profile } from '../types';
import type { PrefillResult } from '../lib/prefill';
import { sb } from '../lib/supabase';
import { STATE_VERSION } from '../seed';
import {
  commentFromRow,
  fieldDefFromRow,
  fieldDefToRow,
  momentFromRow,
  momentToRow,
  notificationFromRow,
  profileFromRow,
  publicMomentFromRow,
  reactionFromRow,
  signalFromRow,
} from './mappers';

export class NoRightsError extends Error {
  constructor() {
    super('Je hebt geen rechten om dit te wijzigen.');
  }
}

type Result = { data: unknown; error: { message: string } | null };

function must<T = unknown>(res: Result): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** For updates/deletes: the access rules silently skip rows you may not touch, so check that something changed. */
function mustChange(res: Result) {
  const rows = must<unknown[]>(res);
  if (!rows || rows.length === 0) throw new NoRightsError();
}

export function emptyState(): AppState {
  return { version: STATE_VERSION, role: 'anon', moments: [], reactions: [], comments: [], signals: [], notifications: [], fieldDefs: [] };
}

/** Everything a logged-in partner may see. Signals only come back for coordinators. */
export async function fetchAll(isCoordinator: boolean): Promise<AppState> {
  const [moments, reactions, comments, signals, notifications, fieldDefs] = await Promise.all([
    sb().from('moments').select('*'),
    sb().from('reactions').select('*').order('created_at'),
    sb().from('comments').select('*').order('created_at'),
    isCoordinator
      ? sb().from('signals').select('*').order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    sb().from('notifications').select('*').order('created_at', { ascending: false }).limit(300),
    sb().from('field_defs').select('*').order('created_at'),
  ]);
  return {
    ...emptyState(),
    moments: must<Record<string, unknown>[]>(moments).map(momentFromRow),
    reactions: must<Record<string, unknown>[]>(reactions).map(reactionFromRow),
    comments: must<Record<string, unknown>[]>(comments).map(commentFromRow),
    signals: must<Record<string, unknown>[]>(signals).map(signalFromRow),
    notifications: must<Record<string, unknown>[]>(notifications).map(notificationFromRow),
    fieldDefs: must<Record<string, unknown>[]>(fieldDefs).map(fieldDefFromRow),
  };
}

/** Visitors who are not logged in: titles and dates only. */
export async function fetchPublic(): Promise<AppState> {
  const res = await sb().from('public_moments').select('*');
  return { ...emptyState(), moments: must<Record<string, unknown>[]>(res).map(publicMomentFromRow) };
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const res = await sb().from('profiles').select('*').eq('user_id', userId).maybeSingle();
  const row = must<Record<string, unknown> | null>(res);
  return row ? profileFromRow(row) : null;
}

/** Make sure an organisation exists (coordinators only; others get an error from the database). */
export async function ensureOrganisation(name: string) {
  must(await sb().from('organisations').upsert({ name }, { onConflict: 'name', ignoreDuplicates: true }));
}

export async function saveOwnProfile(userId: string, patch: { name?: string; requestedOrg?: string; org?: string }, isCoordinator: boolean) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.requestedOrg !== undefined) row.requested_org = patch.requestedOrg;
  if (patch.org !== undefined && isCoordinator) {
    await ensureOrganisation(patch.org);
    row.org = patch.org;
  }
  mustChange(await sb().from('profiles').update(row).eq('user_id', userId).select('user_id'));
}

/** Apply one app action to the database. `prev` is the state before the optimistic update. */
export async function applyRemote(action: Action, prev: AppState): Promise<void> {
  const reaction = (id: string) => prev.reactions.find((r) => r.id === id);

  switch (action.type) {
    case 'saveMoment': {
      const row = momentToRow(action.moment);
      if (action.isNew) must(await sb().from('moments').insert(row));
      else mustChange(await sb().from('moments').update(row).eq('id', action.moment.id).select('id'));
      return;
    }
    case 'deleteMoment':
      mustChange(await sb().from('moments').delete().eq('id', action.id).select('id'));
      return;
    case 'addReaction':
      must(await sb().from('reactions').insert({ id: action.id, moment_id: action.momentId, kind: action.kind }));
      return;
    case 'removeReaction': {
      // Match on moment + organisation + kind, so it also works right after an optimistic insert.
      const r = reaction(action.id);
      if (!r) return;
      mustChange(
        await sb().from('reactions').delete().eq('moment_id', r.momentId).eq('org', r.org).eq('kind', r.kind).select('id'),
      );
      return;
    }
    case 'setReactionNote':
    case 'toggleContact': {
      const r = reaction(action.id);
      if (!r) return;
      const patch = action.type === 'setReactionNote' ? { note: action.note || null } : { in_contact: !r.inContact };
      mustChange(
        await sb().from('reactions').update(patch).eq('moment_id', r.momentId).eq('org', r.org).eq('kind', r.kind).select('id'),
      );
      return;
    }
    case 'addComment':
      must(await sb().from('comments').insert({ id: action.id, moment_id: action.momentId, text: action.text }));
      return;
    case 'addSignal':
      // No .select() afterwards: partners are not allowed to read signals back.
      must(
        await sb()
          .from('signals')
          .insert({ id: action.id, moment_id: action.momentId, kind: action.kind, note: action.note || null, anonymous: action.anonymous }),
      );
      return;
    case 'toggleSignalResolved': {
      const s = prev.signals.find((x) => x.id === action.id);
      if (!s) return;
      mustChange(await sb().from('signals').update({ resolved: !s.resolved }).eq('id', action.id).select('id'));
      return;
    }
    case 'markRead':
      must(await sb().from('notifications').update({ read: true }).eq('id', action.id));
      return;
    case 'markAllRead':
      // The access rules limit this to your own notifications.
      must(await sb().from('notifications').update({ read: true }).eq('read', false));
      return;
    case 'addField':
      must(await sb().from('field_defs').insert(fieldDefToRow(action.def)));
      return;
    case 'updateField':
      mustChange(await sb().from('field_defs').update(fieldDefToRow(action.def)).eq('id', action.def.id).select('id'));
      return;
    case 'removeField':
      must(await sb().rpc('remove_field', { field_id: action.id }));
      return;
    case 'setRole':
    case 'reset':
      return; // demo-only actions
  }
}

// ---------------------------------------------------------------------------
// Access management (Dashboard → Toegang, coordinators only)

export interface AccessRule {
  pattern: string;
  org: string;
  isCoordinator: boolean;
}

export async function fetchAccessData() {
  const [profiles, rules, orgs] = await Promise.all([
    sb().from('profiles').select('*').order('created_at', { ascending: false }),
    sb().from('access_rules').select('*').order('pattern'),
    sb().from('organisations').select('name').order('name'),
  ]);
  return {
    profiles: must<Record<string, unknown>[]>(profiles).map(profileFromRow),
    rules: must<{ pattern: string; org: string; is_coordinator: boolean }[]>(rules).map((r) => ({
      pattern: r.pattern,
      org: r.org,
      isCoordinator: r.is_coordinator,
    })),
    organisations: must<{ name: string }[]>(orgs).map((o) => o.name),
  };
}

export async function updateProfileAsCoordinator(
  userId: string,
  patch: { org?: string; status?: Profile['status']; isCoordinator?: boolean },
) {
  if (patch.org) await ensureOrganisation(patch.org);
  const row: Record<string, unknown> = {};
  if (patch.org !== undefined) row.org = patch.org;
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.isCoordinator !== undefined) row.is_coordinator = patch.isCoordinator;
  mustChange(await sb().from('profiles').update(row).eq('user_id', userId).select('user_id'));
}

export async function addAccessRule(rule: AccessRule) {
  await ensureOrganisation(rule.org);
  must(
    await sb()
      .from('access_rules')
      .upsert({ pattern: rule.pattern.trim().toLowerCase(), org: rule.org, is_coordinator: rule.isCoordinator }),
  );
}

export async function removeAccessRule(pattern: string) {
  mustChange(await sb().from('access_rules').delete().eq('pattern', pattern).select('pattern'));
}

export interface ReadLinkResponse {
  ok: boolean;
  /** "ai": read by an AI model; "page": from the page's own data (no AI key set, or AI unavailable). */
  source?: 'ai' | 'page';
  provider?: 'anthropic' | 'gemini';
  aiError?: boolean;
  result?: PrefillResult;
  reason?: string;
  message?: string;
}

/** "Plak een link": the read-link edge function fetches and reads the page. */
export async function readLinkRemote(url: string): Promise<ReadLinkResponse> {
  const { data, error } = await sb().functions.invoke('read-link', { body: { url } });
  if (error) {
    // Non-2xx answers still carry a useful JSON message.
    const context = (error as { context?: Response }).context;
    try {
      return (await context!.json()) as ReadLinkResponse;
    } catch {
      throw new Error(error.message);
    }
  }
  return data as ReadLinkResponse;
}

/** Sends the monthly digest to every active user now (edge function, coordinators only). */
export async function sendDigestNow(): Promise<number> {
  const { data, error } = await sb().functions.invoke('digest', { body: {} });
  if (error) throw new Error(error.message);
  return (data as { sent: number }).sent;
}
