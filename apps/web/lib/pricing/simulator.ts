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

    // Break-even: EV = base_fee (gwarantowany przychód). Z definicji EV w spec'u 6:
    //   EV = base + sfAmount * P + monthly * monthsExec * P
    //   base = base + (sfAmount + monthly * monthsExec) * P_be
    //   0 = (sfAmount + monthly * monthsExec) * P_be
    // Powyższe daje break-even = 0 zawsze (base zawsze odzyskane).
    //
    // Bardziej użyteczna interpretacja: P, przy którym CAŁKOWITY oczekiwany
    // przychód `EV` osiąga totalny koszt wariantu (`v.total = base + sfAmount`).
    //   v.total = base + (sfAmount + monthly*monthsExec) * P_be
    //   P_be = (v.total - base) / (sfAmount + monthly*monthsExec)
    //        = sfAmount / (sfAmount + monthly*monthsExec)
    // To "P przy którym oczekiwany przychód = nominalna cena wariantu I".
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
