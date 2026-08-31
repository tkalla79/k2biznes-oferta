import { describe, expect, it } from 'vitest';
import { buildOfferSummary } from './summary';

const grantSnapshot = {
  funding: 350_000,
  base: 12_000,
  segment: { id: 's500k' },
  variants: [
    { id: 'I', name: 'Wariant I', tag: 'Szybka płatność', total: 24_000 },
    { id: 'II', name: 'Wariant II', tag: 'Standard', total: 26_000 },
  ],
};

describe('buildOfferSummary', () => {
  it('dotacja: kwota dofinansowania + wybrany wariant', () => {
    const s = buildOfferSummary({
      offer_kind: 'grant',
      pricing_snapshot: grantSnapshot,
      project_value: 500_000,
      selected_variant: 'II',
    });
    expect(s).not.toBeNull();
    expect(s!.isLoan).toBe(false);
    expect(s!.fundingAmount).toContain('350');
    expect(s!.variantName).toBe('Wariant II — Standard');
    expect(s!.variantTotal).toContain('26');
  });

  it('dotacja: brak `variants` w snapshocie -> null (wysyłka blokowana)', () => {
    expect(
      buildOfferSummary({
        offer_kind: 'grant',
        pricing_snapshot: { kind: 'loan', total: 11_500 },
        project_value: 500_000,
        selected_variant: 'I',
      }),
    ).toBeNull();
    expect(
      buildOfferSummary({
        offer_kind: 'grant',
        pricing_snapshot: null,
        project_value: 500_000,
        selected_variant: 'I',
      }),
    ).toBeNull();
  });

  it('pożyczka: kwota pożyczki + łączne wynagrodzenie z snapshotu', () => {
    const s = buildOfferSummary({
      offer_kind: 'loan',
      pricing_snapshot: { kind: 'loan', loanAmount: 500_000, baseFee: 4000, sfPct: 0.015, sfAmount: 7500, total: 11_500 },
      project_value: 500_000,
      selected_variant: 'I',
    });
    expect(s!.isLoan).toBe(true);
    expect(s!.fundingAmount).toContain('500');
    expect(s!.variantTotal).toContain('11');
  });

  it('pożyczka ze snapshotem dotacyjnym (przełączony typ) -> odtwarza cenę, nie blokuje wysyłki', () => {
    const s = buildOfferSummary({
      offer_kind: 'loan',
      pricing_snapshot: grantSnapshot,
      project_value: 200_000,
      selected_variant: 'I',
    });
    expect(s).not.toBeNull();
    expect(s!.isLoan).toBe(true);
    // 4000 + 1,5% z 200 000 = 7000
    expect(s!.variantTotal.replace(/\s/g, '')).toContain('7000');
  });

  it('project_value jako string (numeric z Postgresa)', () => {
    const s = buildOfferSummary({
      offer_kind: 'loan',
      pricing_snapshot: {},
      project_value: '300000.00',
      selected_variant: 'I',
    });
    expect(s!.variantTotal.replace(/\s/g, '')).toContain('8500'); // 4000 + 4500
  });
});
