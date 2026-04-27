/**
 * Supabase client for **server components / route handlers** (RSC).
 *
 * Czyta sesję z cookies (sb-access-token, sb-refresh-token).
 * Używaj wewnątrz Server Components w app/ oraz w app/api route handlerach.
 *
 * Reference: BACKEND_SPEC.md v1.1 sekcja 7.2.
 */
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@k2/database/types';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Components nie mogą mutować cookies — ignorujemy.
            // Middleware odświeża je w trakcie request lifecycle.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // ditto
          }
        },
      },
    },
  );
}
