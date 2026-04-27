/**
 * Supabase client for **browser / client components**.
 *
 * Używaj wewnątrz `'use client'` komponentów. Odczyt sesji z cookies przez
 * automatyczny mechanizm @supabase/ssr.
 *
 * Reference: BACKEND_SPEC.md v1.1 sekcja 7.2.
 */
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@k2/database/types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
