import { describe, expect, it } from 'vitest';
import { calcLoanPricing, isLoanPricing, resolveLoanPricing, LOAN_BASE_FEE, LOAN_SF_PCT } from './loan';

describe('calcLoanPricing', () => {
  it('używa stawek domyślnych (4000 + 1,5%)', () => {
    const r = calcLoanPricing({ loanAmount: 500_000 });
    expect(r.kind).toBe('loan');
    expect(r.baseFee).toBe(LOAN_BASE_FEE);
    expect(r.sfPct).toBe(LOAN_SF_PCT);
    expect(r.sfAmount).toBe(7500); // 1,5% z 500 000
    expect(r.total).toBe(11_500); // 4000 + 7500
  });

  it('honoruje nadpisane stawki per oferta', () => {
    const r = calcLoanPricing({ loanAmount: 200_000, baseFee: 2000, sfPct: 0.02 });
    expect(r.baseFee).toBe(2000);
    expect(r.sfAmount).toBe(4000); // 2% z 200 000
    expect(r.total).toBe(6000);
  });

  it('zaokrągla do groszy', () => {
    // 333 333 * 1,5% = 4999,995 -> 5000,00 (zaokrąglenie do groszy)
    const r = calcLoanPricing({ loanAmount: 333_333, sfPct: 0.015 });
    expect(r.sfAmount).toBe(5000);
    expect(r.total).toBe(9000);
  });

  it('odrzuca kwoty niepoprawne', () => {
    expect(() => calcLoanPricing({ loanAmount: 0 })).toThrow();
    expect(() => calcLoanPricing({ loanAmount: -1 })).toThrow();
    expect(() => calcLoanPricing({ loanAmount: 100, sfPct: 1.5 })).toThrow();
    expect(() => calcLoanPricing({ loanAmount: 100, baseFee: -5 })).toThrow();
  });

  it('isLoanPricing rozróżnia snapshoty', () => {
    const loan = calcLoanPricing({ loanAmount: 100_000 });
    expect(isLoanPricing(loan)).toBe(true);
    expect(isLoanPricing({ funding: 1, segment: {} as never, base: 1, variants: [] })).toBe(false);
    expect(isLoanPricing(null)).toBe(false);
  });
});

describe('resolveLoanPricing (odporność na niekompletny snapshot)', () => {
  it('używa liczb ze pełnego snapshotu pożyczkowego', () => {
    const snap = calcLoanPricing({ loanAmount: 500_000 });
    const r = resolveLoanPricing(snap, 999);
    expect(r).toEqual(snap);
  });

  it('snapshot dotacyjny (bez pól pożyczkowych) -> odtwarza z kwoty oferty i stawek domyślnych', () => {
    const grantSnap = { funding: 350_000, base: 15_000, variants: [{ id: 'I' }] };
    const r = resolveLoanPricing(grantSnap, 500_000);
    expect(r.kind).toBe('loan');
    expect(r.loanAmount).toBe(500_000);
    expect(r.baseFee).toBe(LOAN_BASE_FEE);
    expect(r.sfPct).toBe(LOAN_SF_PCT);
    expect(r.sfAmount).toBe(7500);
    expect(r.total).toBe(11_500);
  });

  it('pusty / null snapshot nie rzuca', () => {
    expect(() => resolveLoanPricing(null, 200_000)).not.toThrow();
    expect(resolveLoanPricing({}, 200_000).total).toBe(4000 + 3000);
  });

  it('częściowy snapshot: uzupełnia tylko brakujące pola', () => {
    const r = resolveLoanPricing({ baseFee: 2000, sfPct: 0.02 }, 200_000);
    expect(r.baseFee).toBe(2000);
    expect(r.sfPct).toBe(0.02);
    expect(r.sfAmount).toBe(4000);
    expect(r.total).toBe(6000);
  });
})
