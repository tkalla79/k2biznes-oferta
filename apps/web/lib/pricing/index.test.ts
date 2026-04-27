/**
 * Testy silnika pricing (BACKEND_SPEC.md v1.1.1 sekcja 6.1 + Appendix C.4).
 *
 * SEGMENTS odzwierciedlają stan `supabase/seed.sql`:
 * - s5m ma pełne wartości z testów spec'a (jedyny pewny segment).
 * - pozostałe mają placeholder 0/0/0/0/0 — dla tych testujemy fallback do floor
 *   (`min_sf_amount` i `min_base_fee` w pricing_config).
 */
import { describe, it, expect } from 'vitest';
import {
  calcPricing,
  expectedValue,
  pickSegment,
  type PricingConfig,
  type PricingSegment,
} from './index';

const SEGMENTS: PricingSegment[] = [
  { id: 's500k',   label: 'do 500 tys. (mikro)',  fundingMin: 0,        fundingMax: 500_000,    baseFee: 0,      sfVariant1: 0,      sfVariant2: 0,      sfVariant3: 0,      monthlyFee: 0,    displayOrder: 1 },
  { id: 's1m',     label: '500 tys. – 1M',         fundingMin: 500_000,  fundingMax: 1_000_000,  baseFee: 0,      sfVariant1: 0,      sfVariant2: 0,      sfVariant3: 0,      monthlyFee: 0,    displayOrder: 2 },
  { id: 's2m',     label: '1M – 2M',                fundingMin: 1_000_000,fundingMax: 2_000_000,  baseFee: 0,      sfVariant1: 0,      sfVariant2: 0,      sfVariant3: 0,      monthlyFee: 0,    displayOrder: 3 },
  { id: 's5m',     label: '2M – 5M (SMART MŚP)',   fundingMin: 2_000_000,fundingMax: 5_000_000,  baseFee: 15_000, sfVariant1: 0.0450, sfVariant2: 0.0550, sfVariant3: 0.0700, monthlyFee: 4_000,displayOrder: 4 },
  { id: 's5mplus', label: '5M+',                    fundingMin: 5_000_000,fundingMax: null,       baseFee: 0,      sfVariant1: 0,      sfVariant2: 0,      sfVariant3: 0,      monthlyFee: 0,    displayOrder: 5 },
];

const CFG: PricingConfig = {
  loyaltyDiscount: 0.20,
  multiDiscount: 0.20,
  minSfAmount: 35_000,
  minBaseFee: 6_000,
};

// =============================================================================
// pickSegment — granice
// =============================================================================

describe('pickSegment', () => {
  it.each([
    [0, 's500k'],
    [499_999, 's500k'],
    [500_000, 's1m'],   // boundary — fundingMin inclusive
    [999_999.99, 's1m'],
    [1_000_000, 's2m'],
    [1_999_999, 's2m'],
    [2_000_000, 's5m'],
    [4_999_999, 's5m'],
    [5_000_000, 's5mplus'],
    [50_000_000, 's5mplus'], // null fundingMax łapie wszystko
  ])('funding=%d → %s', (funding, expectedId) => {
    expect(pickSegment(funding, SEGMENTS).id).toBe(expectedId);
  });

  it('throws gdy SEGMENTS pusty', () => {
    expect(() => pickSegment(1_000_000, [])).toThrow(/empty segments/);
  });

  it('shuffled segments — sortowanie po displayOrder działa', () => {
    const shuffled = [...SEGMENTS].reverse();
    expect(pickSegment(2_500_000, shuffled).id).toBe('s5m');
  });
});

// =============================================================================
// calcPricing — golden case z sekcji 6.1
// =============================================================================

describe('calcPricing — sekcja 6.1', () => {
  it('s5m · 4M @ 65% · klient niewracający', () => {
    const r = calcPricing({ projectValue: 4_000_000, fundingRate: 0.65 }, SEGMENTS, CFG);
    expect(r.funding).toBe(2_600_000);
    expect(r.segment.id).toBe('s5m');
    expect(r.base).toBe(15_000);
    expect(r.variants[0].sfAmount).toBeCloseTo(117_000, 0); // 2.6M × 4.5%
    expect(r.variants[0].total).toBe(132_000);
    expect(r.variants[1].sfAmount).toBeCloseTo(143_000, 0); // 2.6M × 5.5%
    expect(r.variants[2].sfAmount).toBeCloseTo(182_000, 0); // 2.6M × 7.0%
  });

  it('min_sf_amount floor — small funding wpada w s500k', () => {
    const r = calcPricing({ projectValue: 300_000, fundingRate: 0.6 }, SEGMENTS, CFG);
    expect(r.funding).toBe(180_000);
    expect(r.segment.id).toBe('s500k');
    // s500k ma sf_var1=0 i base=0 — wszystko z floor
    expect(r.variants[0].sfAmount).toBe(35_000); // min_sf_amount floor
    expect(r.base).toBe(6_000); // min_base_fee floor
  });

  it('loyalty discount obniża base o 20%', () => {
    // 4M @ 65% = 2.6M → s5m (jedyny segment z faktycznym base_fee w seedzie)
    const baseLine = calcPricing({ projectValue: 4_000_000, fundingRate: 0.65 }, SEGMENTS, CFG).base;
    const loyal = calcPricing(
      { projectValue: 4_000_000, fundingRate: 0.65, returningClient: true },
      SEGMENTS,
      CFG,
    ).base;
    expect(baseLine).toBe(15_000);
    expect(loyal).toBe(12_000); // 15000 * 0.8
  });
});

// =============================================================================
// Multi-project clamp (Appendix C.4 — Wariant A)
// =============================================================================

describe('calcPricing — multi-project clamp (Appendix C.4 Wariant A)', () => {
  const baseInput = { projectValue: 4_000_000, fundingRate: 0.65 };
  const baseRef = 15_000;

  it.each([
    [1, baseRef], // brak rabatu
    [2, baseRef * 0.8], // 12000 (1 step)
    [3, baseRef * 0.6], // 9000 (2 steps)
    [4, Math.max(6_000, baseRef * 0.4)], // 6000 — clamp 3 steps + floor
    [5, Math.max(6_000, baseRef * 0.4)], // 6000 — clamp 3 steps + floor (NIE 0.2x)
  ])('projectCount=%d → base=%d', (projectCount, expected) => {
    const r = calcPricing({ ...baseInput, projectCount }, SEGMENTS, CFG);
    expect(r.base).toBe(expected);
  });

  it('clamp chroni przed redukcją do zera dla projectCount=5', () => {
    const r = calcPricing({ ...baseInput, projectCount: 5 }, SEGMENTS, CFG);
    // bez clampa byłoby base * (1 - 0.20*4) = 0.2*base = 3000 < min
    // z clampem 3 steps: base * (1 - 0.6) = 0.4*base = 6000 (== min, ale przez clamp nie floor)
    expect(r.base).toBeGreaterThanOrEqual(CFG.minBaseFee);
  });
});

// =============================================================================
// calcPricing — walidacja inputu
// =============================================================================

describe('calcPricing — walidacja', () => {
  it('rzuca dla projectValue ≤ 0', () => {
    expect(() => calcPricing({ projectValue: 0, fundingRate: 0.5 }, SEGMENTS, CFG)).toThrow();
    expect(() => calcPricing({ projectValue: -100, fundingRate: 0.5 }, SEGMENTS, CFG)).toThrow();
  });

  it('rzuca dla fundingRate poza (0, 1]', () => {
    expect(() => calcPricing({ projectValue: 1_000_000, fundingRate: 0 }, SEGMENTS, CFG)).toThrow();
    expect(() => calcPricing({ projectValue: 1_000_000, fundingRate: 1.5 }, SEGMENTS, CFG)).toThrow();
  });
});

// =============================================================================
// Variant IV — poza standardową tabelą segmentów
// =============================================================================

describe('calcPricing — wariant IV', () => {
  it('wariant IV nie jest w default output (sekcja 3.2.7 — brak sf_variant_4)', () => {
    const r = calcPricing({ projectValue: 4_000_000, fundingRate: 0.65 }, SEGMENTS, CFG);
    expect(r.variants.map((v) => v.id)).toEqual(['I', 'II', 'III']);
  });
});

// =============================================================================
// expectedValue
// =============================================================================

describe('expectedValue', () => {
  it('liniowy wkład sukcesu', () => {
    const r = calcPricing({ projectValue: 4_000_000, fundingRate: 0.65 }, SEGMENTS, CFG);
    const v1 = r.variants[0];
    // EV = base + sfAmount*P + monthly*months*P
    // = 15000 + 117000*1 + 4000*18*1 = 15000 + 117000 + 72000 = 204000
    expect(expectedValue({ variant: v1, probability: 1.0, monthsExec: 18 })).toBeCloseTo(204_000, 0);

    // P=0 → tylko base (kontrakt)
    expect(expectedValue({ variant: v1, probability: 0 })).toBe(v1.base);

    // P=0.5
    const ev = expectedValue({ variant: v1, probability: 0.5, monthsExec: 18 });
    expect(ev).toBeCloseTo(15_000 + 117_000 * 0.5 + 4_000 * 18 * 0.5, 0);
  });

  it('rzuca dla probability poza [0,1]', () => {
    const r = calcPricing({ projectValue: 4_000_000, fundingRate: 0.65 }, SEGMENTS, CFG);
    expect(() => expectedValue({ variant: r.variants[0], probability: -0.1 })).toThrow();
    expect(() => expectedValue({ variant: r.variants[0], probability: 1.5 })).toThrow();
  });
});
