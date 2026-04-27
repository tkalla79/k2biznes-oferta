/**
 * /api/offers — list + create (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { handleError, Errors, ApiError } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { calcPricing } from '@/lib/pricing';
import { loadPricing } from '@/lib/pricing/load';
import {
  CreateOfferInput,
  ListOffersQuery,
  SORT_FIELDS,
  SORT_COLUMN_MAP,
} from '@/lib/validation/offers';
import { toOfferDto } from '@/lib/offers/mapper';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// =============================================================================
// GET /api/offers — lista
// =============================================================================

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const url = new URL(req.url);
    const query = ListOffersQuery.parse(Object.fromEntries(url.searchParams));

    // Walidacja sort fields — białą listą
    for (const { field } of query.sort) {
      if (!SORT_FIELDS.has(field)) {
        throw new ApiError('VALIDATION_ERROR', `Pole sortowania nieobsługiwane: ${field}`, 422, {
          allowed: Array.from(SORT_FIELDS),
        });
      }
    }

    const sb = createAdminClient();

    // Bazowe query — soft delete out
    let q = sb
      .from('offers')
      .select('*', { count: 'exact' })
      .is('deleted_at', null);

    // Scope wg roli (RLS robi to samo, ale tu jawnie żeby liczba/total był dokładny)
    if (session.role === 'consultant') {
      q = q.or(`created_by.eq.${session.userId},assigned_consultant_id.eq.${session.userId}`);
    }
    // admin/super_admin — bez filtra ownership

    // Filtry
    if (query.status?.length) q = q.in('status', query.status);
    if (query.clientName) q = q.ilike('client_name', `%${query.clientName}%`);
    if (query.programId) q = q.eq('program_id', query.programId);
    if (query.createdBy) q = q.eq('created_by', query.createdBy);

    // Sort
    for (const { field, dir } of query.sort) {
      q = q.order(SORT_COLUMN_MAP[field], { ascending: dir === 'asc' });
    }

    // Paginacja
    const from = (query.page - 1) * query.pageSize;
    const to = from + query.pageSize - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({
      data: (data ?? []).map((row) => toOfferDto(row, appUrl)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: count ?? 0,
        hasMore: (count ?? 0) > query.page * query.pageSize,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

// =============================================================================
// POST /api/offers — create
// =============================================================================

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const body = CreateOfferInput.parse(await req.json());

    // Walidacja: selectedVariant musi być w offeredVariants
    if (!body.offeredVariants.includes(body.selectedVariant)) {
      throw new ApiError(
        'VALIDATION_ERROR',
        '`selectedVariant` musi być w `offeredVariants`.',
        422,
      );
    }

    // Wylicz pricing snapshot
    const { segments, config } = await loadPricing();
    const pricingSnapshot = calcPricing(
      {
        projectValue: body.projectValue,
        fundingRate: body.fundingRate,
        returningClient: body.returningClient,
        projectCount: body.projectCount,
      },
      segments,
      config,
    );

    const sb = createAdminClient();

    // Generuj offer_number przez SQL function (sekcja 5.3 + B12)
    const { data: numData, error: numErr } = await sb.rpc('next_offer_number');
    if (numErr || !numData) {
      throw new ApiError('INTERNAL_ERROR', `next_offer_number failed: ${numErr?.message}`, 500);
    }

    // Insert
    const { data: inserted, error: insErr } = await sb
      .from('offers')
      .insert({
        offer_number: numData as unknown as string,
        status: 'draft',
        created_by: session.userId,
        assigned_consultant_id: body.assignedConsultantId ?? null,
        contact_person_id: body.contactPersonId ?? null,
        client_name: body.clientName,
        client_nip: body.clientNip ?? null,
        client_industry: body.clientIndustry ?? null,
        client_company_size: body.clientCompanySize ?? null,
        client_voivodeship: body.clientVoivodeship ?? null,
        program_id: body.programId ?? null,
        program_label: body.programLabel,
        program_custom_name: body.programCustomName ?? null,
        project_value: body.projectValue,
        funding_rate: body.fundingRate,
        returning_client: body.returningClient,
        project_count: body.projectCount,
        pricing_snapshot: pricingSnapshot as unknown as Json,
        selected_variant: body.selectedVariant,
        offered_variants: body.offeredVariants,
        case_study_id: body.caseStudyId ?? null,
        content: body.content as Json,
      })
      .select()
      .single();

    if (insErr || !inserted) {
      throw new ApiError('INTERNAL_ERROR', `insert offer failed: ${insErr?.message}`, 500);
    }

    // Event log + audit (best-effort, nie blokują response)
    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: inserted.id,
        type: 'created',
        actor_id: session.userId,
        actor_type: session.role === 'consultant' ? 'consultant' : 'admin',
        payload: { offerNumber: inserted.offer_number },
      }),
      logAudit({
        action: 'offer.create',
        resourceType: 'offer',
        resourceId: inserted.id,
        actorId: session.userId,
        actorEmail: session.email,
        after: { status: inserted.status, offer_number: inserted.offer_number },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json(
      { data: toOfferDto(inserted, appUrl) },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof z.ZodError) return handleError(e);
    return handleError(e);
  }
}
