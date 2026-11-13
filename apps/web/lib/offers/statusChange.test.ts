import { describe, expect, it } from 'vitest';
import {
  allTargetsFrom,
  decisionTargetsFrom,
  manualTargetsFrom,
  planStatusChange,
} from './statusChange';

describe('dozwolone przejścia', () => {
  it('draft nie ma ręcznych przejść — wyjście tylko przez wysyłkę z akceptacją', () => {
    expect(allTargetsFrom('draft')).toEqual([]);
  });

  it('wysłana/obejrzana: decyzja klienta albo zamknięcie', () => {
    expect(decisionTargetsFrom('sent')).toEqual(['accepted', 'rejected']);
    expect(manualTargetsFrom('sent')).toEqual(['expired']);
    expect(manualTargetsFrom('viewed')).toEqual(['sent', 'expired']);
  });

  it('decyzję i wygaśnięcie da się cofnąć', () => {
    for (const s of ['accepted', 'rejected', 'expired'] as const) {
      expect(manualTargetsFrom(s)).toEqual(['sent', 'viewed']);
      expect(decisionTargetsFrom(s)).toEqual([]);
    }
  });
});

describe('planStatusChange', () => {
  const now = new Date('2026-11-13T12:00:00Z');

  it('niedozwolone przejście = null', () => {
    expect(planStatusChange({ from: 'draft', to: 'sent', expiresAt: null, now })).toBeNull();
    expect(planStatusChange({ from: 'sent', to: 'viewed', expiresAt: null, now })).toBeNull();
  });

  it('obejrzana → wysłana zeruje licznik otwarć (przypadek otwarcia przez zespół)', () => {
    const p = planStatusChange({ from: 'viewed', to: 'sent', expiresAt: null, now })!;
    expect(p.update).toEqual({
      status: 'sent',
      view_count: 0,
      first_viewed_at: null,
      last_viewed_at: null,
    });
  });

  it('cofnięcie akceptacji czyści pola decyzji, ale nie zgodę RODO', () => {
    const p = planStatusChange({ from: 'accepted', to: 'viewed', expiresAt: null, now })!;
    expect(p.update).toMatchObject({
      status: 'viewed',
      accepted_fee: null,
      accepted_variant: null,
      accepted_at: null,
    });
    expect(Object.keys(p.update).some((k) => k.startsWith('gdpr_'))).toBe(false);
    // „obejrzana" nie rusza licznika otwarć
    expect('view_count' in p.update).toBe(false);
  });

  it('wznowienie wygasłej z minionym terminem usuwa termin', () => {
    const p = planStatusChange({
      from: 'expired',
      to: 'viewed',
      expiresAt: '2026-11-01T00:00:00Z',
      now,
    })!;
    expect(p.update.expires_at).toBeNull();
  });

  it('wznowienie wygasłej z przyszłym terminem zostawia termin', () => {
    const p = planStatusChange({
      from: 'expired',
      to: 'viewed',
      expiresAt: '2026-12-31T00:00:00Z',
      now,
    })!;
    expect('expires_at' in p.update).toBe(false);
  });

  it('każde przejście opisuje skutki do potwierdzenia', () => {
    const p = planStatusChange({ from: 'viewed', to: 'expired', expiresAt: null, now })!;
    expect(p.effects.length).toBeGreaterThan(0);
  });
});
