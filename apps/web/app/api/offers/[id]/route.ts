/**
 * /api/offers/[id] — get + update + soft delete (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, Errors, ApiError } from '@/lib/api/error';
import { requireSession, type Session } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { calcPricing } from '@/lib/pricing';
import { loadPricing } from '@/lib/pricing/load';
import { UpdateOfferInput, shouldRecalcSnapshot } from '@/lib/validation/offers';
import { toOfferDto, type OfferRow } from '@/lib/offers/mapper';
import { deletePdfsForOffer } from '@/lib/pdf/storage';
import type { Database, Json } from '@k2/database/types';

type OffersUpdate = Database['public']['Tables']['offers']['Update'];

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// =============================================================================
// helpers
// =============================================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(id: string): void {
  if (!UUID_RE.test(id)) {
    throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
  }
}

async function fetchOfferOrThrow(id: string): Promise<OfferRow> {
  const sb = createAdminClient();
  const { data, error } = await sb.from('offers').select('*').eq('id', id).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
  if (!data || data.deleted_at) throw Errors.notFound('Oferta nie istnieje lub została usunięta.');
  return data;
}

function assertCanReadOffer(session: Session, row: OfferRow): void {
  if (session.role === 'admin' || session.role === 'super_admin') return;
  if (row.created_by === session.userId || row.assigned_consultant_id === session.userId) return;
  throw Errors.forbidden('Brak dostępu do tej oferty.');
}

function assertCanWriteOffer(session: Session, row: OfferRow): void {
  // Admin może wszystko.
  if (session.role === 'admin' || session.role === 'super_admin') return;
  // Konsultant tylko swoje + tylko gdy status edytowalny.
  if (row.created_by !== session.userId && row.assigned_consultant_id !== session.userId) {
    throw Errors.forbidden('Brak dostępu do tej oferty.');
  }
  if (!['draft', 'sent'].includes(row.status)) {
    throw Errors.conflictStatus(`Edycja zablokowana (status=${row.status}).`);
  }
}

// =============================================================================
// GET /api/offers/[id]
// =============================================================================

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id);
    const session = await requireSession();
    const row = await fetchOfferOrThrow(params.id);
    assertCanReadOffer(session, row);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ data: toOfferDto(row, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}

// =============================================================================
// PATCH /api/offers/[id]
// =============================================================================

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id);
    const session = await requireSession();
    const before = await fetchOfferOrThrow(params.id);
    assertCanWriteOffer(session, before);

    const patch = UpdateOfferInput.parse(await req.json());

    // Walidacja consistency (selectedVariant ⊂ offeredVariants)
    const nextOffered = patch.offeredVariants ?? before.offered_variants;
    const nextSelected = patch.selectedVariant ?? before.selected_variant;
    if (!nextOffered.includes(nextSelected)) {
      throw new ApiError(
        'VALIDATION_ERROR',
        '`selectedVariant` musi być w `offeredVariants`.',
        422,
      );
    }

    // Status: konsultant nie może go ręcznie zmieniać (przez dedykowane endpointy)
    if (patch.status && session.role === 'consultant') {
      throw Errors.forbidden('Zmiana statusu wymaga roli admin.');
    }

    // Mapowanie patch → DB columns
    const update: OffersUpdate = {};
    if (patch.clientName !== undefined) update.client_name = patch.clientName;
    if (patch.clientNip !== undefined) update.client_nip = patch.clientNip;
    if (patch.clientIndustry !== undefined) update.client_industry = patch.clientIndustry;
    if (patch.clientCompanySize !== undefined) update.client_company_size = patch.clientCompanySize;
    if (patch.clientVoivodeship !== undefined) update.client_voivodeship = patch.clientVoivodeship;
    if (patch.programId !== undefined) update.program_id = patch.programId;
    if (patch.programLabel !== undefined) update.program_label = patch.programLabel;
    if (patch.programCustomName !== undefined) update.program_custom_name = patch.programCustomName;
    if (patch.projectValue !== undefined) update.project_value = patch.projectValue;
    if (patch.fundingRate !== undefined) update.funding_rate = patch.fundingRate;
    if (patch.returningClient !== undefined) update.returning_client = patch.returningClient;
    if (patch.projectCount !== undefined) update.project_count = patch.projectCount;
    if (patch.selectedVariant !== undefined) update.selected_variant = patch.selectedVariant;
    if (patch.offeredVariants !== undefined) update.offered_variants = patch.offeredVariants;
    if (patch.caseStudyId !== undefined) update.case_study_id = patch.caseStudyId;
    if (patch.contactPersonId !== undefined) update.contact_person_id = patch.contactPersonId;
    if (patch.assignedConsultantId !== undefined)
      update.assigned_consultant_id = patch.assignedConsultantId;
    if (patch.content !== undefined) update.content = patch.content as Json;
    if (patch.pricingOverride !== undefined)
      update.pricing_override = patch.pricingOverride as unknown as Json;
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.expiresAt !== undefined) update.expires_at = patch.expiresAt;

    // Re-kalkulacja snapshotu jeśli zmiana wpływa na pricing.
    if (shouldRecalcSnapshot(patch)) {
      // H2 audit: pricing_snapshot jest IMMUTABLE po wysłaniu (BACKEND_SPEC 3.2.3).
      // Wcześniej zmiana projectValue/fundingRate na ofercie status='sent'
      // przeliczała snapshot po cichu → klient po refresh magic-linka widział
      // INNĄ cenę niż w mailu (kontraktowo niebezpieczne). Teraz: tylko draft
      // może auto-przeliczać. Dla sent/viewed/accepted/rejected → 409 + wskazanie
      // świadomego POST /recalculate (osobny audit entry z old/new).
      if (before.status !== 'draft') {
        throw new ApiError(
          'OFFER_INVALID_STATUS',
          `Wartości finansowe oferty są zamrożone po wysłaniu (status "${before.status}"). ` +
            `Użyj POST /api/offers/${params.id}/recalculate jeśli świadomie chcesz przeliczyć snapshot.`,
          409,
        );
      }
      const { segments, config } = await loadPricing();
      update.pricing_snapshot = calcPricing(
        {
          projectValue: patch.projectValue ?? Number(before.project_value),
          fundingRate: patch.fundingRate ?? Number(before.funding_rate),
          returningClient: patch.returningClient ?? before.returning_client,
          projectCount: patch.projectCount ?? before.project_count,
        },
        segments,
        config,
      ) as unknown as Json;
    }

    const sb = createAdminClient();
    const { data: updated, error } = await sb
      .from('offers')
      .update(update)
      .eq('id', params.id)
      .select()
      .single();

    if (error || !updated) {
      throw new ApiError('INTERNAL_ERROR', `update failed: ${error?.message}`, 500);
    }

    // Invalidate PDF cache jeśli snapshot/content/override się zmienił (sekcja 9.1 / 11.8).
    if (shouldRecalcSnapshot(patch) || patch.content !== undefined || patch.pricingOverride !== undefined) {
      void deletePdfsForOffer(updated.offer_number).catch((e) =>
        console.error('[patch] pdf invalidation failed:', e.message),
      );
    }

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: updated.id,
        type: 'updated',
        actor_id: session.userId,
        actor_type: session.role === 'consultant' ? 'consultant' : 'admin',
        payload: { fields: Object.keys(update) },
      }),
      logAudit({
        action: 'offer.update',
        resourceType: 'offer',
        resourceId: updated.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { status: before.status, fields: Object.keys(update) },
        after: { status: updated.status },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ data: toOfferDto(updated, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}

// =============================================================================
// DELETE /api/offers/[id] — soft delete (admin+)
// =============================================================================

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    assertUuid(params.id);
    const session = await requireSession();
    if (session.role !== 'admin' && session.role !== 'super_admin') {
      throw Errors.forbidden('Soft delete wymaga roli admin.');
    }
    const before = await fetchOfferOrThrow(params.id);

    const sb = createAdminClient();
    const { error } = await sb
      .from('offers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);

    await logAudit({
      action: 'offer.soft_delete',
      resourceType: 'offer',
      resourceId: params.id,
      actorId: session.userId,
      actorEmail: session.email,
      before: { status: before.status, offer_number: before.offer_number },
    });

    return NextResponse.json({ data: { ok: true, id: params.id } });
  } catch (e) {
    return handleError(e);
  }
}
