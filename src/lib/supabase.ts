import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

let client: SupabaseClient | null = null;

/** The Supabase client, created on first use (the offline prototype never calls this). */
export function sb(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase is niet ingesteld (.env.live ontbreekt).');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Login happens with a 6-digit code, not by clicking a link, so there is nothing to read from the URL
        // (and our own #/routes stay untouched).
        detectSessionInUrl: false,
        storageKey: 'eiwitshift-kalender-auth',
      },
    });
  }
  return client;
}
