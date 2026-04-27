/**
 * Supabase **admin client** (service role) — omija RLS.
 *
 * Używaj WYŁĄCZNIE server-side, w endpointach `/api/public/*` (gdzie anon
 * nie może czytać przez RLS) oraz w operacjach Edge Functions / cron.
 *
 * NIGDY nie eksportuj do client componentu — wycieknie service role key.
 *
 * Reference: BACKEND_SPEC.md v1.1 sekcja 4.3, 5.3 (`POST /api/public/*`).
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@k2/database/types';

let cached: ReturnType<typeof createClient<Database>> | null = null;

export function createAdminClient() {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  }

  cached = createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { 'x-k2-actor': 'service_role' },
    },
  });

  return cached;
}
