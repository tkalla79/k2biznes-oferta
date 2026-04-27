/**
 * Testy schematów Zod dla `/api/public/offers/[token]/*`.
 */
import { describe, it, expect } from 'vitest';
import { PublicEventInput, AcceptOfferInput, RejectOfferInput } from './public-offers';

// =============================================================================
// PublicEventInput
// =============================================================================

describe('PublicEventInput', () => {
  it('akceptuje viewed bez payloadu', () => {
    const r = PublicEventInput.parse({ type: 'viewed' });
    expect(r.type).toBe('viewed');
    expect(r.payload).toEqual({});
  });

  it('akceptuje scroll_depth z payloadem', () => {
    const r = PublicEventInput.parse({
      type: 'scroll_depth',
      payload: { depth: 0.75 },
    });
    expect(r.payload).toEqual({ depth: 0.75 });
  });

  it('odrzuca type spoza dozwolonych', () => {
    expect(() => PublicEventInput.parse({ type: 'created' })).toThrow();
    expect(() => PublicEventInput.parse({ type: 'accepted' })).toThrow();
    expect(() => PublicEventInput.parse({ type: 'foo' })).toThrow();
  });
});

// =============================================================================
// AcceptOfferInput
// =============================================================================

describe('AcceptOfferInput', () => {
  const minimal = {
    selectedVariant: 'I' as const,
    clientName: 'Jan Kowalski',
    clientEmail: 'jan@example.com',
    acceptedGdpr: true as const,
    gdprClauseVersion: 'v1-2026-04',
  };

  it('akceptuje minimal valid', () => {
    const r = AcceptOfferInput.parse(minimal);
    expect(r.selectedVariant).toBe('I');
    expect(r.acceptedGdpr).toBe(true);
  });

  it('odrzuca acceptedGdpr=false (z czytelnym message)', () => {
    expect(() =>
      AcceptOfferInput.parse({ ...minimal, acceptedGdpr: false as never }),
    ).toThrow(/RODO/);
  });

  it('odrzuca pusty clientName', () => {
    expect(() => AcceptOfferInput.parse({ ...minimal, clientName: '' })).toThrow();
  });

  it('odrzuca niepoprawny email', () => {
    expect(() =>
      AcceptOfferInput.parse({ ...minimal, clientEmail: 'not-an-email' }),
    ).toThrow();
  });

  it('odrzuca selectedVariant spoza enum', () => {
    expect(() =>
      AcceptOfferInput.parse({ ...minimal, selectedVariant: 'X' as never }),
    ).toThrow();
  });

  it('akceptuje opcjonalny komentarz', () => {
    const r = AcceptOfferInput.parse({ ...minimal, comment: 'Wszystko jasne' });
    expect(r.comment).toBe('Wszystko jasne');
  });

  it('odrzuca komentarz > 2000 znaków', () => {
    expect(() =>
      AcceptOfferInput.parse({ ...minimal, comment: 'x'.repeat(2001) }),
    ).toThrow();
  });

  it('wymaga gdprClauseVersion', () => {
    expect(() => {
      const { gdprClauseVersion: _ignored, ...rest } = minimal;
      return AcceptOfferInput.parse(rest);
    }).toThrow();
  });
});

// =============================================================================
// RejectOfferInput
// =============================================================================

describe('RejectOfferInput', () => {
  it('akceptuje tylko clientName', () => {
    const r = RejectOfferInput.parse({ clientName: 'Anna' });
    expect(r.clientName).toBe('Anna');
    expect(r.clientEmail).toBeUndefined();
    expect(r.reason).toBeUndefined();
  });

  it('akceptuje pełen payload', () => {
    const r = RejectOfferInput.parse({
      clientName: 'Anna',
      clientEmail: 'anna@example.com',
      reason: 'Wybraliśmy inną firmę.',
    });
    expect(r.clientEmail).toBe('anna@example.com');
    expect(r.reason).toBe('Wybraliśmy inną firmę.');
  });

  it('odrzuca pusty clientName', () => {
    expect(() => RejectOfferInput.parse({ clientName: '' })).toThrow();
  });

  it('odrzuca niepoprawny email gdy podany', () => {
    expect(() =>
      RejectOfferInput.parse({ clientName: 'A', clientEmail: 'not-email' }),
    ).toThrow();
  });
});
