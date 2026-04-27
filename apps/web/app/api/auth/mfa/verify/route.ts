/**
 * POST /api/auth/mfa/verify (BACKEND_SPEC.md v1.1.1, sekcja 7.6).
 *
 * Wspólny endpoint dla:
 * 1. Finalizacji enrollment'u — user pierwszy raz wpisuje kod z aplikacji TOTP
 *    żeby aktywować factor. Po sukcesie factor.status = 'verified' i AAL2.
 * 2. Sign-in challenge — user już ma factor, po signinie wpisuje kod żeby
 *    upgrade'ować sesję do AAL2.
 *
 * W obu przypadkach Supabase wymaga sekwencji: challenge → verify.
 * Server robi `mfa.challenge({factorId})` żeby dostać challengeId, a potem
 * `mfa.verify({factorId, challengeId, code})`. Klient nie musi znać challengeId
 * — wysyła tylko `{factorId, code}`.
 *
 * Po sukcesie cookies są aktualizowane (nowe AAL w JWT) — dlatego musimy
 * zwrócić `res.headers` żeby przeglądarka dostała Set-Cookie.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { VerifyMfaInput } from '@/lib/validation/mfa';
import { logAudit } from '@/lib/audit';
import { invalidateRoleCache } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = VerifyMfaInput.parse(await req.json());

    const res = NextResponse.json({ data: null });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => req.cookies.get(name)?.value,
          set: (name: string, value: string, options: CookieOptions) =>
            res.cookies.set({ name, value, ...options }),
          remove: (name: string, options: CookieOptions) =>
            res.cookies.set({ name, value: '', ...options }),
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw Errors.unauthorized();

    // Krok 1: challenge — Supabase generuje challengeId z TTL ~60s.
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: body.factorId,
    });
    if (chErr || !ch) {
      throw new ApiError('VALIDATION_ERROR', `MFA challenge failed: ${chErr?.message}`, 400);
    }

    // Krok 2: verify — sprawdzenie kodu względem secret.
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId: body.factorId,
      challengeId: ch.id,
      code: body.code,
    });
    if (vErr) {
      // Niepoprawny kod / wygasły challenge / inny błąd → 400.
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny kod TOTP.', 400);
    }

    // Cache roli odczytuje JWT — po AAL upgrade JWT się zmienia.
    invalidateRoleCache(user.id);

    await logAudit({
      action: 'auth.mfa.verify',
      resourceType: 'profile',
      resourceId: user.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      after: { factorId: body.factorId },
    });

    return NextResponse.json(
      { data: { ok: true, aal: 'aal2' } },
      { headers: res.headers },
    );
  } catch (e) {
    return handleError(e);
  }
}
