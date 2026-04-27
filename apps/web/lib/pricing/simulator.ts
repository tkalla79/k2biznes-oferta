/**
 * Pricing simulator — EV × P + break-even (BACKEND_SPEC.md v1.1.1, sekcja 5.2).
 *
 * Konsultant wpisuje hipotetyczne dane oferty + szacowane prawdopodobieństwo
 * sukcesu, dostaje:
 * - EV per wariant (z `lib/pricing.expectedValue`)
 * - Break-even probability (P przy którym EV = base_fee — czyli "guaranteed loss
 *   threshold" — jeśli P < tego, oferta jest stratna)
 * - Rekomendacja wariantu (max EV)
 */
import { calcPricing, expectedValue, type PricingConfig, type PricingSegment, type PricingVariant } from './index';

export type SimulatorInput = {
  projectValue: number;
  fundingRate: number;
  returningClient?: boolean;
  projectCount?: number;
  /** 0..1 — szacowane prawdopodobieństwo akceptacji oferty + sukcesu projektu. */
  probability: number;
  monthsExec?: number;
};

export type SimulatorVariantResult = {
  id: PricingVariant['id'];
  name: string;
  base: number;
  sfAmount: number;
  monthly: number;
  total: number;
  expectedValue: number;
  /** Próg P, przy którym EV ≥ base × 1 (bez sukcesu firma odzyskuje co najmniej base). */
  breakEvenProbability: number;
};

export type SimulatorResult = {
  funding: number;
  segment: PricingSegment;
  variants: SimulatorVariantResult[];
  recommendedVariantId: PricingVariant['id'];
};

export function simulatePricing(
  input: SimulatorInput,
  segments: PricingSegment[],
  config: PricingConfig,
): SimulatorResult {
  const { probability, monthsExec = 18 } = input;
  if (probability < 0 || probability > 1) {
    throw new Error('simulatePricing: probability must be in [0, 1]');
  }

  const calc = calcPricing(input, segments, config);

  const variants: SimulatorVariantResult[] = calc.variants.map((v) => {
    const ev = expectedValue({ variant: v, probability, monthsExec });

    // Break-even: P, przy którym oczekiwany przychód `EV` osiąga **pełny
    // teoretyczny przychód maksymalny** wariantu (gdy P=1):
    //   max_revenue = base + sfAmount + monthly*monthsExec
    //   EV(P_be)    = base + (sfAmount + monthly*monthsExec) * P_be
    //   max_revenue = base + (sfAmount + monthly*monthsExec) * P_be
    //   P_be        = (sfAmount + monthly*monthsExec) / (sfAmount + monthly*monthsExec) = 1
    // Powyższe trywialne — break-even = 1 zawsze. Nieużyteczne.
    //
    // Faktyczna interpretacja jakiej chcemy (PR #6 review fix): P przy którym
    // oczekiwany TOTAL revenue (włącznie z miesięcznymi) osiąga nominalną
    // cenę wariantu z perspektywy klienta. Nominalna cena = base + sfAmount
    // + monthly*monthsExec (pełna kwota gdyby projekt został zrealizowany).
    //
    // EV = base + (sfAmount + monthly*monthsExec) * P_be
    // base + sfAmount + monthly*monthsExec = base + (sfAmount + monthly*monthsExec) * P_be
    // P_be = 1
    //
    // Wracamy do oryginalnej intencji "P przy którym EV osiąga próg `total`
    // gdzie `total = base + sfAmount` (bez monthly)":
    //   total = base + (sfAmount + monthly*monthsExec) * P_be
    //   P_be  = (total - base) / (sfAmount + monthly*monthsExec)
    //         = sfAmount / (sfAmount + monthly*monthsExec)
    // Ta interpretacja prawidłowo uwzględnia monthly w mianowniku — variant III
    // (12 rat) ma niższy P_be niż wariant I dla tego samego sfAmount.
    //
    // UWAGA: ta wartość jest informacyjna (nie krytyczna decyzyjnie); konsultant
    // używa jej jako heurystyki "czy P > P_be opłaca się".
    const denom = v.sfAmount + (v.monthly ?? 0) * monthsExec;
    const breakEvenProbability = denom > 0 ? Math.min(1, v.sfAmount / denom) : 0;

    return {
      id: v.id,
      name: v.name,
      base: v.base,
      sfAmount: v.sfAmount,
      monthly: v.monthly,
      total: v.total,
      expectedValue: Math.round(ev),
      breakEvenProbability: Math.round(breakEvenProbability * 10000) / 10000,
    };
  });

  // Rekomendacja: max EV (jeśli remis — bierzemy najprostszy wariant z najmniejszym ID).
  const recommended = variants.reduce((best, v) => (v.expectedValue > best.expectedValue ? v : best));

  return {
    funding: calc.funding,
    segment: calc.segment,
    variants,
    recommendedVariantId: recommended.id,
  };
}
