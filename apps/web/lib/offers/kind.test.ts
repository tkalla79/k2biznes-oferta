import { describe, it, expect } from 'vitest';
import { normalizeOfferKind, hasVariants } from './kind';

describe('normalizeOfferKind', () => {
  it('przepuszcza znane typy', () => {
    expect(normalizeOfferKind('grant')).toBe('grant');
    expect(normalizeOfferKind('loan')).toBe('loan');
    expect(normalizeOfferKind('exec')).toBe('exec');
  });

  it('nieznana wartość z kolumny text = dotacja', () => {
    // Kolumna jest `text` z checkiem w bazie, więc w kodzie i tak trzeba ją
    // zawęzić — starsza oferta albo ręczna edycja w Studio nie może wywalić renderu.
    expect(normalizeOfferKind('cos-nowego')).toBe('grant');
    expect(normalizeOfferKind(null)).toBe('grant');
    expect(normalizeOfferKind(undefined)).toBe('grant');
    expect(normalizeOfferKind(42)).toBe('grant');
  });

  it('nie zamienia exec w grant — regresja po dodaniu trzeciego typu', () => {
    // Poprzedni wzorzec `=== 'loan' ? 'loan' : 'grant'` po cichu robił z exec
    // dotację, a wtedy oferta liczyła się złym silnikiem.
    expect(normalizeOfferKind('exec')).not.toBe('grant');
  });
});

describe('hasVariants', () => {
  it('warianty I–IV ma wyłącznie dotacja', () => {
    expect(hasVariants('grant')).toBe(true);
    expect(hasVariants('loan')).toBe(false);
    expect(hasVariants('exec')).toBe(false);
  });
});
