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
import { notifyConsultantOfferRejected } from '@/lib/email/notifications';
import { enqueueOfferWebhook } from '@/lib/webhooks/enqueue';
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
        // Code review PR #2: dedykowane kolumny `rejected_by_*` zamiast
        // re-używania `accepted_by_*` (false positive w analytics).
        rejected_by_name: body.clientName,
        rejected_by_email: body.clientEmail ?? null,
        reject_reason: body.reason ?? null,
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

    // Email do konsultanta — best-effort (sekcja 8.3)
    notifyConsultantOfferRejected(updated).catch((e) =>
      console.error('[reject] notify consultant failed:', e.message),
    );

    // CRM webhook 'offer.rejected' — best-effort enqueue (sekcja 10)
    enqueueOfferWebhook({ event: 'offer.rejected', offer: updated }).catch((e) =>
      console.error('[reject] enqueue webhook failed:', e.message),
    );

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
