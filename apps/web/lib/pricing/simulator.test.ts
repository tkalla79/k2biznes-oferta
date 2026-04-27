/**
 * Testy `simulatePricing` (BACKEND_SPEC.md sekcja 5.2 + 6).
 */
import { describe, it, expect } from 'vitest';
import { simulatePricing } from './simulator';
import type { PricingConfig, PricingSegment } from './types';

const SEGMENTS: PricingSegment[] = [
  { id: 's5m', label: '2M-5M', fundingMin: 2_000_000, fundingMax: 5_000_000, baseFee: 15_000,
    sfVariant1: 0.045, sfVariant2: 0.055, sfVariant3: 0.07, monthlyFee: 4_000, displayOrder: 1 },
];
const CFG: PricingConfig = {
  loyaltyDiscount: 0.20, multiDiscount: 0.20, minSfAmount: 35_000, minBaseFee: 6_000,
};

const baseInput = { projectValue: 4_000_000, fundingRate: 0.65 };

describe('simulatePricing', () => {
  it('zwraca 3 warianty I/II/III + rekomendację', () => {
    const r = simulatePricing({ ...baseInput, probability: 0.5 }, SEGMENTS, CFG);
    expect(r.variants.map((v) => v.id)).toEqual(['I', 'II', 'III']);
    expect(['I', 'II', 'III']).toContain(r.recommendedVariantId);
  });

  it('EV = base gdy P=0', () => {
    const r = simulatePricing({ ...baseInput, probability: 0 }, SEGMENTS, CFG);
    for (const v of r.variants) {
      expect(v.expectedValue).toBe(v.base);
    }
  });

  it('EV = base + sfAmount + monthly*months gdy P=1', () => {
    const r = simulatePricing({ ...baseInput, probability: 1, monthsExec: 18 }, SEGMENTS, CFG);
    for (const v of r.variants) {
      const expected = v.base + v.sfAmount + v.monthly * 18;
      expect(v.expectedValue).toBe(expected);
    }
  });

  it('rekomendacja przy P=1 to wariant z najwyższym total (Wariant III dla s5m)', () => {
    const r = simulatePricing({ ...baseInput, probability: 1 }, SEGMENTS, CFG);
    expect(r.recommendedVariantId).toBe('III');
  });

  it('rekomendacja przy P=0 to dowolny (wszystkie EV=base — pierwszy w iteracji)', () => {
    const r = simulatePricing({ ...baseInput, probability: 0 }, SEGMENTS, CFG);
    // Wszystkie warianty mają taki sam base (z calcPricing), więc reduce trzyma pierwszy.
    expect(r.recommendedVariantId).toBe('I');
  });

  it('break-even P jest w (0,1) dla typowych wariantów', () => {
    const r = simulatePricing({ ...baseInput, probability: 0.5 }, SEGMENTS, CFG);
    for (const v of r.variants) {
      expect(v.breakEvenProbability).toBeGreaterThan(0);
      expect(v.breakEvenProbability).toBeLessThanOrEqual(1);
    }
  });

  it('rzuca dla probability poza [0, 1]', () => {
    expect(() =>
      simulatePricing({ ...baseInput, probability: -0.1 }, SEGMENTS, CFG),
    ).toThrow();
    expect(() =>
      simulatePricing({ ...baseInput, probability: 1.1 }, SEGMENTS, CFG),
    ).toThrow();
  });

  it('uwzględnia loyalty discount', () => {
    const noLoyal = simulatePricing({ ...baseInput, probability: 0.5 }, SEGMENTS, CFG);
    const loyal = simulatePricing(
      { ...baseInput, probability: 0.5, returningClient: true },
      SEGMENTS,
      CFG,
    );
    expect(loyal.variants[0].base).toBeLessThan(noLoyal.variants[0].base);
  });
});
