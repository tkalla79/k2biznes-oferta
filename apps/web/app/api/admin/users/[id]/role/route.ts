/**
 * PATCH /api/admin/users/[id]/role (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 7.5).
 *
 * Super admin zmienia rolę. Procedura (sekcja 7.5):
 * 1. Update `profiles.role`.
 * 2. Propaguj do `auth.users.raw_app_meta_data.role` (JWT claim).
 * 3. Invalidate aktywne sesje przez `auth.admin.signOut(id, 'global')` —
 *    user musi się przelogować, JWT z nową rolą.
 * 4. Audit log + invalidate role cache (`lib/auth/session.ts`).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireSuperAdmin, invalidateRoleCache } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { UpdateRoleInput } from '@/lib/validation/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id.', 422);
    }
    const session = await requireSuperAdmin();
    const body = UpdateRoleInput.parse(await req.json());

    if (params.id === session.userId && body.role !== 'super_admin') {
      // Anty-self-demotion — super_admin nie może zdegradować samego siebie
      // (mogłoby zostawić system bez super_admina jeśli to ostatni).
      throw Errors.forbidden('Nie możesz zdegradować swojej roli. Poproś innego super_admina.');
    }

    const sb = createAdminClient();

    const { data: before } = await sb
      .from('profiles')
      .select('email, role')
      .eq('id', params.id)
      .maybeSingle();
    if (!before) throw Errors.notFound('Użytkownik nie istnieje.');

    if (before.role === body.role) {
      // No-op — zwracamy 200 ale nic nie robimy.
      return NextResponse.json({ data: { ok: true, unchanged: true } });
    }

    // 1. Update profiles
    const { error: profileErr } = await sb
      .from('profiles')
      .update({ role: body.role })
      .eq('id', params.id);
    if (profileErr) throw new ApiError('INTERNAL_ERROR', profileErr.message, 500);

    // 2. Propaguj do auth.users.raw_app_meta_data — JWT claim w nowych sesjach
    const { error: appMetaErr } = await sb.auth.admin.updateUserById(params.id, {
      app_metadata: { role: body.role },
    });
    if (appMetaErr) {
      // Profile już zaktualizowane; logujemy ale nie cofamy.
      console.error('[role] app_metadata propagation failed:', appMetaErr.message);
    }

    // 3. Invalidate sesje — user musi się przelogować
    const { error: signOutErr } = await sb.auth.admin.signOut(params.id, 'global');
    if (signOutErr) {
      console.warn('[role] global sign-out failed:', signOutErr.message);
    }

    // 4. Invalidate role cache + audit log
    invalidateRoleCache(params.id);
    await logAudit({
      action: 'profile.role.update',
      resourceType: 'profile',
      resourceId: params.id,
      actorId: session.userId,
      actorEmail: session.email,
      before: { role: before.role },
      after: { role: body.role, email: before.email },
    });

    return NextResponse.json({
      data: { ok: true, userId: params.id, role: body.role },
    });
  } catch (e) {
    return handleError(e);
  }
}
