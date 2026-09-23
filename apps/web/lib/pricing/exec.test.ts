import { describe, it, expect } from 'vitest';
import {
  calcExecPricing,
  isExecPricing,
  resolveExecPricing,
  EXEC_MONTHLY_FEE,
  EXEC_MONTHS,
  EXEC_MONTHS_MAX,
} from './exec';

describe('calcExecPricing', () => {
  it('domyślne stawki: 3 000 zł × 12 mies.', () => {
    const r = calcExecPricing({ grantAmount: 2_000_000 });
    expect(r.kind).toBe('exec');
    expect(r.monthlyFee).toBe(EXEC_MONTHLY_FEE);
    expect(r.months).toBe(EXEC_MONTHS);
    expect(r.total).toBe(36_000);
  });

  it('stawka i okres negocjowane per oferta', () => {
    const r = calcExecPricing({ grantAmount: 800_000, monthlyFee: 2500, months: 24 });
    expect(r.total).toBe(60_000);
  });

  it('kwota dofinansowania nie wchodzi do wzoru — jest tłem oferty', () => {
    const a = calcExecPricing({ grantAmount: 500_000, monthlyFee: 3000, months: 10 });
    const b = calcExecPricing({ grantAmount: 50_000_000, monthlyFee: 3000, months: 10 });
    expect(a.total).toBe(b.total);
    expect(a.grantAmount).not.toBe(b.grantAmount);
  });

  it('odrzuca kwotę dofinansowania <= 0', () => {
    expect(() => calcExecPricing({ grantAmount: 0 })).toThrow(/grantAmount/);
    expect(() => calcExecPricing({ grantAmount: -1 })).toThrow(/grantAmount/);
  });

  it('odrzuca ujemną stawkę', () => {
    expect(() => calcExecPricing({ grantAmount: 100_000, monthlyFee: -1 })).toThrow(/monthlyFee/);
  });

  it('odrzuca okres spoza zakresu i niecałkowity', () => {
    expect(() => calcExecPricing({ grantAmount: 100_000, months: 0 })).toThrow(/months/);
    expect(() => calcExecPricing({ grantAmount: 100_000, months: EXEC_MONTHS_MAX + 1 })).toThrow(
      /months/,
    );
    expect(() => calcExecPricing({ grantAmount: 100_000, months: 12.5 })).toThrow(/months/);
  });

  it('stawka 0 jest dozwolona (obsługa gratis przy innej umowie)', () => {
    expect(calcExecPricing({ grantAmount: 100_000, monthlyFee: 0, months: 6 }).total).toBe(0);
  });
});

describe('isExecPricing', () => {
  it('rozróżnia snapshot exec od pożyczkowego i dotacyjnego', () => {
    expect(isExecPricing(calcExecPricing({ grantAmount: 100_000 }))).toBe(true);
    expect(isExecPricing({ kind: 'loan' } as never)).toBe(false);
    expect(isExecPricing({ variants: [] } as never)).toBe(false);
    expect(isExecPricing(null)).toBe(false);
    expect(isExecPricing(undefined)).toBe(false);
  });
});

describe('resolveExecPricing', () => {
  it('kompletny snapshot przechodzi bez zmian', () => {
    const snap = calcExecPricing({ grantAmount: 1_000_000, monthlyFee: 2800, months: 18 });
    expect(resolveExecPricing(snap, 1_000_000)).toEqual(snap);
  });

  it('pusty snapshot odtwarza się z kwoty oferty i wartości domyślnych', () => {
    const r = resolveExecPricing(null, 750_000);
    expect(r.grantAmount).toBe(750_000);
    expect(r.monthlyFee).toBe(EXEC_MONTHLY_FEE);
    expect(r.months).toBe(EXEC_MONTHS);
    expect(r.total).toBe(EXEC_MONTHLY_FEE * EXEC_MONTHS);
  });

  it('snapshot po przełączeniu typu oferty (kształt pożyczkowy) nie wywala renderu', () => {
    const r = resolveExecPricing({ kind: 'loan', loanAmount: 500_000, baseFee: 4000 }, 900_000);
    expect(r.kind).toBe('exec');
    expect(r.grantAmount).toBe(900_000);
    expect(r.total).toBe(EXEC_MONTHLY_FEE * EXEC_MONTHS);
  });

  it('brakujący total liczy się ze stawki i okresu', () => {
    const r = resolveExecPricing({ monthlyFee: 2000, months: 9 }, 100_000);
    expect(r.total).toBe(18_000);
  });

  it('śmieciowy okres z ręcznej edycji jest klamrowany do sensownego zakresu', () => {
    expect(resolveExecPricing({ months: 0 }, 100_000).months).toBe(1);
    expect(resolveExecPricing({ months: 999 }, 100_000).months).toBe(EXEC_MONTHS_MAX);
    expect(resolveExecPricing({ months: 11.6 }, 100_000).months).toBe(12);
  });
});
