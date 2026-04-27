/**
 * Testy `pricingSnapshotHash` + `pdfStorageKey`.
 *
 * Inwarianty kluczowe:
 * - Stabilność dla tego samego inputu (cache hit musi być deterministyczny).
 * - Order-insensitive (klucze obiektu posortowane).
 * - Różne inputs → różny hash (collision-resistant w praktycznym zakresie).
 */
import { describe, it, expect } from 'vitest';
import { canonicalize, pricingSnapshotHash, pdfStorageKey } from './hash';

describe('canonicalize', () => {
  it('sortuje klucze obiektu', () => {
    const a = canonicalize({ b: 1, a: 2, c: 3 });
    expect(JSON.stringify(a)).toBe('{"a":2,"b":1,"c":3}');
  });

  it('rekursywnie dla zagnieżdżonych obiektów', () => {
    const a = canonicalize({ x: { z: 1, y: 2 }, w: 0 });
    expect(JSON.stringify(a)).toBe('{"w":0,"x":{"y":2,"z":1}}');
  });

  it('zachowuje kolejność tablic', () => {
    const a = canonicalize([3, 1, 2]);
    expect(JSON.stringify(a)).toBe('[3,1,2]');
  });

  it('null przepuszcza, undefined ignoruje', () => {
    const a = canonicalize({ a: null, b: undefined, c: 1 });
    expect(JSON.stringify(a)).toBe('{"a":null,"c":1}');
  });
});

describe('pricingSnapshotHash', () => {
  const snap = { funding: 2_600_000, segment: { id: 's5m', baseFee: 15000 } };
  const content = { intro: 'foo' };

  it('stabilny dla identycznego inputu', () => {
    const h1 = pricingSnapshotHash(snap, content);
    const h2 = pricingSnapshotHash(snap, content);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{16}$/);
  });

  it('niezależny od kolejności kluczy w obiekcie', () => {
    const h1 = pricingSnapshotHash(
      { funding: 1, segment: { id: 'a', baseFee: 1 } },
      { x: 1, y: 2 },
    );
    const h2 = pricingSnapshotHash(
      { segment: { baseFee: 1, id: 'a' }, funding: 1 },
      { y: 2, x: 1 },
    );
    expect(h1).toBe(h2);
  });

  it('zmiana funding → inny hash', () => {
    const h1 = pricingSnapshotHash(snap, content);
    const h2 = pricingSnapshotHash({ ...snap, funding: 2_700_000 }, content);
    expect(h1).not.toBe(h2);
  });

  it('zmiana content → inny hash', () => {
    const h1 = pricingSnapshotHash(snap, { intro: 'foo' });
    const h2 = pricingSnapshotHash(snap, { intro: 'bar' });
    expect(h1).not.toBe(h2);
  });

  it('null content vs empty object — różny hash', () => {
    expect(pricingSnapshotHash(snap, null)).not.toBe(pricingSnapshotHash(snap, {}));
  });
});

describe('pdfStorageKey', () => {
  it('zamienia `/` na `_`', () => {
    expect(pdfStorageKey('K2/2026/04/012', 'abc123')).toBe('K2_2026_04_012_abc123.pdf');
  });

  it('inne sane characters w offerNumber', () => {
    expect(pdfStorageKey('K2-TEST-001', 'deadbeef')).toBe('K2-TEST-001_deadbeef.pdf');
  });

  it('blokuje path traversal', () => {
    // `?` i `#` URL-special — replace na `_`
    expect(pdfStorageKey('K2?#test', 'h')).toBe('K2__test_h.pdf');
  });
});
