import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function hasSupabaseConfig(): boolean {
  return !!((process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Privileged client: import only from server modules; validate the user before private mutations. */
export function createServerClient(signal?: AbortSignal): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => fetch(input, {
        ...init,
        signal: AbortSignal.any([AbortSignal.timeout(10_000), ...(signal ? [signal] : []), ...(init?.signal ? [init.signal] : [])]),
      }),
    },
  });
}
