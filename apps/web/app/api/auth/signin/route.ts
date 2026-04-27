/**
 * POST /api/auth/signin (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 7.2).
 *
 * Email + password sign-in. Proxy do Supabase Auth — pobiera tokens i ustawia
 * cookies przez `@supabase/ssr` żeby kolejne SSR requesty miały sesję.
 *
 * Rate-limit: 10 req/min/IP (signin bucket, sekcja 7.6 — bruteforce protection).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError, ApiError } from '@/lib/api/error';
import { SigninInput } from '@/lib/validation/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = SigninInput.parse(await req.json());

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

    const { error } = await supabase.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (error) {
      // Supabase zwraca generic "Invalid login credentials" — anti-enum.
      throw new ApiError('UNAUTHORIZED', 'Niepoprawny email lub hasło.', 401);
    }

    // Sprawdź czy konto ma verified TOTP factor — jeśli tak, sesja jest aal1
    // i wymaga drugiego kroku (sekcja 7.6). Klient użyje tego do redirectu.
    const [{ data: aal }, { data: factors }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const hasVerifiedTotp = (factors?.totp ?? []).some((f) => f.status === 'verified');
    const mfaRequired = hasVerifiedTotp && aal?.currentLevel !== 'aal2';

    return NextResponse.json(
      { data: { ok: true, mfaRequired } },
      { headers: res.headers },
    );
  } catch (e) {
    return handleError(e);
  }
}
