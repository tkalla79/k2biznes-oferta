/**
 * POST /api/public/offers/[token]/reject (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Klient odrzuca ofertę. Symetryczny do `/accept`, ale bez wymogu GDPR
 * (klient nie zostawia danych osobowych poza opcjonalnym imieniem/emailem
 * dla follow-upu konsultanta).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { fetchActiveOffer } from '@/lib/offers/public';
import { RejectOfferInput } from '@/lib/validation/public-offers';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashIp, getClientIp } from '@/lib/ip-hash';
import { logAudit } from '@/lib/audit';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = RejectOfferInput.parse(await req.json());
    const offer = await fetchActiveOffer(params.token);

    const { hash: ipHash, version: saltVersion } = await hashIp(getClientIp(req.headers));
    const now = new Date().toISOString();

    const sb = createAdminClient();
    const { data: updated, error: upErr } = await sb
      .from('offers')
      .update({
        status: 'rejected',
        accepted_by_name: body.clientName,
        accepted_by_email: body.clientEmail ?? null,
        client_comment: body.reason ?? null,
        rejected_at: now,
      })
      .eq('id', offer.id)
      .eq('status', offer.status)
      .select()
      .maybeSingle();

    if (upErr) throw new ApiError('INTERNAL_ERROR', `reject update failed: ${upErr.message}`, 500);
    if (!updated) {
      throw Errors.conflictStatus('Status oferty zmienił się podczas operacji.');
    }

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: offer.id,
        type: 'rejected',
        payload: { reason: body.reason ?? null } as Json,
        actor_id: null,
        actor_type: 'client',
        ip_hash: ipHash,
        ip_salt_version: saltVersion,
        user_agent: req.headers.get('user-agent') ?? null,
      }),
      logAudit({
        action: 'offer.reject',
        resourceType: 'offer',
        resourceId: offer.id,
        actorId: null,
        actorEmail: body.clientEmail ?? null,
        before: { status: offer.status },
        after: { status: 'rejected' },
        ipHash,
      }),
    ]);

    // TODO PR #5: email do konsultanta o odrzuceniu

    return NextResponse.json({
      data: {
        success: true,
        offerNumber: updated.offer_number,
        rejectedAt: now,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
