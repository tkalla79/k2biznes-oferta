/**
 * Typ oferty — jedno miejsce na rozpoznanie wartości z kolumny `offers.offer_kind`.
 *
 * Kolumna jest `text` z checkiem po stronie bazy (nie enumem w typach), więc w
 * kodzie i tak trzeba ją zawęzić. Przy dwóch typach wystarczał ternary
 * `=== 'loan' ? 'loan' : 'grant'`; przy trzecim taki ternary po cichu zamieniał
 * `exec` w `grant` i oferta liczyła się złym silnikiem.
 */
export const OFFER_KINDS = ['grant', 'loan', 'exec'] as const;

export type OfferKind = (typeof OFFER_KINDS)[number];

/** Nieznana wartość (starsza oferta, ręczna edycja w Studio) → dotacja. */
export function normalizeOfferKind(value: unknown): OfferKind {
  return OFFER_KINDS.includes(value as OfferKind) ? (value as OfferKind) : 'grant';
}

/** Warianty I–IV, segmenty i intensywność ma wyłącznie oferta dotacyjna. */
export function hasVariants(kind: OfferKind): boolean {
  return kind === 'grant';
}
