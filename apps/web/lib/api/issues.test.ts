import { describe, expect, it } from 'vitest';
import { formatApiError } from './issues';

describe('formatApiError', () => {
  it('dopisuje pola z details.issues po polsku', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Nieprawidłowe dane wejściowe.',
        details: {
          issues: [
            { path: ['clientNip'], code: 'invalid_string', message: 'NIP musi mieć 10 cyfr' },
            { path: ['projectValue'], code: 'too_small', message: 'Number must be greater than 0' },
          ],
        },
      },
    };
    const out = formatApiError(body, 'fallback');
    expect(out).toContain('Nieprawidłowe dane wejściowe.');
    expect(out).toContain('NIP: NIP musi mieć 10 cyfr');
    expect(out).toContain('Wartość projektu / kwota pożyczki');
  });

  it('mapuje ścieżki zagnieżdżone pożyczki', () => {
    const out = formatApiError(
      {
        error: {
          message: 'Nieprawidłowe dane wejściowe.',
          details: { issues: [{ path: ['loan', 'product', 'interestRate'], message: 'zbyt długi tekst' }] },
        },
      },
      'fallback',
    );
    expect(out).toContain('Oprocentowanie: zbyt długi tekst');
  });

  it('nieznana ścieżka -> pokazuje surową ścieżkę zamiast gubić informację', () => {
    const out = formatApiError(
      { error: { message: 'X', details: { issues: [{ path: ['nowePole'], message: 'wymagane' }] } } },
      'fallback',
    );
    expect(out).toBe('X nowePole: wymagane');
  });

  it('deduplikuje powtórzone issues na tym samym polu', () => {
    const out = formatApiError(
      {
        error: {
          message: 'X',
          details: {
            issues: [
              { path: ['clientNip'], message: 'NIP musi mieć 10 cyfr' },
              { path: ['clientNip'], message: 'NIP musi mieć 10 cyfr' },
            ],
          },
        },
      },
      'fallback',
    );
    expect(out).toBe('X NIP: NIP musi mieć 10 cyfr');
  });

  it('bez issues zwraca sam komunikat, bez issues i bez message -> fallback', () => {
    expect(formatApiError({ error: { message: 'Brak sesji.' } }, 'fallback')).toBe('Brak sesji.');
    expect(formatApiError({}, 'fallback')).toBe('fallback');
    expect(formatApiError(null, 'fallback')).toBe('fallback');
    expect(formatApiError({ error: { message: 'X', details: { issues: 'nie-tablica' } } }, 'f')).toBe('X');
  });

  it('issue bez path (błąd na poziomie obiektu) nie gubi komunikatu', () => {
    const out = formatApiError(
      { error: { message: 'X', details: { issues: [{ message: 'fundingRate jest wymagany dla oferty dotacyjnej' }] } } },
      'fallback',
    );
    expect(out).toBe('X fundingRate jest wymagany dla oferty dotacyjnej');
  });
});
