/**
 * GET /api/public/offers/[token]/pdf (BACKEND_SPEC.md v1.1.1, sekcja 9.1).
 *
 * Cache-or-render:
 * 1. Walidacja oferty po tokenie (status, expires, deleted).
 * 2. Klucz cache: `{offerNumber}_{pricingSnapshotHash}.pdf`.
 * 3. Hit → stream z bucket'u.
 * 4. Miss → render przez puppeteer (Vercel: sparticuz, dev: LOCAL_CHROME_PATH),
 *    zapis do bucket'u, stream do klienta.
 *
 * Event `pdf_downloaded` logujemy zawsze (cache hit/miss) — analytics ile razy
 * klient pobierał PDF.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { fetchPublicOffer } from '@/lib/offers/public';
import { pricingSnapshotHash, pdfStorageKey } from '@/lib/pdf/hash';
import { getCachedPdf, putCachedPdf } from '@/lib/pdf/storage';
import { renderOfferPdf } from '@/lib/pdf/render';
import { signPdfBypass } from '@/lib/pdf-bypass';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashIp, getClientIp } from '@/lib/ip-hash';
import type { Json } from '@k2/database/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30; // sek; Vercel Pro limit

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const { offer } = await fetchPublicOffer(params.token);

    const hash = pricingSnapshotHash(offer.pricing_snapshot, offer.content);
    const key = pdfStorageKey(offer.offer_number, hash);

    let bytes: ArrayBuffer | Uint8Array;
    let cacheHit = false;

    const cached = await getCachedPdf(key);
    if (cached.exists) {
      bytes = cached.bytes;
      cacheHit = true;
    } else {
      // Render przez puppeteer. URL = nasz własny endpoint z print=true + HMAC bypass.
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      const { sig, ts } = await signPdfBypass(params.token);
      const printUrl =
        `${baseUrl}/o/${encodeURIComponent(params.token)}` +
        `?print=true&__pdfBypass=${encodeURIComponent(sig)}&__pdfTs=${ts}`;

      try {
        bytes = await renderOfferPdf({ url: printUrl });
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.startsWith('PDF_NOT_CONFIGURED')) {
          throw new ApiError(
            'INTERNAL_ERROR',
            'Generowanie PDF jest tymczasowo niedostępne.',
            503,
            { reason: msg },
          );
        }
        throw e;
      }

      // Zapisz do cache (best-effort — błąd zapisu nie blokuje response).
      try {
        await putCachedPdf(key, bytes);
      } catch (e) {
        console.error('[pdf] cache put failed:', (e as Error).message);
      }
    }

    // Event log (best-effort) — wzbogacony o cacheHit/byteSize
    void logPdfEvent(req, offer.id, { cacheHit, bytes: (bytes as ArrayBuffer).byteLength });

    const buf =
      bytes instanceof Uint8Array
        ? Buffer.from(bytes.buffer as ArrayBuffer, bytes.byteOffset, bytes.byteLength)
        : Buffer.from(bytes);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(buf.byteLength),
        'Content-Disposition': `inline; filename="${offer.offer_number.replace(/[/\\?#]/g, '_')}.pdf"`,
        // Code review PR #4: `no-store` zamiast `private, max-age=300`. Stary header
        // pozwalał przeglądarce serwować nieaktualny PDF do 5 min po edycji oferty
        // (cache invalidation w bucket'cie był OK, ale browser cache przebijał).
        // Dla dokumentów handlowych z wymiarem prawnym (cennik, warunki) stale
        // content jest niedopuszczalny. Bucket cache po stronie serwera załatwia
        // performance — browser cache nie jest tu potrzebny.
        'Cache-Control': 'no-store, max-age=0',
        'X-Pdf-Cache': cacheHit ? 'hit' : 'miss',
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

async function logPdfEvent(
  req: NextRequest,
  offerId: string,
  payload: { cacheHit: boolean; bytes: number },
): Promise<void> {
  try {
    const sb = createAdminClient();
    const { hash, version } = await hashIp(getClientIp(req.headers));
    await sb.from('offer_events').insert({
      offer_id: offerId,
      type: 'pdf_downloaded',
      payload: payload as unknown as Json,
      actor_id: null,
      actor_type: 'client',
      ip_hash: hash,
      ip_salt_version: version,
      user_agent: req.headers.get('user-agent') ?? null,
    });
  } catch (e) {
    console.error('[pdf] event log failed:', (e as Error).message);
  }
}
