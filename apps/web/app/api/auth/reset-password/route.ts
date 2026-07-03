/**
 * POST /api/auth/reset-password
 *
 * Ustawia nowe hasło dla zalogowanego usera (recovery session z magic linka).
 * Wymaga aktywnej sesji — link recovery sam zaloguje usera, potem ta route
 * tylko aktualizuje password przez supabase.auth.updateUser.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError, ApiError } from '@/lib/api/error';
import { ResetPasswordInput } from '@/lib/validation/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = ResetPasswordInput.parse(await req.json());

    const res = NextResponse.json({
      data: { ok: true, message: 'Hasło zostało zmienione. Zaloguj się ponownie.' },
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

    // Wymaga aktywnej sesji (recovery flow user juz zalogowany przez link)
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new ApiError('UNAUTHORIZED', 'Sesja recovery wygasła. Spróbuj ponownie.', 401);
    }

    // Konta z MFA: sesja recovery to AAL1, a updateUser({password}) wymaga AAL2
    // ("AAL2 session is required to update email or password when MFA is enabled").
    // Najpierw challenge→verify kodem TOTP, żeby podnieść sesję do AAL2.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsMfa = aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2';
    if (needsMfa) {
      if (!body.factorId || !body.code) {
        throw new ApiError(
          'MFA_REQUIRED',
          'To konto ma włączone MFA — podaj kod TOTP, aby ustawić nowe hasło.',
          401,
          { mfaRequired: true },
        );
      }
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({
        factorId: body.factorId,
      });
      if (chErr || !ch) {
        throw new ApiError('VALIDATION_ERROR', `MFA challenge failed: ${chErr?.message}`, 400);
      }
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: body.factorId,
        challengeId: ch.id,
        code: body.code,
      });
      if (vErr) {
        throw new ApiError('VALIDATION_ERROR', 'Niepoprawny kod TOTP.', 400);
      }
    }

    const { error } = await supabase.auth.updateUser({ password: body.password });
    if (error) {
      throw new ApiError('VALIDATION_ERROR', error.message, 422);
    }

    // Po zmianie hasła wylogowujemy z bieżącej sesji (security: force fresh login).
    await supabase.auth.signOut();

    return res;
  } catch (e) {
    return handleError(e);
  }
}
