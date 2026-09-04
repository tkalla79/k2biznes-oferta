/**
 * PATCH /api/admin/users/[id]/status — dezaktywacja i przywracanie konta.
 *
 * Tylko super_admin (sekcja 7.5). Dezaktywacja to jedyna dostępna forma
 * "usunięcia" konta: `offers.created_by` ma `on delete restrict`, więc
 * fizyczne usunięcie osoby, która wystawiła choć jedną ofertę, zabrałoby ze
 * sobą historię — i dlatego jest zablokowane na poziomie schematu.
 *
 * Dezaktywacja:
 *   1. `profiles.is_active = false`, `deleted_at = now()` — brama sesji
 *      (`lib/auth/session.ts`) odrzuca oba stany, więc logowanie przestaje
 *      działać natychmiast.
 *   2. Globalny sign-out — aktywne sesje przestają działać od razu, a nie po
 *      wygaśnięciu JWT.
 *   3. Audit log + invalidate role cache.
 *
 * Przywracanie cofa punkt 1. Uwaga na `uq_profiles_email_active`: indeks
 * unikalny obowiązuje tylko dla wierszy bez `deleted_at`, więc jeśli w
 * międzyczasie powstało nowe konto na ten sam email, przywrócenie zwróci 409.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireSuperAdmin, invalidateRoleCache } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { UpdateUserStatusInput } from '@/lib/validation/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id.', 422);
    }
    const session = await requireSuperAdmin();
    const body = UpdateUserStatusInput.parse(await req.json());

    if (params.id === session.userId && !body.isActive) {
      // Bez tego super_admin moze zablokowac sam siebie i stracic dostep do
      // panelu, w ktorym mogl by to cofnac.
      throw Errors.forbidden('Nie możesz dezaktywować własnego konta.');
    }

    const sb = createAdminClient();

    const { data: before, error: fetchErr } = await sb
      .from('profiles')
      .select('email, full_name, role, is_active, deleted_at')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchErr) throw new ApiError('INTERNAL_ERROR', fetchErr.message, 500);
    if (!before) throw Errors.notFound('Użytkownik nie istnieje.');

    const wasActive = before.is_active && !before.deleted_at;
    if (wasActive === body.isActive) {
      return NextResponse.json({ data: { ok: true, unchanged: true } });
    }

    const { error: updErr } = await sb
      .from('profiles')
      .update(
        body.isActive
          ? { is_active: true, deleted_at: null }
          : { is_active: false, deleted_at: new Date().toISOString() },
      )
      .eq('id', params.id);

    if (updErr) {
      if (updErr.code === '23505') {
        throw new ApiError(
          'CONFLICT',
          `Nie można przywrócić konta: istnieje już aktywne konto na adres ${before.email}.`,
          409,
        );
      }
      throw new ApiError('INTERNAL_ERROR', updErr.message, 500);
    }

    if (!body.isActive) {
      // Aktywne sesje wygaszamy od razu — brama sesji i tak je odrzuci, ale
      // sign-out czysci tokeny odswiezania.
      const { error: signOutErr } = await sb.auth.admin.signOut(params.id, 'global');
      if (signOutErr) console.warn('[user-status] global sign-out failed:', signOutErr.message);
    }
    invalidateRoleCache(params.id);

    await logAudit({
      action: body.isActive ? 'profile.restore' : 'profile.deactivate',
      resourceType: 'profile',
      resourceId: params.id,
      actorId: session.userId,
      actorEmail: session.email,
      before: { email: before.email, is_active: before.is_active, deleted_at: before.deleted_at },
      after: { is_active: body.isActive, deleted_at: body.isActive ? null : 'now()' },
    });

    return NextResponse.json({ data: { ok: true, id: params.id, isActive: body.isActive } });
  } catch (e) {
    return handleError(e);
  }
}
