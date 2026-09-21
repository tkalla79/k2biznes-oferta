/**
 * Silnik cenowy dla ofert na sam zakres 2 (tryb `exec`).
 *
 * Model (ustalenia 2026-09): wyłącznie stała stawka miesięczna za obsługę i
 * rozliczanie projektu, który ma już decyzję o dofinansowaniu. BEZ opłaty
 * wstępnej, BEZ wariantów i BEZ success fee — nie pozyskujemy tu środków,
 * tylko prowadzimy projekt, więc nie ma od czego liczyć wynagrodzenia
 * wynikowego.
 *
 * Kwota przyznanego dofinansowania jest w ofercie tłem (skala projektu,
 * który obsługujemy), a nie podstawą naliczania — dlatego nie wchodzi do
 * żadnego wzoru.
 *
 * Pure function, bez I/O i bez segmentów (inaczej niż dotacyjne `calcPricing`).
 * Wynik zapisywany jako `offers.pricing_snapshot` z `kind: 'exec'`.
 */
import type { ExecPricingInput, ExecPricingResult, OfferPricingResult } from './types';

/** Domyślna stawka miesięczna — ta sama, co część miesięczna w ofercie dotacyjnej. */
export const EXEC_MONTHLY_FEE = 3000;
/** Domyślny okres obsługi, gdy konsultant go nie poda. */
export const EXEC_MONTHS = 12;
/** Górna granica okresu: realizacja + trwałość potrafią zejść się w 10 lat. */
export const EXEC_MONTHS_MAX = 120;

export function calcExecPricing(input: ExecPricingInput): ExecPricingResult {
  const grantAmount = input.grantAmount;
  const monthlyFee = input.monthlyFee ?? EXEC_MONTHLY_FEE;
  const months = input.months ?? EXEC_MONTHS;

  if (!Number.isFinite(grantAmount) || grantAmount <= 0) {
    throw new Error('calcExecPricing: grantAmount must be > 0');
  }
  if (!Number.isFinite(monthlyFee) || monthlyFee < 0) {
    throw new Error('calcExecPricing: monthlyFee must be >= 0');
  }
  if (!Number.isInteger(months) || months < 1 || months > EXEC_MONTHS_MAX) {
    throw new Error(`calcExecPricing: months must be an integer in [1, ${EXEC_MONTHS_MAX}]`);
  }

  const total = Math.round(monthlyFee * months * 100) / 100;

  return { kind: 'exec', grantAmount, monthlyFee, months, total };
}

/** Type guard: rozróżnia snapshot zakresu 2 od dotacyjnego i pożyczkowego. */
export function isExecPricing(p: OfferPricingResult | null | undefined): p is ExecPricingResult {
  return !!p && (p as ExecPricingResult).kind === 'exec';
}

/**
 * Odtwarza cennik zakresu 2 dla oferty, w której `offer_kind='exec'`.
 *
 * Tak jak przy pożyczce: źródłem prawdy o typie oferty jest kolumna
 * `offer_kind`, a nie kształt snapshotu. Snapshot bywa niekompletny (oferta
 * przełączona między typami, ręczna edycja w Studio, starsza oferta), więc
 * brakujące liczby odtwarzamy z kwoty oferty i wartości domyślnych — zamiast
 * pokazywać klientowi ofertę bez cennika albo wywalać render.
 */
export function resolveExecPricing(
  snapshot: unknown,
  grantAmountFallback: number,
): ExecPricingResult {
  const s = (snapshot ?? {}) as Partial<ExecPricingResult>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;

  const grantAmount = num(s.grantAmount) ?? grantAmountFallback;
  const monthlyFee = num(s.monthlyFee) ?? EXEC_MONTHLY_FEE;
  const rawMonths = num(s.months) ?? EXEC_MONTHS;
  // Snapshot z ręcznej edycji potrafi mieć ułamek albo zero — klamrujemy do
  // zakresu, w którym `total` ma sens.
  const months = Math.min(Math.max(Math.round(rawMonths), 1), EXEC_MONTHS_MAX);
  const total = num(s.total) ?? Math.round(monthlyFee * months * 100) / 100;

  return { kind: 'exec', grantAmount, monthlyFee, months, total };
}
