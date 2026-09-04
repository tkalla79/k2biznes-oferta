import { describe, expect, it } from 'vitest';
import { UpdatePricingInput } from './pricing';

const seg = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 's1',
  label: 'Segment',
  fundingMin: 0,
  fundingMax: 1_000_000,
  baseFee: 15000,
  sfVariant1: 0.045,
  sfVariant2: 0.055,
  sfVariant3: 0.07,
  monthlyFee: 3000,
  displayOrder: 1,
  ...over,
});

const config = {
  loyaltyDiscount: 0.2,
  multiDiscount: 0.2,
  minSfAmount: 35000,
  minBaseFee: 6000,
};

const parse = (segments: unknown[]) => UpdatePricingInput.parse({ segments, config });
const fail = (segments: unknown[]) => {
  try {
    UpdatePricingInput.parse({ segments, config });
    return null;
  } catch (e) {
    return (e as { issues: { message: string }[] }).issues.map((i) => i.message).join(' | ');
  }
};

describe('UpdatePricingInput', () => {
  it('przyjmuje spójne widełki od zera do bez limitu', () => {
    const r = parse([
      seg({ id: 'a', fundingMin: 0, fundingMax: 1_000_000, displayOrder: 1 }),
      seg({ id: 'b', fundingMin: 1_000_000, fundingMax: null, displayOrder: 2 }),
    ]);
    expect(r.segments).toHaveLength(2);
  });

  it('odrzuca dziurę między segmentami', () => {
    const msg = fail([
      seg({ id: 'a', fundingMin: 0, fundingMax: 1_000_000, displayOrder: 1 }),
      seg({ id: 'b', fundingMin: 1_200_000, fundingMax: null, displayOrder: 2 }),
    ]);
    expect(msg).toContain('Dziura albo nachodzenie widełek');
  });

  it('odrzuca nachodzące widełki', () => {
    const msg = fail([
      seg({ id: 'a', fundingMin: 0, fundingMax: 1_000_000, displayOrder: 1 }),
      seg({ id: 'b', fundingMin: 800_000, fundingMax: null, displayOrder: 2 }),
    ]);
    expect(msg).toContain('Dziura albo nachodzenie widełek');
  });

  it('wymaga startu od zera', () => {
    expect(fail([seg({ fundingMin: 100, fundingMax: null })])).toContain('musi zaczynać się od 0');
  });

  it('wymaga braku górnej granicy w ostatnim segmencie', () => {
    expect(fail([seg({ fundingMax: 1_000_000 })])).toContain('bez górnej granicy');
  });

  it('nie pozwala na brak granicy w środkowym segmencie', () => {
    const msg = fail([
      seg({ id: 'a', fundingMin: 0, fundingMax: null, displayOrder: 1 }),
      seg({ id: 'b', fundingMin: 1_000_000, fundingMax: null, displayOrder: 2 }),
    ]);
    expect(msg).toContain('tylko ostatni segment');
  });

  it('odrzuca odwrócone widełki', () => {
    const msg = fail([
      seg({ id: 'a', fundingMin: 0, fundingMax: 500_000, displayOrder: 1 }),
      seg({ id: 'b', fundingMin: 500_000, fundingMax: 400_000, displayOrder: 2 }),
      seg({ id: 'c', fundingMin: 400_000, fundingMax: null, displayOrder: 3 }),
    ]);
    expect(msg).toContain('większa od dolnej');
  });

  it('odrzuca duplikaty id i kolejności', () => {
    expect(
      fail([
        seg({ id: 'a', fundingMin: 0, fundingMax: 1_000_000, displayOrder: 1 }),
        seg({ id: 'a', fundingMin: 1_000_000, fundingMax: null, displayOrder: 2 }),
      ]),
    ).toContain('Zduplikowany identyfikator');
  });

  it('odrzuca procent poza zakresem 0-1 (ułamek, nie liczba procentowa)', () => {
    expect(() =>
      UpdatePricingInput.parse({ segments: [seg({ fundingMax: null, sfVariant1: 4.5 })], config }),
    ).toThrow();
  });

  it('odrzuca ujemne kwoty', () => {
    expect(() =>
      UpdatePricingInput.parse({ segments: [seg({ fundingMax: null, baseFee: -1 })], config }),
    ).toThrow();
  });
});
