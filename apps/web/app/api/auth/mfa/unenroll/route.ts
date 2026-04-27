/**
 * POST /api/auth/mfa/unenroll (BACKEND_SPEC.md v1.1.1, sekcja 7.6).
 *
 * User usuwa swój własny TOTP factor. Wymaga aal2 (sesja po MFA challenge) —
 * Supabase wymusza to po stronie API: nie pozwoli usunąć factor'a z aal1.
 *
 * Po unenroll user wraca do aal1; jeśli policy admina wymaga aal2, kolejne
 * wejście na `/admin` wymusi nowy enrollment.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { UnenrollMfaInput } from '@/lib/validation/mfa';
import { logAudit } from '@/lib/audit';
import { invalidateRoleCache } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = UnenrollMfaInput.parse(await req.json());

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

    const { error } = await supabase.auth.mfa.unenroll({ factorId: body.factorId });
    if (error) {
      // 400 zamiast 500 — najczęstszy powód to "factor needs aal2" lub "not your factor".
      throw new ApiError('VALIDATION_ERROR', `MFA unenroll failed: ${error.message}`, 400);
    }

    invalidateRoleCache(user.id);

    await logAudit({
      action: 'auth.mfa.unenroll',
      resourceType: 'profile',
      resourceId: user.id,
      actorId: user.id,
      actorEmail: user.email ?? null,
      before: { factorId: body.factorId },
    });

    return NextResponse.json(
      { data: { ok: true } },
      { headers: res.headers },
    );
  } catch (e) {
    return handleError(e);
  }
}
