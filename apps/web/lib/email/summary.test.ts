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
    expect(s!.kind).toBe('grant');
    expect(s!.amountLabel).toBe('Kwota dofinansowania:');
    expect(s!.amountValue).toContain('350');
    expect(s!.detailValue).toBe('Wariant II — Standard');
    expect(s!.totalValue).toContain('26');
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
    expect(s!.kind).toBe('loan');
    expect(s!.amountLabel).toBe('Wnioskowana kwota pożyczki:');
    expect(s!.amountValue).toContain('500');
    // Pożyczka nie ma wiersza pośredniego — szablon go pomija.
    expect(s!.detailLabel).toBeNull();
    expect(s!.totalValue).toContain('11');
  });

  it('pożyczka ze snapshotem dotacyjnym (przełączony typ) -> odtwarza cenę, nie blokuje wysyłki', () => {
    const s = buildOfferSummary({
      offer_kind: 'loan',
      pricing_snapshot: grantSnapshot,
      project_value: 200_000,
      selected_variant: 'I',
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('loan');
    // 4000 + 1,5% z 200 000 = 7000
    expect(s!.totalValue.replace(/\s/g, '')).toContain('7000');
  });

  it('zakres 2: kwota przyznana + stawka miesięczna + łącznie za okres', () => {
    const s = buildOfferSummary({
      offer_kind: 'exec',
      pricing_snapshot: { kind: 'exec', grantAmount: 2_000_000, monthlyFee: 3000, months: 18, total: 54_000 },
      project_value: 2_000_000,
      selected_variant: 'I',
    });
    expect(s!.kind).toBe('exec');
    expect(s!.amountLabel).toBe('Kwota przyznanego dofinansowania:');
    expect(s!.amountValue).toContain('2');
    expect(s!.detailLabel).toBe('Wynagrodzenie:');
    expect(s!.detailValue).toContain('miesięcznie');
    expect(s!.totalLabel).toBe('Łącznie za 18 mies.:');
    expect(s!.totalValue.replace(/\s/g, '')).toContain('54000');
  });

  it('zakres 2 ze snapshotem dotacyjnym (przełączony typ) -> odtwarza cenę, nie blokuje wysyłki', () => {
    const s = buildOfferSummary({
      offer_kind: 'exec',
      pricing_snapshot: grantSnapshot,
      project_value: 900_000,
      selected_variant: 'I',
    });
    expect(s).not.toBeNull();
    expect(s!.kind).toBe('exec');
    // domyślne 3 000 zł × 12 mies. = 36 000
    expect(s!.totalValue.replace(/\s/g, '')).toContain('36000');
  });

  it('nieznany offer_kind traktujemy jak dotację (starsza oferta, ręczna edycja)', () => {
    const s = buildOfferSummary({
      offer_kind: 'cos-nowego',
      pricing_snapshot: grantSnapshot,
      project_value: 500_000,
      selected_variant: 'I',
    });
    expect(s!.kind).toBe('grant');
  });

  it('project_value jako string (numeric z Postgresa)', () => {
    const s = buildOfferSummary({
      offer_kind: 'loan',
      pricing_snapshot: {},
      project_value: '300000.00',
      selected_variant: 'I',
    });
    expect(s!.totalValue.replace(/\s/g, '')).toContain('8500'); // 4000 + 4500
  });
});
