/**
 * POST /api/offers/[id]/restore — cofa soft delete (admin+).
 *
 * Para do `DELETE /api/offers/[id]`. Soft delete jest odwracalny z założenia
 * (wiersz zostaje w bazie dla audytu), ale dotąd nie było jak go cofnąć bez
 * SQL-a. Panel pokazuje usunięte oferty pod filtrem "Usunięte" i pozwala
 * przywrócić pomyłkę jednym kliknięciem.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { toOfferDto } from '@/lib/offers/mapper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const session = await requireSession();
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw Errors.forbidden('Przywrócenie oferty wymaga roli admin.');
    }

    const sb = createAdminClient();

    // Świadomie NIE używamy fetchOfferOrThrow z route'a [id] — ten odrzuca
    // oferty z ustawionym `deleted_at`, a tu chodzi dokładnie o nie.
    const { data: before, error: fetchErr } = await sb
      .from('offers')
      .select('id, offer_number, status, deleted_at')
      .eq('id', params.id)
      .maybeSingle();
    if (fetchErr) throw new ApiError('INTERNAL_ERROR', fetchErr.message, 500);
    if (!before) throw Errors.offerNotFound();

    if (!before.deleted_at) {
      // Idempotencja: nic do przywracania, ale to nie błąd.
      return NextResponse.json({ data: { ok: true, unchanged: true, id: params.id } });
    }

    const { data: restored, error } = await sb
      .from('offers')
      .update({ deleted_at: null })
      .eq('id', params.id)
      .select()
      .single();
    if (error || !restored) {
      throw new ApiError('INTERNAL_ERROR', `restore failed: ${error?.message}`, 500);
    }

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: restored.id,
        type: 'updated',
        actor_id: session.userId,
        actor_type: 'admin',
        payload: { action: 'restore', deletedAt: before.deleted_at },
      }),
      logAudit({
        action: 'offer.restore',
        resourceType: 'offer',
        resourceId: restored.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { deleted_at: before.deleted_at, offer_number: before.offer_number },
        after: { deleted_at: null },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ data: toOfferDto(restored, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}
