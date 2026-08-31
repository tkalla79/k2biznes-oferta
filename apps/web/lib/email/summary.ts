/**
 * Podsumowanie finansowe oferty dla maili — czysta funkcja, bez I/O.
 *
 * Wydzielone z `notifications.ts`, żeby dało się testować bez klienta Supabase
 * i bez Resend (moduł nie ciągnie żadnych zależności runtime'owych).
 */
import type { PricingResult } from '../pricing';
import { resolveLoanPricing } from '../pricing/loan';

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

/**
 * Podsumowanie finansowe do maila „oferta wysłana" — czysta funkcja, bez I/O.
 *
 * Rozdziela dwa modele cennika po `offer_kind` (źródło prawdy o typie oferty):
 * dotacja ma warianty i kwotę dofinansowania, pożyczka ma jedną pozycję
 * (opłata wstępna + wynagrodzenie wynikowe) i wnioskowaną kwotę pożyczki.
 * Zwraca `null` gdy snapshot dotacyjny jest niepoprawny (brak `variants`) —
 * wtedy wysyłka jest blokowana, bo mail pokazałby „—" zamiast ceny.
 */
export function buildOfferSummary(offer: {
  offer_kind?: string | null;
  pricing_snapshot: unknown;
  project_value: number | string;
  selected_variant: string;
}): { isLoan: boolean; fundingAmount: string; variantName: string; variantTotal: string } | null {
  const isLoan = offer.offer_kind === 'loan';
  const raw = offer.pricing_snapshot;

  if (isLoan) {
    const p = resolveLoanPricing(raw, Number(offer.project_value));
    return {
      isLoan: true,
      fundingAmount: fmtPLN(p.loanAmount),
      variantName: 'Opłata wstępna + wynagrodzenie wynikowe',
      variantTotal: fmtPLN(p.total),
    };
  }

  // Code review PR #3: guard na pricing_snapshot. Format jest typu jsonb i mimo
  // że schema ma NOT NULL, tu defensywnie sprawdzamy strukturę przed castem.
  if (
    !raw ||
    typeof raw !== 'object' ||
    Array.isArray(raw) ||
    !Array.isArray((raw as { variants?: unknown }).variants)
  ) {
    return null;
  }
  const snapshot = raw as unknown as PricingResult;
  const variant = snapshot.variants.find((v) => v.id === offer.selected_variant);
  return {
    isLoan: false,
    fundingAmount: fmtPLN(snapshot.funding),
    variantName: variant ? `${variant.name} — ${variant.tag}` : `Wariant ${offer.selected_variant}`,
    variantTotal: variant ? fmtPLN(variant.total) : '—',
  };
}
