import { describe, expect, it } from 'vitest';
import { toOfferDto, toPublicOfferDto, type OfferRow } from './mapper';

/** Minimalny wiersz oferty — tylko pola, których mapper faktycznie dotyka. */
function row(over: Partial<OfferRow> = {}): OfferRow {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    offer_number: 'K2/2026/08/001',
    client_token: 'tok_'.padEnd(30, 'x'),
    status: 'sent',
    created_by: '00000000-0000-0000-0000-0000000000aa',
    assigned_consultant_id: null,
    contact_person_id: null,
    client_name: 'Testowa Sp. z o.o.',
    client_nip: null,
    client_industry: null,
    client_company_size: null,
    client_voivodeship: null,
    offer_kind: 'grant',
    program_id: null,
    program_label: 'FENG 2.33',
    program_custom_name: null,
    project_value: 500000,
    funding_rate: 0.7,
    returning_client: false,
    project_count: 1,
    pricing_snapshot: {
      funding: 350000,
      segment: { id: 's500k', label: 's500k' },
      base: 15000,
      variants: [
        { id: 'I', name: 'Wariant I', tag: '', sfPct: 0.04, sfAmount: 14000, base: 15000, monthly: 4500, total: 29000, payment: [] },
      ],
    } as unknown as OfferRow['pricing_snapshot'],
    pricing_override: {} as OfferRow['pricing_override'],
    selected_variant: 'I',
    offered_variants: ['I', 'II', 'III'],
    case_study_id: null,
    content: {} as OfferRow['content'],
    accepted_variant: null,
    accepted_fee: null,
    accepted_by_name: null,
    accepted_by_email: null,
    client_comment: null,
    accepted_at: null,
    rejected_at: null,
    rejected_by_name: null,
    rejected_by_email: null,
    reject_reason: null,
    gdpr_clause_version: null,
    gdpr_text_hash: null,
    gdpr_accepted_at: null,
    sent_at: null,
    first_viewed_at: null,
    last_viewed_at: null,
    view_count: 0,
    expires_at: null,
    created_at: '2026-08-29T00:00:00Z',
    updated_at: '2026-08-29T00:00:00Z',
    deleted_at: null,
    ...over,
  } as OfferRow;
}

const loanSnapshot = {
  kind: 'loan',
  loanAmount: 500000,
  baseFee: 4000,
  sfPct: 0.015,
  sfAmount: 7500,
  total: 11500,
} as unknown as OfferRow['pricing_snapshot'];

describe('mapper — typ oferty', () => {
  it('dotacja: offerKind=grant, snapshot z wariantami', () => {
    const dto = toOfferDto(row(), 'https://x');
    expect(dto.offerKind).toBe('grant');
    expect(dto.pricingSnapshot.variants).toHaveLength(1);
    expect(dto.fundingRate).toBe(0.7);
  });

  it('pożyczka: offerKind=loan, funding_rate NULL nie wysadza mappera', () => {
    const dto = toOfferDto(
      row({ offer_kind: 'loan', funding_rate: null, pricing_snapshot: loanSnapshot }),
      'https://x',
    );
    expect(dto.offerKind).toBe('loan');
    expect(dto.fundingRate).toBe(0); // funding_rate NULL -> 0, brak NaN
    expect((dto.pricingSnapshot as unknown as { kind: string }).kind).toBe('loan');
  });

  it('pożyczka: widok publiczny nie stosuje override ani exec-fee do snapshotu', () => {
    const dto = toPublicOfferDto(
      row({ offer_kind: 'loan', funding_rate: null, pricing_snapshot: loanSnapshot }),
      null,
      null,
    );
    const snap = dto.pricingSnapshot as unknown as { kind: string; total: number };
    expect(snap.kind).toBe('loan');
    expect(snap.total).toBe(11500); // niezmieniony przez applyOverride
  });

  it('niespójność offer_kind=loan + snapshot dotacyjny: mapper nie rzuca', () => {
    expect(() =>
      toPublicOfferDto(row({ offer_kind: 'loan', funding_rate: null }), null, null),
    ).not.toThrow();
  });

  it('niespójność offer_kind=grant + snapshot pożyczkowy: mapper nie rzuca', () => {
    expect(() =>
      toPublicOfferDto(row({ offer_kind: 'grant', pricing_snapshot: loanSnapshot }), null, null),
    ).not.toThrow();
  });
});
