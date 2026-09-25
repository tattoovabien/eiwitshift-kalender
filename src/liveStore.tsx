// Live version of the store: same `dispatch(action)` as the prototype, but backed by Supabase.
// Each action is applied optimistically with the prototype's reducer, written to the database,
// and then everything is reloaded (the data set is small). Realtime pushes other people's changes.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AppState, Profile } from './types';
import { reducer, StoreContext, type Action, type LiveApi } from './store';
import { roleFromProfile } from './roles';
import { sb } from './lib/supabase';
import { FUNCTIONS_URL } from './config';
import { applyRemote, emptyState, fetchAll, fetchProfile, fetchPublic, NoRightsError, saveOwnProfile } from './data/live';
import { useToast } from './components/ui';

const TABLES = ['moments', 'reactions', 'comments', 'signals', 'notifications', 'field_defs'];

function withId(action: Action): Action {
  if ((action.type === 'addReaction' || action.type === 'addComment' || action.type === 'addSignal') && !action.id) {
    return { ...action, id: crypto.randomUUID() };
  }
  return action;
}

export function LiveStoreProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<AppState>(emptyState);
  const [ready, setReady] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const role = useMemo(() => roleFromProfile(profile), [profile]);
  const userId = session?.user.id ?? null;
  const active = role.id !== 'anon';
  const isCoordinator = role.id === 'coordinator';

  // --- session
  useEffect(() => {
    sb().auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data } = sb().auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    try {
      setProfile(await fetchProfile(userId));
    } catch (e) {
      toast(`Profiel laden mislukt: ${(e as Error).message}`, 'warning');
    }
  }, [userId, toast]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // --- data
  const reload = useCallback(async () => {
    try {
      setState(active ? await fetchAll(isCoordinator) : await fetchPublic());
    } catch (e) {
      toast(`Gegevens laden mislukt: ${(e as Error).message}`, 'warning');
    }
  }, [active, isCoordinator, toast]);

  useEffect(() => {
    if (!authChecked) return;
    if (userId && !profile) return; // wait for the profile before deciding what to load
    reload().finally(() => setReady(true));
  }, [authChecked, userId, profile, reload]);

  // Coalesce bursts of changes into one reload.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => reload(), 350);
  }, [reload]);

  // --- realtime: other people's changes, and approval of my own account
  useEffect(() => {
    if (!userId) return;
    const channel = sb().channel(`live-${userId}`);
    if (active) {
      for (const table of TABLES) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => scheduleReload());
      }
    }
    channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `user_id=eq.${userId}` }, () =>
      loadProfile(),
    );
    channel.subscribe();
    return () => {
      sb().removeChannel(channel);
    };
  }, [userId, active, scheduleReload, loadProfile]);

  // Tell the user when a coordinator approved their access.
  const prevStatus = useRef<string | null>(null);
  useEffect(() => {
    if (prevStatus.current === 'pending' && profile?.status === 'active') toast('Je aanvraag is goedgekeurd. Welkom!');
    prevStatus.current = profile?.status ?? null;
  }, [profile?.status, toast]);

  // --- actions
  const dispatch = useCallback(
    (raw: Action) => {
      const action = withId(raw);
      const prev = stateRef.current;
      setState((s) => reducer(s, action));
      applyRemote(action, prev)
        .then(() => scheduleReload())
        .catch((e: Error) => {
          toast(e instanceof NoRightsError ? e.message : `Opslaan mislukt: ${e.message}`, 'warning');
          reload();
        });
    },
    [scheduleReload, reload, toast],
  );

  const live: LiveApi = useMemo(
    () => ({
      email: session?.user.email ?? null,
      profile,
      ready,
      loginOpen,
      setLoginOpen,
      signOut: async () => {
        await sb().auth.signOut();
        setProfile(null);
        toast('Je bent uitgelogd', 'info');
      },
      reload: async () => {
        await loadProfile();
        await reload();
      },
      saveProfile: async (patch) => {
        if (!userId) return;
        await saveOwnProfile(userId, patch, !!profile?.isCoordinator && profile.status === 'active');
        await loadProfile();
      },
      functionsUrl: FUNCTIONS_URL,
    }),
    [session, profile, ready, loginOpen, userId, loadProfile, reload, toast],
  );

  const value = useMemo(() => ({ state, dispatch, role, live }), [state, dispatch, role, live]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
