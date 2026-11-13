/**
 * POST /api/offers/[id]/status — ręczna zmiana statusu przez admina.
 *
 * Przejścia i ich skutki definiuje `lib/offers/statusChange.ts`. Ten endpoint
 * tylko je wykonuje: sprawdza uprawnienia, zakłada optymistyczną blokadę na
 * statusie i zostawia ślad (zdarzenie w historii oferty + audyt) z powodem
 * zmiany — przy ręcznym przestawieniu statusu to jedyne wyjaśnienie, skąd się
 * wziął.
 *
 * Akceptację i odmowę wpisuje `POST /api/offers/:id/decision` (wariant, kwota,
 * kanał), nie ten endpoint.
 *
 * Do CRM nic nie leci: webhook nie ma zdarzenia „status cofnięty", a
 * wymyślanie go bez znajomości konsumenta byłoby zgadywaniem. Cofnięcie
 * akceptacji trzeba odnotować w CRM ręcznie.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { MANUAL_STATUS_TARGETS, planStatusChange } from '@/lib/offers/statusChange';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const Input = z.object({
  to: z.enum(MANUAL_STATUS_TARGETS),
  /** Powód jest obowiązkowy: przy ręcznej zmianie statusu to jedyny ślad dlaczego. */
  reason: z.string().trim().min(3, 'Podaj powód zmiany statusu.').max(1000),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const session = await requireAdmin();
    const body = Input.parse(await req.json());

    const sb = createAdminClient();
    const { data: offer, error: loadErr } = await sb
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (loadErr) throw new ApiError('INTERNAL_ERROR', loadErr.message, 500);
    if (!offer || offer.deleted_at) throw Errors.offerNotFound();

    const plan = planStatusChange({
      from: offer.status,
      to: body.to,
      expiresAt: offer.expires_at,
    });
    if (!plan) {
      throw Errors.conflictStatus(
        offer.status === 'draft'
          ? 'Wersji roboczej nie przestawia się ręcznie — wyślij ofertę albo otwórz link bez maila.'
          : `Nie można zmienić statusu z "${offer.status}" na "${body.to}".`,
      );
    }

    const { data: updated, error } = await sb
      .from('offers')
      .update(plan.update)
      .eq('id', offer.id)
      .eq('status', offer.status) // klient mógł w międzyczasie zaakceptować
      .select()
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!updated) throw Errors.conflictStatus('Status oferty zmienił się podczas operacji.');

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: offer.id,
        type: 'updated',
        payload: {
          statusChange: { from: offer.status, to: body.to },
          reason: body.reason,
        } as Json,
        actor_id: session.userId,
        actor_type: 'admin',
      }),
      logAudit({
        action: 'offer.status_change',
        resourceType: 'offer',
        resourceId: offer.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: {
          status: offer.status,
          view_count: offer.view_count,
          accepted_fee: offer.accepted_fee,
          accepted_variant: offer.accepted_variant,
          expires_at: offer.expires_at,
        },
        after: { status: body.to, reason: body.reason, effects: plan.effects },
      }),
    ]);

    return NextResponse.json({ data: { success: true, status: body.to, effects: plan.effects } });
  } catch (e) {
    return handleError(e);
  }
}
