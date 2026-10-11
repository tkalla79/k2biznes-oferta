import { describe, it, expect } from 'vitest';
import { formatSfPct } from './percent';

describe('formatSfPct', () => {
  it('nie gubi drugiego miejsca po przecinku', () => {
    // Sedno błędu: toFixed(1) robiło z 9,06% → 9,1%, więc procent i kwota
    // w złotych przestawały się zgadzać przy przeliczeniu na kartce.
    expect(formatSfPct(0.0906)).toBe('9,06');
    expect(formatSfPct(0.0455)).toBe('4,55');
  });

  it('obcina zbędne zera', () => {
    expect(formatSfPct(0.06)).toBe('6');
    expect(formatSfPct(0.045)).toBe('4,5');
    expect(formatSfPct(0.1)).toBe('10');
  });

  it('używa polskiego przecinka, nie kropki', () => {
    expect(formatSfPct(0.055)).toBe('5,5');
    expect(formatSfPct(0.055)).not.toContain('.');
  });

  it('zaokrągla dopiero na trzecim miejscu', () => {
    expect(formatSfPct(0.090649)).toBe('9,06');
    expect(formatSfPct(0.090651)).toBe('9,07');
  });

  it('zero i wartości niepoprawne nie wywalają renderu', () => {
    expect(formatSfPct(0)).toBe('0');
    expect(formatSfPct(Number.NaN)).toBe('0');
    expect(formatSfPct(Number.POSITIVE_INFINITY)).toBe('0');
  });
});
