/**
 * Zod schematy dla `/api/public/offers/[token]/*` (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Klient (przeglądarka) wysyła te payloady bez sesji — walidacja po stronie
 * serwera jest jedyną warstwą. Pola PII trzymamy minimalne: tylko to, co
 * wymagane do procesu (imię, email, opcjonalny komentarz).
 */
import { z } from 'zod';

const PricingVariantId = z.enum(['I', 'II', 'III', 'IV']);
const PublicEventType = z.enum([
  'viewed',
  'scroll_depth',
  'variant_hovered',
  'variant_selected',
  'pdf_downloaded',
  'link_shared',
]);

// =============================================================================
// POST /api/public/offers/:token/events
// =============================================================================

export const PublicEventInput = z.object({
  type: PublicEventType,
  payload: z.record(z.string(), z.unknown()).default({}),
});
export type PublicEventInput = z.infer<typeof PublicEventInput>;

// =============================================================================
// POST /api/public/offers/:token/accept (BACKEND_SPEC.md sekcja 5.3 + 11.6)
// =============================================================================

export const AcceptOfferInput = z.object({
  selectedVariant: PricingVariantId,
  clientName: z.string().min(1).max(200),
  clientEmail: z.string().email().max(200),
  comment: z.string().max(2000).optional(),
  acceptedGdpr: z.literal(true, {
    errorMap: () => ({ message: 'Wymagana zgoda RODO (acceptedGdpr=true).' }),
  }),
  // Wersja klauzuli, którą klient widział na stronie. Backend porównuje z
  // aktualną w `gdpr_clauses` — niezgodność → 422 GDPR_CLAUSE_MISMATCH.
  gdprClauseVersion: z.string().min(1).max(80),
});
export type AcceptOfferInput = z.infer<typeof AcceptOfferInput>;

// =============================================================================
// POST /api/public/offers/:token/reject
// =============================================================================

export const RejectOfferInput = z.object({
  clientName: z.string().min(1).max(200),
  clientEmail: z.string().email().max(200).optional(),
  reason: z.string().max(2000).optional(),
});
export type RejectOfferInput = z.infer<typeof RejectOfferInput>;
