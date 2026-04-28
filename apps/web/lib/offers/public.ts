/**
 * Public offer loader — fetch po `client_token` (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Wszystkie endpointy `/api/public/*` używają service role (sekcja 4.2 — anon
 * dostaje deny-all przez RLS). Token to 24-bajtowy random base64url, więc
 * brute-force jest niewykonalny.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { ApiError, Errors } from '@/lib/api/error';
import type { OfferRow } from '@/lib/offers/mapper';

export type PublicOfferContext = {
  offer: OfferRow;
  /** Czy oferta jest aktywna (nie wygasła, nie odrzucona, nie zaakceptowana). */
  isActive: boolean;
};

/**
 * Pobiera ofertę po tokenie i sprawdza, czy klient może ją zobaczyć.
 *
 * Reguły:
 * - `deleted_at` not null → 404 OFFER_NOT_FOUND
 * - `expires_at < now()` → 410 OFFER_EXPIRED
 * - status `draft` → 404 (klient nie powinien widzieć drafta — jeszcze nie wysłany)
 * - status `accepted`/`rejected`/`expired` → zwracamy ofertę, ale `isActive=false`
 *   (frontend pokaże read-only summary; nie można już akceptować/odrzucać)
 */
export async function fetchPublicOffer(
  token: string,
  opts: { allowDraft?: boolean } = {},
): Promise<PublicOfferContext> {
  if (!token || token.length < 20) {
    throw Errors.notFound('Niepoprawny token oferty.');
  }

  const sb = createAdminClient();
  const { data, error } = await sb
    .from('offers')
    .select('*')
    .eq('client_token', token)
    .maybeSingle();

  if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
  if (!data || data.deleted_at) throw Errors.notFound();

  if (data.status === 'draft' && !opts.allowDraft) {
    // Konsultant jeszcze nie wysłał — token istnieje, ale link nieaktywny.
    // `allowDraft` = preview konsultanta z sesji (sprawdzane przez caller).
    throw Errors.notFound('Oferta jeszcze nie została wysłana.');
  }

  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    throw Errors.expired();
  }

  const isActive = data.status === 'sent' || data.status === 'viewed';
  return { offer: data, isActive };
}

/**
 * Wymaga, by oferta była aktywna (`sent`/`viewed`) — używane w accept/reject.
 */
export async function fetchActiveOffer(token: string): Promise<OfferRow> {
  const ctx = await fetchPublicOffer(token);
  if (!ctx.isActive) {
    throw Errors.conflictStatus(
      `Operacja niedozwolona dla statusu ${ctx.offer.status}.`,
    );
  }
  return ctx.offer;
}
