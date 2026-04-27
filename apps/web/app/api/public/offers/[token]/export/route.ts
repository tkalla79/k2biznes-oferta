/**
 * POST /api/public/offers/[token]/export (BACKEND_SPEC.md v1.1.1, sekcja 11.5).
 *
 * RODO art. 15 — prawo dostępu klienta końcowego (bez konta). Klient po
 * podaniu emaila i tokenu oferty otrzymuje JSON ze wszystkimi swoimi danymi,
 * jakie znajdują się na ofercie.
 *
 * Walidacja: email z body musi się zgadzać z `offers.accepted_by_email`. Bez
 * tego ktokolwiek z tokenem mógłby pobrać dane innego klienta.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, Errors, ApiError } from '@/lib/api/error';
import { fetchPublicOffer } from '@/lib/offers/public';
import { ExportRequestInput } from '@/lib/validation/rodo';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = ExportRequestInput.parse(await req.json());
    const { offer } = await fetchPublicOffer(params.token);

    if (!offer.accepted_by_email || offer.accepted_by_email !== body.email) {
      // Świadomie zwracamy ten sam błąd co dla "klient nie zaakceptował" — żeby
      // atakujący nie mógł odróżnić istniejącego email'a od nieistniejącego.
      throw Errors.notFound('Brak danych do eksportu dla tego adresu.');
    }

    const sb = createAdminClient();
    const { data: events } = await sb
      .from('offer_events')
      .select('type, payload, created_at')
      .eq('offer_id', offer.id)
      .order('created_at', { ascending: true });

    const exportPayload = {
      offer: {
        offer_number: offer.offer_number,
        client_name: offer.client_name,
        program_label: offer.program_label,
        project_value: Number(offer.project_value),
        funding_rate: Number(offer.funding_rate),
        accepted_variant: offer.accepted_variant,
        accepted_fee: offer.accepted_fee == null ? null : Number(offer.accepted_fee),
        accepted_by_name: offer.accepted_by_name,
        accepted_by_email: offer.accepted_by_email,
        client_comment: offer.client_comment,
        accepted_at: offer.accepted_at,
        rejected_at: offer.rejected_at,
        gdpr_clause_version: offer.gdpr_clause_version,
        gdpr_accepted_at: offer.gdpr_accepted_at,
      },
      events: events ?? [],
      exported_at: new Date().toISOString(),
      legal_basis: 'art. 15 RODO',
    };

    const filename = `k2biznes-export-${offer.offer_number.replace(/[/\\]/g, '_')}.json`;
    return new NextResponse(JSON.stringify(exportPayload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
