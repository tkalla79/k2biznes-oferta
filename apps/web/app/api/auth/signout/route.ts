/**
 * POST /api/auth/signout (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 *
 * Wyloguj — wywoła Supabase signOut + usunie cookies sesyjne.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError } from '@/lib/api/error';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.json({ data: { ok: true } });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: (name: string, value: string, options: CookieOptions) => {
            res.cookies.set({ name, value, ...options });
          },
          remove: (name: string, options: CookieOptions) => {
            res.cookies.set({ name, value: '', ...options });
          },
        },
      },
    );
    await supabase.auth.signOut();
    return res;
  } catch (e) {
    return handleError(e);
  }
}
