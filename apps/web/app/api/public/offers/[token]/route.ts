/**
 * GET /api/public/offers/[token] (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Public — bez auth. Dostęp przez 24-bajtowy token (192 bity entropii).
 * Service role omija RLS (sekcja 4.2). Cache-Control: no-store.
 *
 * Event `viewed` NIE jest tu logowany — GET musi być idempotentny.
 * Klient strony robi osobny `POST /events` po załadowaniu DOM.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError } from '@/lib/api/error';
import { fetchPublicOffer } from '@/lib/offers/public';
import { toPublicOfferDto } from '@/lib/offers/mapper';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { offer } = await fetchPublicOffer(params.token);

    // Embed contact_person + case_study (równolegle).
    const sb = createAdminClient();
    const [contactRes, caseRes] = await Promise.all([
      offer.contact_person_id
        ? sb.from('contact_persons').select('*').eq('id', offer.contact_person_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      offer.case_study_id
        ? sb.from('case_studies').select('*').eq('id', offer.case_study_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const dto = toPublicOfferDto(
      offer,
      contactRes.error ? null : contactRes.data,
      caseRes.error ? null : caseRes.data,
    );

    return NextResponse.json(
      { data: dto },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (e) {
    return handleError(e);
  }
}
