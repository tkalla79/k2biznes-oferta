import { describe, expect, it } from 'vitest';
import {
  applyOfferTokens,
  applyOfferTokensToText,
  resolveOfferTokens,
  OFFER_TOKEN_DEFAULTS,
} from './tokens';

const tokens = { de_minimis: '300 000 EUR' };

describe('applyOfferTokensToText', () => {
  it('podstawia token', () => {
    expect(applyOfferTokensToText('Limit to {{de_minimis}} w 3 lata.', tokens)).toBe(
      'Limit to 300 000 EUR w 3 lata.',
    );
  });

  it('toleruje spacje i wielkość liter w nazwie', () => {
    expect(applyOfferTokensToText('{{ DE_MINIMIS }}', tokens)).toBe('300 000 EUR');
  });

  it('nieznany token zostaje w tekście', () => {
    // Gdyby znikał po cichu, zdanie miałoby dziurę, której nikt nie wyłapie.
    expect(applyOfferTokensToText('Limit {{de_minimus}}.', tokens)).toBe('Limit {{de_minimus}}.');
  });

  it('tekst bez tokenów wraca bez zmian', () => {
    expect(applyOfferTokensToText('Zwykłe zdanie.', tokens)).toBe('Zwykłe zdanie.');
  });
});

describe('applyOfferTokens', () => {
  it('schodzi w tablice i obiekty — content to jsonb o zmiennym kształcie', () => {
    const content = {
      intro: 'Do {{de_minimis}}.',
      calcBullets: ['limit {{de_minimis}}', 'bez tokenu'],
      altPrograms: [{ name: 'X', desc: 'próg {{de_minimis}}' }],
      loan: { baseFee: 4000, sfPct: 0.015 },
      execIncluded: true,
    };
    const out = applyOfferTokens(content, tokens);
    expect(out.intro).toBe('Do 300 000 EUR.');
    expect(out.calcBullets).toEqual(['limit 300 000 EUR', 'bez tokenu']);
    expect(out.altPrograms[0].desc).toBe('próg 300 000 EUR');
    // Liczby i boolean przechodzą nietknięte — cennik nie może oberwać.
    expect(out.loan).toEqual({ baseFee: 4000, sfPct: 0.015 });
    expect(out.execIncluded).toBe(true);
  });

  it('null i undefined przechodzą bez zmian', () => {
    expect(applyOfferTokens(null, tokens)).toBeNull();
    expect(applyOfferTokens(undefined, tokens)).toBeUndefined();
  });
});

describe('resolveOfferTokens', () => {
  it('pusta baza = wartości domyślne (stan prawny, nie pustka w ofercie)', () => {
    expect(resolveOfferTokens(null)).toEqual(OFFER_TOKEN_DEFAULTS);
    expect(resolveOfferTokens({})).toEqual(OFFER_TOKEN_DEFAULTS);
  });

  it('ustawienie nadpisuje domyślne, śmieci są ignorowane', () => {
    expect(resolveOfferTokens({ de_minimis: ' 200 000 EUR ' }).de_minimis).toBe('200 000 EUR');
    expect(resolveOfferTokens({ de_minimis: 42 }).de_minimis).toBe('300 000 EUR');
    expect(resolveOfferTokens({ de_minimis: '   ' }).de_minimis).toBe('300 000 EUR');
  });
});
