/**
 * POST /api/offers/[id]/publish — otwiera link klienta BEZ wysyłki maila.
 *
 * Po dołożeniu bramy akceptacji (2026-09) ścieżka zrobiła się myląca:
 * zatwierdzenie wygląda na „gotowe do udostępnienia", ale statusu nie zmienia,
 * a dopóki oferta jest robocza, `/o/{token}` zwraca klientowi 404 — także
 * z `?__preview=1`, bo podgląd wymaga zalogowanego właściciela oferty.
 * Jedynym sposobem na działający link była wysyłka maila z systemu.
 *
 * Ten endpoint jest dla przypadku „wysyłam link własnym kanałem" (WhatsApp,
 * prywatna skrzynka): przestawia status na `sent`, nie dotykając poczty.
 *
 * Brama akceptacji obowiązuje tak samo jak przy `/send` — inaczej publikacja
 * byłaby obejściem kontroli, którą ta brama miała wprowadzić.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { enqueueOfferWebhook } from '@/lib/webhooks/enqueue';
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

    const sb = createAdminClient();
    const { data: offer, error: e0 } = await sb
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (e0) throw new ApiError('INTERNAL_ERROR', e0.message, 500);
    if (!offer || offer.deleted_at) throw Errors.offerNotFound();

    // Te same uprawnienia co przy wysyłce.
    const isOwner =
      offer.created_by === session.userId || offer.assigned_consultant_id === session.userId;
    const isAdmin = session.role === 'admin' || session.role === 'super_admin';
    if (!isOwner && !isAdmin) throw Errors.forbidden('Brak dostępu do tej oferty.');

    if (offer.status !== 'draft' && offer.status !== 'sent') {
      throw Errors.conflictStatus(`Publikacja niedozwolona dla statusu ${offer.status}.`);
    }

    if (!offer.approved_at) {
      throw Errors.conflictStatus(
        'Oferta nie została zatwierdzona. Link otwieramy dopiero po akceptacji — ' +
          'tak samo jak przy wysyłce mailem.',
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

    // Idempotentnie: oferta już wysłana ma działający link, nie przestawiamy
    // `sent_at` (data pierwszego udostępnienia jest tą, która się liczy).
    if (offer.status === 'sent') {
      return NextResponse.json({ data: toOfferDto(offer, appUrl) });
    }

    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await sb
      .from('offers')
      .update({ status: 'sent', sent_at: now })
      .eq('id', offer.id)
      .select()
      .single();
    if (upErr || !updated) {
      throw new ApiError('INTERNAL_ERROR', `publish failed: ${upErr?.message}`, 500);
    }

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: updated.id,
        type: 'sent',
        actor_id: session.userId,
        actor_type: session.role === 'consultant' ? 'consultant' : 'admin',
        // `channel` odróżnia to od wysyłki mailem — w historii aktywności ma być
        // widać, że klient dostał link inną drogą i maila od nas nie ma.
        payload: { channel: 'manual' },
      }),
      logAudit({
        action: 'offer.publish',
        resourceType: 'offer',
        resourceId: updated.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { status: offer.status },
        after: { status: 'sent', channel: 'manual' },
      }),
      // CRM ma wiedzieć, że oferta poszła, niezależnie od kanału.
      enqueueOfferWebhook({ event: 'offer.sent', offer: updated }).catch((e: Error) =>
        console.error('[publish] enqueue webhook failed:', e.message),
      ),
    ]);

    return NextResponse.json({ data: toOfferDto(updated, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}
