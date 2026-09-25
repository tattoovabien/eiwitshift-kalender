// Live mode is switched on by building with `--mode live`, which reads .env.live.
// Without these values the app is the offline prototype (demo roles, localStorage).
// The publishable (or legacy anon) key is meant to be public: security comes from the database's access rules.
export const SUPABASE_URL: string = import.meta.env.VITE_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const LIVE = __LIVE__;
export const FUNCTIONS_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1` : '';
