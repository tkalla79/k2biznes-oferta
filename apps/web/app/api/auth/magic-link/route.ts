/**
 * POST /api/auth/magic-link (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 7.2).
 *
 * Wysyła OTP/magic link na email. Klient klika → `/auth/callback?code=...`
 * exchanguje na sesję. Anti-enum: zwracamy `ok:true` niezależnie czy email
 * istnieje (Supabase tak robi domyślnie).
 *
 * Rate-limit: signin bucket (10/min/IP).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError } from '@/lib/api/error';
import { MagicLinkInput } from '@/lib/validation/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = MagicLinkInput.parse(await req.json());

    const res = NextResponse.json({
      data: { ok: true, message: 'Link wysłany. Sprawdź skrzynkę.' },
    });
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const redirectTo = body.redirectTo ?? '/admin';
    const callbackUrl = `${baseUrl}/auth/callback?next=${encodeURIComponent(redirectTo)}`;

    await supabase.auth.signInWithOtp({
      email: body.email,
      options: {
        emailRedirectTo: callbackUrl,
        // shouldCreateUser=false — invite flow tworzy usera; magic link tylko
        // dla istniejących userów. Inaczej każdy mógłby self-register.
        shouldCreateUser: false,
      },
    });

    // Świadomie ignorujemy error i zwracamy ok — anti-enum (atakujący nie
    // dowiaduje się czy email istnieje).
    return res;
  } catch (e) {
    return handleError(e);
  }
}
