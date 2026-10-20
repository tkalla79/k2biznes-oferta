import { describe, expect, it } from 'vitest';
import {
  normalizeScopeVariant,
  legacyScopeVariantFromName,
  resolveScopeVariant,
} from './scopeVariant';

describe('normalizeScopeVariant', () => {
  it('przepuszcza znane warianty', () => {
    expect(normalizeScopeVariant('standard')).toBe('standard');
    expect(normalizeScopeVariant('culture')).toBe('culture');
  });

  it('nieznana wartość = zakres standardowy, bez wywrotki', () => {
    expect(normalizeScopeVariant('kultura')).toBe('standard');
    expect(normalizeScopeVariant(null)).toBe('standard');
    expect(normalizeScopeVariant(7)).toBe('standard');
  });
});

describe('resolveScopeVariant', () => {
  it('jawny wariant z oferty wygrywa z nazwą', () => {
    // Nazwa mówi „krajowy", pozycja mówi „culture" — liczy się deklaracja.
    expect(
      resolveScopeVariant({ scopeVariant: 'culture', name: 'FENG SMART', program: 'FENG' }),
    ).toBe('culture');
    expect(
      resolveScopeVariant({ scopeVariant: 'standard', name: 'Kultura', program: 'EOG' }),
    ).toBe('standard');
  });

  it('brak pola = reguła zgodnościowa po nazwie (oferty sprzed zmiany)', () => {
    expect(resolveScopeVariant({ name: 'Kultura', program: 'Fundusze Norweskie i EOG' })).toBe(
      'culture',
    );
    expect(resolveScopeVariant({ name: 'Ścieżka SMART', program: 'FENG' })).toBe('standard');
  });

  it('brak rekomendowanej pozycji = zakres standardowy', () => {
    expect(resolveScopeVariant(null)).toBe('standard');
  });

  it('śmieci w jsonb nie przechodzą jako wariant', () => {
    expect(resolveScopeVariant({ scopeVariant: 'EOG', name: 'X', program: 'Y' })).toBe('standard');
  });
});

describe('legacyScopeVariantFromName', () => {
  it('rozpoznaje Kulturę po EOG i „norweski" w nazwie lub programie', () => {
    expect(legacyScopeVariantFromName('Kultura', 'EOG')).toBe('culture');
    expect(legacyScopeVariantFromName('Fundusze norweskie', '')).toBe('culture');
    expect(legacyScopeVariantFromName('Kredyt ekologiczny', 'FENG')).toBe('standard');
  });
});
