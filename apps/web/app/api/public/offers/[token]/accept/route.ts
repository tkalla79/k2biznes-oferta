/**
 * POST /api/public/offers/[token]/accept (BACKEND_SPEC.md v1.1.1, sekcja 5.3 + 11.6).
 *
 * Klient akceptuje wariant. Walidacja:
 * 1. Status oferty `sent`/`viewed` (else 409)
 * 2. `selectedVariant ∈ offered_variants` (else 422 VARIANT_NOT_OFFERED)
 * 3. `gdprClauseVersion` zgodna z aktualną klauzulą (else 422 GDPR_CLAUSE_MISMATCH)
 *
 * Side effects:
 * - update offer (status='accepted', accepted_*, gdpr_*)
 * - insert event 'accepted'
 * - audit_log
 * - email do konsultanta — TODO PR #5
 * - webhook CRM — TODO PR #7
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { fetchActiveOffer } from '@/lib/offers/public';
import { AcceptOfferInput } from '@/lib/validation/public-offers';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashIp, getClientIp } from '@/lib/ip-hash';
import { logAudit } from '@/lib/audit';
import type { Json } from '@k2/database/types';
import type { PricingResult, PricingVariant } from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = AcceptOfferInput.parse(await req.json());
    const offer = await fetchActiveOffer(params.token);

    // Variant validation
    if (!offer.offered_variants.includes(body.selectedVariant)) {
      throw Errors.variantNotOffered();
    }

    // GDPR clause version + hash check (sekcja 11.6)
    const sb = createAdminClient();
    const { data: clause, error: clauseErr } = await sb
      .from('gdpr_clauses')
      .select('version, text_hash, is_current')
      .eq('version', body.gdprClauseVersion)
      .maybeSingle();

    if (clauseErr) throw new ApiError('INTERNAL_ERROR', clauseErr.message, 500);
    if (!clause || !clause.is_current) {
      throw new ApiError(
        'GDPR_CLAUSE_MISMATCH',
        'Wersja klauzuli RODO nie odpowiada aktualnej.',
        422,
        { provided: body.gdprClauseVersion, current: clause?.is_current ?? false },
      );
    }

    // Wylicz acceptedFee z pricing_snapshot (zamrożona kalkulacja z momentu utworzenia oferty)
    const snapshot = offer.pricing_snapshot as unknown as PricingResult;
    const variant = snapshot.variants.find(
      (v: PricingVariant) => v.id === body.selectedVariant,
    );
    if (!variant) {
      throw new ApiError(
        'INTERNAL_ERROR',
        `Wariant ${body.selectedVariant} nie istnieje w pricing_snapshot.`,
        500,
      );
    }
    const acceptedFee = variant.sfAmount;

    // IP hash + UA dla audytu
    const { hash: ipHash, version: saltVersion } = await hashIp(getClientIp(req.headers));
    const now = new Date().toISOString();

    // Update offer (transactional intent — Supabase JS nie ma multi-statement transaction,
    // ale `update().eq()` + insert eventu są niezależne; failure eventu nie cofa update).
    const { data: updated, error: upErr } = await sb
      .from('offers')
      .update({
        status: 'accepted',
        accepted_variant: body.selectedVariant,
        accepted_fee: acceptedFee,
        accepted_by_name: body.clientName,
        accepted_by_email: body.clientEmail,
        client_comment: body.comment ?? null,
        accepted_at: now,
        gdpr_clause_version: clause.version,
        gdpr_text_hash: clause.text_hash,
        gdpr_accepted_at: now,
      })
      .eq('id', offer.id)
      .eq('status', offer.status) // optimistic lock — guard przeciw race condition z drugą akceptacją
      .select()
      .maybeSingle();

    if (upErr) throw new ApiError('INTERNAL_ERROR', `accept update failed: ${upErr.message}`, 500);
    if (!updated) {
      // Optimistic lock failed — ktoś inny zaakceptował/odrzucił równolegle.
      throw Errors.conflictStatus('Status oferty zmienił się podczas operacji.');
    }

    // Event + audit (best-effort)
    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: offer.id,
        type: 'accepted',
        payload: {
          variant: body.selectedVariant,
          acceptedFee,
          gdprVersion: clause.version,
        } as Json,
        actor_id: null,
        actor_type: 'client',
        ip_hash: ipHash,
        ip_salt_version: saltVersion,
        user_agent: req.headers.get('user-agent') ?? null,
      }),
      logAudit({
        action: 'offer.accept',
        resourceType: 'offer',
        resourceId: offer.id,
        actorId: null,
        actorEmail: body.clientEmail,
        before: { status: offer.status },
        after: {
          status: 'accepted',
          variant: body.selectedVariant,
          acceptedFee,
        },
        ipHash,
      }),
    ]);

    // TODO PR #5: enqueue email do assigned_consultant + contact_person
    // TODO PR #7: enqueue CRM webhook 'offer.accepted'

    return NextResponse.json({
      data: {
        success: true,
        offerNumber: updated.offer_number,
        variant: body.selectedVariant,
        acceptedFee,
        acceptedAt: now,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
