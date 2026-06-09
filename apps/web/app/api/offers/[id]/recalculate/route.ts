/**
 * POST /api/offers/[id]/recalculate (BACKEND_SPEC.md v1.1.1, sekcja 5.2 + 3.2.3).
 *
 * Wymusza re-kalkulację `pricing_snapshot` na obecnych SEGMENTS+CONFIG.
 * Użyteczne gdy super_admin zmienił pricing_segments — dla każdej oferty
 * z statusem `draft` lub `sent` można wymusić odświeżenie snapshotu zanim
 * klient ją zobaczy.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, Errors, ApiError } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { calcPricing } from '@/lib/pricing';
import { loadPricing } from '@/lib/pricing/load';
import { toOfferDto } from '@/lib/offers/mapper';
import { deletePdfsForOffer } from '@/lib/pdf/storage';
import type { Json } from '@k2/database/types';

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

    const { data: before, error: e0 } = await sb
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (e0) throw new ApiError('INTERNAL_ERROR', e0.message, 500);
    if (!before || before.deleted_at) throw Errors.offerNotFound();

    // Konsultant tylko swoje + tylko draft/sent
    if (session.role === 'consultant') {
      const owns = before.created_by === session.userId || before.assigned_consultant_id === session.userId;
      if (!owns) throw Errors.forbidden();
      if (!['draft', 'sent'].includes(before.status)) {
        throw Errors.conflictStatus(`Recalc niedozwolony dla statusu ${before.status}.`);
      }
    }

    const { segments, config } = await loadPricing({ forceRefresh: true });
    const snapshot = calcPricing(
      {
        projectValue: Number(before.project_value),
        fundingRate: Number(before.funding_rate),
        returningClient: before.returning_client,
        projectCount: before.project_count,
      },
      segments,
      config,
    );

    const { data: updated, error: e1 } = await sb
      .from('offers')
      .update({ pricing_snapshot: snapshot as unknown as Json })
      .eq('id', params.id)
      .select()
      .single();
    if (e1 || !updated) throw new ApiError('INTERNAL_ERROR', `recalc failed: ${e1?.message}`, 500);

    // Invalidate PDF cache (sekcja 9.1 / 11.8) — recalc zmienia hash.
    void deletePdfsForOffer(updated.offer_number).catch((e) =>
      console.error('[recalc] pdf invalidation failed:', e.message),
    );

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: updated.id,
        type: 'updated',
        actor_id: session.userId,
        actor_type: session.role === 'consultant' ? 'consultant' : 'admin',
        payload: { reason: 'recalculate', segment: snapshot.segment.id },
      }),
      logAudit({
        action: 'offer.recalculate',
        resourceType: 'offer',
        resourceId: updated.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { funding: Number(before.project_value) * Number(before.funding_rate) },
        after: { segment: snapshot.segment.id, base: snapshot.base },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ data: toOfferDto(updated, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}
