/**
 * Testy schematów Zod dla `/api/offers/*`.
 *
 * Bez DB — czysta walidacja inputu. Pełny flow API testujemy w smoke test
 * (curl + lokalny Supabase) i Playwright (PR #4+).
 */
import { describe, it, expect } from 'vitest';
import {
  CreateOfferInput,
  UpdateOfferInput,
  ListOffersQuery,
  shouldRecalcSnapshot,
  SORT_FIELDS,
} from './offers';

// =============================================================================
// CreateOfferInput
// =============================================================================

describe('CreateOfferInput', () => {
  const minimal = {
    clientName: 'Aqustec Sp. z o.o.',
    programLabel: 'FENG · Ścieżka SMART',
    projectValue: 4_000_000,
    fundingRate: 0.65,
  };

  it('akceptuje minimal valid', () => {
    const r = CreateOfferInput.parse(minimal);
    expect(r.clientName).toBe(minimal.clientName);
    expect(r.returningClient).toBe(false); // default
    expect(r.projectCount).toBe(1);
    expect(r.selectedVariant).toBe('I');
    expect(r.offeredVariants).toEqual(['I', 'II', 'III']);
    expect(r.content).toEqual({});
  });

  it('odrzuca pusty clientName', () => {
    expect(() => CreateOfferInput.parse({ ...minimal, clientName: '' })).toThrow();
  });

  it('odrzuca projectValue ≤ 0', () => {
    expect(() => CreateOfferInput.parse({ ...minimal, projectValue: 0 })).toThrow();
    expect(() => CreateOfferInput.parse({ ...minimal, projectValue: -1 })).toThrow();
  });

  it('odrzuca fundingRate poza [0.1, 0.95]', () => {
    expect(() => CreateOfferInput.parse({ ...minimal, fundingRate: 0.05 })).toThrow();
    expect(() => CreateOfferInput.parse({ ...minimal, fundingRate: 0.99 })).toThrow();
    expect(CreateOfferInput.parse({ ...minimal, fundingRate: 0.10 }).fundingRate).toBe(0.10);
    expect(CreateOfferInput.parse({ ...minimal, fundingRate: 0.95 }).fundingRate).toBe(0.95);
  });

  it('odrzuca NIP nie-10-cyfrowy', () => {
    expect(() => CreateOfferInput.parse({ ...minimal, clientNip: '123' })).toThrow();
    expect(() => CreateOfferInput.parse({ ...minimal, clientNip: '12345-67890' })).toThrow();
    expect(CreateOfferInput.parse({ ...minimal, clientNip: '1234567890' }).clientNip).toBe('1234567890');
  });

  it('odrzuca projectCount poza [1, 5]', () => {
    expect(() => CreateOfferInput.parse({ ...minimal, projectCount: 0 })).toThrow();
    expect(() => CreateOfferInput.parse({ ...minimal, projectCount: 6 })).toThrow();
    expect(() => CreateOfferInput.parse({ ...minimal, projectCount: 2.5 })).toThrow();
  });

  it('odrzuca companySize poza enum', () => {
    expect(() =>
      CreateOfferInput.parse({ ...minimal, clientCompanySize: 'huge' as unknown as 'large' }),
    ).toThrow();
  });

  it('akceptuje wszystkie offeredVariants', () => {
    expect(
      CreateOfferInput.parse({ ...minimal, offeredVariants: ['I', 'II', 'III', 'IV'] }).offeredVariants,
    ).toEqual(['I', 'II', 'III', 'IV']);
  });

  it('odrzuca pustą tablicę offeredVariants', () => {
    expect(() => CreateOfferInput.parse({ ...minimal, offeredVariants: [] })).toThrow();
  });
});

// =============================================================================
// UpdateOfferInput
// =============================================================================

describe('UpdateOfferInput', () => {
  it('wszystkie pola opcjonalne', () => {
    expect(UpdateOfferInput.parse({})).toEqual({});
  });

  it('akceptuje partial update', () => {
    const r = UpdateOfferInput.parse({ clientName: 'Nowa nazwa', fundingRate: 0.7 });
    expect(r.clientName).toBe('Nowa nazwa');
    expect(r.fundingRate).toBe(0.7);
  });

  it('akceptuje status enum', () => {
    expect(UpdateOfferInput.parse({ status: 'sent' }).status).toBe('sent');
    expect(() => UpdateOfferInput.parse({ status: 'foo' })).toThrow();
  });

  it('akceptuje expiresAt jako ISO datetime lub null', () => {
    expect(UpdateOfferInput.parse({ expiresAt: '2026-12-31T23:59:00Z' })).toBeDefined();
    expect(UpdateOfferInput.parse({ expiresAt: null })).toBeDefined();
    expect(() => UpdateOfferInput.parse({ expiresAt: 'invalid' })).toThrow();
  });
});

// =============================================================================
// shouldRecalcSnapshot
// =============================================================================

describe('shouldRecalcSnapshot', () => {
  it('true gdy projectValue / fundingRate / returningClient / projectCount się zmienia', () => {
    expect(shouldRecalcSnapshot({ projectValue: 5_000_000 })).toBe(true);
    expect(shouldRecalcSnapshot({ fundingRate: 0.7 })).toBe(true);
    expect(shouldRecalcSnapshot({ returningClient: true })).toBe(true);
    expect(shouldRecalcSnapshot({ projectCount: 3 })).toBe(true);
  });

  it('false dla zmian czysto kosmetycznych', () => {
    expect(shouldRecalcSnapshot({ clientName: 'Foo' })).toBe(false);
    expect(shouldRecalcSnapshot({ programLabel: 'Bar' })).toBe(false);
    expect(shouldRecalcSnapshot({ content: { intro: 'x' } })).toBe(false);
    expect(shouldRecalcSnapshot({ selectedVariant: 'II' })).toBe(false);
  });
});

// =============================================================================
// ListOffersQuery
// =============================================================================

describe('ListOffersQuery', () => {
  it('parsuje defaulty', () => {
    const r = ListOffersQuery.parse({});
    expect(r.page).toBe(1);
    expect(r.pageSize).toBe(50);
    expect(r.sort).toEqual([{ field: 'createdAt', dir: 'desc' }]);
  });

  it('coerce page i pageSize z stringów (URL params)', () => {
    const r = ListOffersQuery.parse({ page: '3', pageSize: '20' });
    expect(r.page).toBe(3);
    expect(r.pageSize).toBe(20);
  });

  it('parsuje status jako CSV', () => {
    const r = ListOffersQuery.parse({ status: 'draft,sent,viewed' });
    expect(r.status).toEqual(['draft', 'sent', 'viewed']);
  });

  it('odrzuca status spoza enum', () => {
    expect(() => ListOffersQuery.parse({ status: 'draft,foo' })).toThrow();
  });

  it('parsuje sort multi-field', () => {
    const r = ListOffersQuery.parse({ sort: 'clientName:asc,projectValue:desc' });
    expect(r.sort).toEqual([
      { field: 'clientName', dir: 'asc' },
      { field: 'projectValue', dir: 'desc' },
    ]);
  });

  it('clamp pageSize do 100', () => {
    expect(() => ListOffersQuery.parse({ pageSize: '200' })).toThrow();
  });

  it('odrzuca page=0', () => {
    expect(() => ListOffersQuery.parse({ page: '0' })).toThrow();
  });
});

describe('SORT_FIELDS whitelist', () => {
  it('zawiera podstawowe pola', () => {
    for (const f of ['createdAt', 'updatedAt', 'clientName', 'projectValue', 'status']) {
      expect(SORT_FIELDS.has(f)).toBe(true);
    }
  });

  it('NIE zawiera niebezpiecznych pól (np. created_by, client_token)', () => {
    expect(SORT_FIELDS.has('createdBy')).toBe(false);
    expect(SORT_FIELDS.has('clientToken')).toBe(false);
    expect(SORT_FIELDS.has('pricingSnapshot')).toBe(false);
  });
});
