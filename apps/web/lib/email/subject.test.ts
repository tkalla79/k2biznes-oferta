import { describe, it, expect } from 'vitest';
import { defaultOfferSubject, resolveOfferSubject } from './subject';

const base = { clientName: 'PROFECTUS sp. z o.o.', programLabel: 'FENG 2.33' };

describe('resolveOfferSubject', () => {
  it('bez własnego tematu leci domyślny z szablonu', () => {
    expect(resolveOfferSubject(base)).toBe('Oferta K2Biznes dla PROFECTUS sp. z o.o. — FENG 2.33');
    expect(resolveOfferSubject(base)).toBe(defaultOfferSubject(base));
  });

  it('własny temat nadpisuje domyślny', () => {
    expect(resolveOfferSubject({ ...base, custom: 'Oferta po naszej rozmowie' })).toBe(
      'Oferta po naszej rozmowie',
    );
  });

  it('pusty temat i sam whitespace = domyślny (mail bez tematu wygląda jak spam)', () => {
    expect(resolveOfferSubject({ ...base, custom: '' })).toBe(defaultOfferSubject(base));
    expect(resolveOfferSubject({ ...base, custom: '   ' })).toBe(defaultOfferSubject(base));
    expect(resolveOfferSubject({ ...base, custom: null })).toBe(defaultOfferSubject(base));
  });

  it('własny temat jest przycinany ze spacji', () => {
    expect(resolveOfferSubject({ ...base, custom: '  Oferta — K2  ' })).toBe('Oferta — K2');
  });
});
