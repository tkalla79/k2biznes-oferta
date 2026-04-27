/**
 * K2Biznes pricing engine — port z BACKEND_SPEC.md v1.1.1 sekcja 6
 * (+ Appendix C.4 multi-project clamp Wariant A).
 *
 * Pure function — żadnych side-effects, żadnego I/O. Konsumuje SEGMENTS i
 * CONFIG przekazane z DB przez `load.ts`. Wynik (`PricingResult`) jest
 * zamrażany jako `offers.pricing_snapshot` (sekcja 3.2.3) — re-kalkulacja
 * tylko przez `POST /api/offers/:id/recalculate`.
 */
import type {
  PricingConfig,
  PricingInput,
  PricingResult,
  PricingSegment,
  PricingVariant,
} from './types';

export * from './types';

/**
 * Pick segmentu po wartości dofinansowania.
 * - `funding < segment.fundingMax` (exclusive) — granica górna otwarta.
 * - `fundingMax === null` traktowane jako infinity → ostatni segment łapie wszystko.
 * - Fallback: gdy nic nie pasuje, ostatni segment (zachowanie defensive).
 */
export function pickSegment(funding: number, segments: PricingSegment[]): PricingSegment {
  if (segments.length === 0) {
    throw new Error('pickSegment: empty segments — Appendix C wymaga seedu');
  }
  const sorted = [...segments].sort((a, b) => a.displayOrder - b.displayOrder);
  return (
    sorted.find((s) => funding >= s.fundingMin && (s.fundingMax == null || funding < s.fundingMax)) ??
    sorted[sorted.length - 1]
  );
}

/**
 * Liczba projektów wyższa niż 1 daje rabat na `base`. Spec Appendix C.4 ma dwa
 * warianty:
 *   A (rekomendowany): liniowy, clampowany do (n-1) ≤ 3 → max 60% redukcji
 *   B: geometryczny `pow(1 - d, n-1)` → max 41% redukcji dla n=5
 *
 * Implementujemy A.
 */
function multiDiscountFactor(projectCount: number, multiDiscount: number): number {
  const n = Math.max(1, Math.min(5, projectCount));
  const cappedSteps = Math.min(n - 1, 3);
  return 1 - multiDiscount * cappedSteps;
}

const VARIANT_TEMPLATE: Array<{
  id: PricingVariant['id'];
  name: string;
  tag: string;
  payment: PricingVariant['payment'];
}> = [
  {
    id: 'I',
    name: 'Wariant I',
    tag: 'Szybka płatność',
    payment: [
      { pct: 50, when: 'po ogłoszeniu wyników' },
      { pct: 50, when: 'po podpisaniu umowy' },
    ],
  },
  {
    id: 'II',
    name: 'Wariant II',
    tag: 'Rozłożony SF',
    payment: [
      { pct: 50, when: 'po ogłoszeniu wyników' },
      { pct: 25, when: 'przy zaliczce / refundacji' },
      { pct: 25, when: 'po podpisaniu umowy' },
    ],
  },
  {
    id: 'III',
    name: 'Wariant III',
    tag: '12 rat',
    payment: [
      { pct: 25, when: 'po ogłoszeniu wyników' },
      { pct: 25, when: 'po podpisaniu umowy' },
      { pct: 50, when: 'w 12 ratach po umowie' },
    ],
  },
];

export function calcPricing(
  input: PricingInput,
  segments: PricingSegment[],
  config: PricingConfig,
): PricingResult {
  const { projectValue, fundingRate, returningClient = false, projectCount = 1 } = input;

  if (!Number.isFinite(projectValue) || projectValue <= 0) {
    throw new Error('calcPricing: projectValue must be > 0');
  }
  if (!Number.isFinite(fundingRate) || fundingRate <= 0 || fundingRate > 1) {
    throw new Error('calcPricing: fundingRate must be in (0, 1]');
  }

  const funding = projectValue * fundingRate;
  const segment = pickSegment(funding, segments);

  // base fee z rabatami + floor
  let base = segment.baseFee;
  if (returningClient) base *= 1 - config.loyaltyDiscount;
  if (projectCount > 1) base *= multiDiscountFactor(projectCount, config.multiDiscount);
  base = Math.max(config.minBaseFee, Math.round(base / 100) * 100);

  const sfPctByVariant: Record<PricingVariant['id'], number> = {
    I: segment.sfVariant1,
    II: segment.sfVariant2,
    III: segment.sfVariant3,
    IV: 0, // sekcja 3.2.7 nie definiuje sf_variant_4 — IV poza tabelą cenową
  };

  const variants: PricingVariant[] = VARIANT_TEMPLATE.map((tpl) => {
    const sfPct = sfPctByVariant[tpl.id];
    const sfAmount = Math.max(config.minSfAmount, funding * sfPct);
    return {
      id: tpl.id,
      name: tpl.name,
      tag: tpl.tag,
      sfPct,
      sfAmount,
      base,
      monthly: segment.monthlyFee,
      total: base + sfAmount,
      payment: tpl.payment,
    };
  });

  return { funding, segment, base, variants };
}

/**
 * Expected value (EV) wariantu — używane w simulator (sekcja 5.2 + admin dashboard).
 *
 *   EV = base + sfAmount * P + monthlyFee * monthsExec * P
 *
 * `base` zawsze otrzymujemy (kontrakt), `sfAmount` i `monthly` warunkowo
 * od sukcesu projektu (probability `P`).
 */
export function expectedValue(args: {
  variant: PricingVariant;
  probability: number;
  monthsExec?: number;
}): number {
  const { variant, probability, monthsExec = 18 } = args;
  if (probability < 0 || probability > 1) {
    throw new Error('expectedValue: probability must be in [0, 1]');
  }
  return variant.base + variant.sfAmount * probability + (variant.monthly ?? 0) * monthsExec * probability;
}
