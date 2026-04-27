/**
 * POST /api/public/offers/[token]/events (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Loguje event klienta. Wywoływane z przeglądarki (po załadowaniu strony,
 * przy scrollu, hoverze wariantu, kliknięciu PDF). Rate-limit 100 req/min/IP
 * jest egzekwowany przez middleware.
 *
 * Dedup: pierwszy `viewed` ustawia `first_viewed_at`, kolejne tylko bumpują
 * `view_count` i `last_viewed_at`. Status `sent` → `viewed` na pierwszym view.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { fetchPublicOffer } from '@/lib/offers/public';
import { PublicEventInput } from '@/lib/validation/public-offers';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashIp, getClientIp } from '@/lib/ip-hash';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = PublicEventInput.parse(await req.json());
    const { offer } = await fetchPublicOffer(params.token);

    const ip = getClientIp(req.headers);
    const { hash: ipHash, version: saltVersion } = await hashIp(ip);
    const userAgent = req.headers.get('user-agent') ?? null;

    const sb = createAdminClient();

    // Insert eventu (bez actor_id — klient nie ma konta)
    const { error: eventErr } = await sb.from('offer_events').insert({
      offer_id: offer.id,
      type: body.type,
      payload: body.payload as Json,
      actor_id: null,
      actor_type: 'client',
      ip_hash: ipHash,
      ip_salt_version: saltVersion,
      user_agent: userAgent,
    });

    if (eventErr) {
      throw new ApiError('INTERNAL_ERROR', `event insert failed: ${eventErr.message}`, 500);
    }

    // Side effects dla `viewed` — atomic bump (sekcja 5.3, fix race z code review PR #2).
    // SQL function `bump_offer_view_count` aktualizuje view_count, last_viewed_at,
    // first_viewed_at i ewentualnie status w jednej transakcji.
    if (body.type === 'viewed') {
      const isFirst = !offer.first_viewed_at;
      const { error: rpcErr } = await sb.rpc('bump_offer_view_count', {
        p_offer_id: offer.id,
      });
      if (rpcErr) {
        // Nie blokujemy klienta — event się zapisał. Logujemy błąd.
        console.error('[events] view counter bump failed:', rpcErr.message);
      }

      return NextResponse.json({ data: { ok: true, firstView: isFirst } });
    }

    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return handleError(e);
  }
}
