/**
 * Regresja do błędu z 2026-11-05: kwota decyzji liczona z surowego snapshotu
 * zamiast z tego, co klient widział po nałożeniu ręcznego cennika.
 */
import { describe, expect, it } from 'vitest';
import { resolveAcceptedBreakdown, AcceptedVariantMissingError } from './accepted';
import type { PricingResult } from './types';

const variant = (id: 'I' | 'II' | 'III', sfPct: number, base: number, monthly: number) => ({
  id,
  name: `Wariant ${id}`,
  tag: '',
  sfPct,
  sfAmount: Math.round(1_050_000 * sfPct),
  base,
  monthly,
  total: base + Math.round(1_050_000 * sfPct),
  payment: [],
});

// Odwzorowanie oferty K2/2026/10/017: segment „1M – 2M", funding 1 050 000.
const snapshot = {
  funding: 1_050_000,
  segment: { id: 'seg', label: '1M – 2M' },
  base: 12_000,
  variants: [variant('I', 0.05, 12_000, 3_000), variant('II', 0.06, 12_000, 3_000), variant('III', 0.07, 12_000, 3_000)],
} as unknown as PricingResult;

// Cennik ręczny: SF 6%, opłata wstępna 8 000, miesięczna 2 000.
const manualOverride = {
  variants: { III: { base: 8_000, sfPct: 0.06, monthly: 2_000 } },
};

describe('resolveAcceptedBreakdown — dotacja', () => {
  it('cennik ręczny wygrywa z siatką segmentów', () => {
    // Przed poprawką wychodziło 73 500 (7% z siatki) zamiast 63 000 (6% ręczne).
    const r = resolveAcceptedBreakdown({ snapshot, override: manualOverride, variantId: 'III' });
    expect(r.fee).toBe(63_000);
    expect(r.variant).toEqual({
      id: 'III',
      name: 'Wariant III',
      base: 8_000,
      sfPct: 0.06,
      sfAmount: 63_000,
      monthly: 2_000,
      total: 71_000,
    });
  });

  it('bez override — wartości ze snapshotu', () => {
    const r = resolveAcceptedBreakdown({ snapshot, override: null, variantId: 'III' });
    expect(r.fee).toBe(73_500);
    expect(r.variant?.base).toBe(12_000);
  });

  it('override innego wariantu nie rusza zaakceptowanego', () => {
    const r = resolveAcceptedBreakdown({
      snapshot,
      override: { variants: { I: { sfPct: 0.01 } } },
      variantId: 'III',
    });
    expect(r.fee).toBe(73_500);
  });

  it('częściowy override — nadpisane tylko to, co podane', () => {
    const r = resolveAcceptedBreakdown({
      snapshot,
      override: { variants: { III: { base: 8_000 } } },
      variantId: 'III',
    });
    expect(r.variant).toMatchObject({ base: 8_000, sfPct: 0.07, sfAmount: 73_500 });
  });

  it('śmieci w override nie wywracają decyzji — wracamy do snapshotu', () => {
    const r = resolveAcceptedBreakdown({ snapshot, override: { cos: 'zlego' }, variantId: 'III' });
    expect(r.fee).toBe(73_500);
  });

  it('brak wariantu w snapshocie = błąd, nie kwota z sufitu', () => {
    expect(() =>
      resolveAcceptedBreakdown({ snapshot, override: null, variantId: 'IV' as 'III' }),
    ).toThrow(AcceptedVariantMissingError);
    expect(() => resolveAcceptedBreakdown({ snapshot, override: null, variantId: null })).toThrow(
      AcceptedVariantMissingError,
    );
  });
});

describe('resolveAcceptedBreakdown — pożyczka i zakres 2', () => {
  it('pożyczka: całość wynagrodzenia, override bez znaczenia', () => {
    const loan = { kind: 'loan', loanAmount: 500_000, baseFee: 4_000, sfPct: 0.015, sfAmount: 7_500, total: 11_500 };
    const r = resolveAcceptedBreakdown({ snapshot: loan, override: manualOverride, variantId: null });
    expect(r).toEqual({ fee: 11_500, variant: null });
  });

  it('zakres 2: stawka miesięczna × okres', () => {
    const exec = { kind: 'exec', grantAmount: 1_000_000, monthlyFee: 3_000, months: 12, total: 36_000 };
    const r = resolveAcceptedBreakdown({ snapshot: exec, override: null, variantId: null });
    expect(r).toEqual({ fee: 36_000, variant: null });
  });
});
