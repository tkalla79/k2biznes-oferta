/**
 * Testy logiki backoff dispatcher'a (BACKEND_SPEC.md sekcja 10.4).
 *
 * Pełny flow (claim + HTTP + status update) testujemy w smoke teście z
 * lokalnym Supabase + mock CRM endpoint'em. Tu unit'owo: krzywa backoff i max
 * attempts.
 */
import { describe, it, expect } from 'vitest';
import { _backoffSecondsForAttempt, _MAX_ATTEMPTS, _BACKOFF_SEC } from './dispatch';

describe('webhook backoff', () => {
  it('zgodny ze spec sekcja 10.4: [30s, 2min, 10min, 1h, 6h]', () => {
    expect(_BACKOFF_SEC).toEqual([30, 120, 600, 3600, 21_600]);
  });

  it('max 5 prób', () => {
    expect(_MAX_ATTEMPTS).toBe(5);
  });

  it('sekwencja: attempt 1..5 → odpowiednie delay', () => {
    expect(_backoffSecondsForAttempt(1)).toBe(120); // po 1 fail → 2min do 2. próby
    expect(_backoffSecondsForAttempt(2)).toBe(600); // po 2 fail → 10min
    expect(_backoffSecondsForAttempt(3)).toBe(3600); // po 3 fail → 1h
    expect(_backoffSecondsForAttempt(4)).toBe(21_600); // po 4 fail → 6h (5. próba)
  });

  it('clamp dla attempts > tablicy (chroni przed undefined)', () => {
    expect(_backoffSecondsForAttempt(10)).toBe(21_600);
    expect(_backoffSecondsForAttempt(99)).toBe(21_600);
  });

  it('attempt 0 → pierwsze opóźnienie 30s (initial enqueue: now)', () => {
    expect(_backoffSecondsForAttempt(0)).toBe(30);
  });
});
