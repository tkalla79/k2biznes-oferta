/**
 * Silnik cenowy dla ofert pożyczkowych (tryb `loan`).
 *
 * Model (ustalenia 2026-08): opłata wstępna (flat) + wynagrodzenie wynikowe
 * (success fee) liczone od kwoty przyznanej pożyczki. BEZ części miesięcznej
 * (rozliczania) i BEZ wariantów — pojedynczy wynik.
 *
 * Pure function, bez I/O i bez segmentów (inaczej niż dotacyjne `calcPricing`).
 * Wynik zapisywany jako `offers.pricing_snapshot` z `kind: 'loan'`.
 */
import type { LoanPricingInput, LoanPricingResult, OfferPricingResult } from './types';

/** Domyślne stawki pożyczkowe (edytowalne per oferta). */
export const LOAN_BASE_FEE = 4000;
export const LOAN_SF_PCT = 0.015;

export function calcLoanPricing(input: LoanPricingInput): LoanPricingResult {
  const loanAmount = input.loanAmount;
  const baseFee = input.baseFee ?? LOAN_BASE_FEE;
  const sfPct = input.sfPct ?? LOAN_SF_PCT;

  if (!Number.isFinite(loanAmount) || loanAmount <= 0) {
    throw new Error('calcLoanPricing: loanAmount must be > 0');
  }
  if (!Number.isFinite(baseFee) || baseFee < 0) {
    throw new Error('calcLoanPricing: baseFee must be >= 0');
  }
  if (!Number.isFinite(sfPct) || sfPct < 0 || sfPct > 1) {
    throw new Error('calcLoanPricing: sfPct must be in [0, 1]');
  }

  const sfAmount = Math.round(loanAmount * sfPct * 100) / 100;
  const total = Math.round((baseFee + sfAmount) * 100) / 100;

  return { kind: 'loan', loanAmount, baseFee, sfPct, sfAmount, total };
}

/** Type guard: rozróżnia snapshot pożyczkowy od dotacyjnego. */
export function isLoanPricing(p: OfferPricingResult | null | undefined): p is LoanPricingResult {
  return !!p && (p as LoanPricingResult).kind === 'loan';
}
