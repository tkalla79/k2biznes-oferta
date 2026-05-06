import { describe, it, expect } from 'vitest';
import {
  PricingOverrideSchema,
  applyOverride,
  parsePricingOverride,
  hasOverride,
  getOverriddenVariantIds,
} from './override';
import type { PricingResult } from './types';

const snapshot: PricingResult = {
  funding: 1_000_000,
  segment: {
    id: 'mid',
    label: 'Mid',
    fundingMin: 500_000,
    fundingMax: 2_000_000,
    baseFee: 12_000,
    sfVariant1: 0.04,
    sfVariant2: 0.06,
    sfVariant3: 0.08,
    monthlyFee: 5000,
    displayOrder: 2,
  },
  base: 12_000,
  variants: [
    {
      id: 'I',
      name: 'Standard',
      tag: '',
      base: 12_000,
      sfPct: 0.04,
      sfAmount: 40_000,
      monthly: 5000,
      total: 52_000,
      payment: [{ pct: 50, when: 'po podpisaniu umowy' }],
    },
    {
      id: 'II',
      name: 'Premium',
      tag: '',
      base: 15_000,
      sfPct: 0.06,
      sfAmount: 60_000,
      monthly: 6000,
      total: 75_000,
      payment: [{ pct: 100, when: 'po decyzji' }],
    },
  ],
};

describe('PricingOverrideSchema', () => {
  it('akceptuje pusty obiekt', () => {
    expect(PricingOverrideSchema.safeParse({}).success).toBe(true);
  });

  it('akceptuje peÅ‚ny override z exec fee', () => {
    const ok = PricingOverrideSchema.safeParse({
      variants: { I: { base: 10000, sfPct: 0.05 } },
      execFee: { monthly: 7000, kicker: 'XXX' },
    });
    expect(ok.success).toBe(true);
  });

  it('odrzuca nieznane pola (strict)', () => {
    const r = PricingOverrideSchema.safeParse({ junk: true });
    expect(r.success).toBe(false);
  });

  it('odrzuca sfPct > 1', () => {
    const r = PricingOverrideSchema.safeParse({ variants: { I: { sfPct: 1.5 } } });
    expect(r.success).toBe(false);
  });

  it('odrzuca payment z >10 milestones', () => {
    const r = PricingOverrideSchema.safeParse({
      variants: {
        I: {
          payment: Array.from({ length: 11 }).map(() => ({ pct: 9, when: 'x' })),
        },
      },
    });
    expect(r.success).toBe(false);
  });
});

describe('applyOverride', () => {
  it('zwraca snapshot bez zmian gdy override pusty', () => {
    expect(applyOverride(snapshot, null)).toBe(snapshot);
    expect(applyOverride(snapshot, {})).toBe(snapshot);
  });

  it('nadpisuje base i przelicza total', () => {
    const result = applyOverride(snapshot, { variants: { I: { base: 20_000 } } });
    const v = result.variants.find((x) => x.id === 'I')!;
    expect(v.base).toBe(20_000);
    expect(v.sfPct).toBe(0.04); // bez zmiany
    expect(v.sfAmount).toBe(40_000);
    expect(v.total).toBe(60_000); // 20k + 40k
  });

  it('nadpisuje sfPct i przelicza sfAmount + total', () => {
    const result = applyOverride(snapshot, { variants: { I: { sfPct: 0.1 } } });
    const v = result.variants.find((x) => x.id === 'I')!;
    expect(v.sfPct).toBe(0.1);
    expect(v.sfAmount).toBe(100_000);
    expect(v.total).toBe(112_000); // 12k + 100k
  });

  it('nadpisuje monthly bez wpÅ‚ywu na total', () => {
    const result = applyOverride(snapshot, { variants: { I: { monthly: 9999 } } });
    const v = result.variants.find((x) => x.id === 'I')!;
    expect(v.monthly).toBe(9999);
    expect(v.total).toBe(52_000); // bez zmiany
  });

  it('nadpisuje payment milestones', () => {
    const result = applyOverride(snapshot, {
      variants: {
        I: {
          payment: [
            { pct: 30, when: 'umowa' },
            { pct: 70, when: 'finalizacja' },
          ],
        },
      },
    });
    const v = result.variants.find((x) => x.id === 'I')!;
    expect(v.payment).toHaveLength(2);
    expect(v.payment[0].pct).toBe(30);
  });

  it('nie modyfikuje wariantÃ³w bez override', () => {
    const result = applyOverride(snapshot, { variants: { I: { base: 1 } } });
    const ii = result.variants.find((x) => x.id === 'II')!;
    expect(ii.base).toBe(15_000);
    expect(ii.total).toBe(75_000);
  });
});

describe('parsePricingOverride', () => {
  it('zwraca null dla null/undefined/non-object', () => {
    expect(parsePricingOverride(null)).toBeNull();
    expect(parsePricingOverride(undefined)).toBeNull();
    expect(parsePricingOverride('foo')).toBeNull();
    expect(parsePricingOverride(42)).toBeNull();
  });

  it('zwraca null dla bÅ‚Ä™dnego ksztaÅ‚tu', () => {
    // strict() na top-level rejects unknown keys
    expect(parsePricingOverride({ variants: {}, junk: 1 })).toBeNull();
    // sfPct out of range
    expect(parsePricingOverride({ variants: { I: { sfPct: 9 } } })).toBeNull();
  });

  it('parsuje poprawny override', () => {
    const r = parsePricingOverride({ variants: { I: { base: 1000 } } });
    expect(r?.variants?.I?.base).toBe(1000);
  });

  it('parsuje pusty obiekt jako brak override', () => {
    expect(parsePricingOverride({})).toEqual({});
  });
});

describe('hasOverride', () => {
  it('false dla null/empty', () => {
    expect(hasOverride(null)).toBe(false);
    expect(hasOverride({})).toBe(false);
    expect(hasOverride({ variants: {} })).toBe(false);
    expect(hasOverride({ variants: { I: {} } })).toBe(false);
  });

  it('true gdy variants.I ma pole', () => {
    expect(hasOverride({ variants: { I: { base: 1 } } })).toBe(true);
  });

  it('true gdy execFee ma pole', () => {
    expect(hasOverride({ execFee: { monthly: 1 } })).toBe(true);
  });
});

describe('getOverriddenVariantIds', () => {
  it('lista wariantÃ³w z override', () => {
    const ids = getOverriddenVariantIds({
      variants: { I: { base: 1 }, II: {}, III: { sfPct: 0.05 } },
    });
    expect(ids).toEqual(['I', 'III']);
  });

  it('pusta lista gdy brak override', () => {
    expect(getOverriddenVariantIds(null)).toEqual([]);
    expect(getOverriddenVariantIds({})).toEqual([]);
  });
});
