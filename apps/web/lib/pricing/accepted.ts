/**
 * Co klient faktycznie zaakceptował — jedno miejsce liczące kwoty decyzji.
 *
 * BŁĄD 2026-11-05 (oferta K2/2026/10/017): `accepted_fee` liczyło się z
 * SUROWEGO `pricing_snapshot`, podczas gdy klient ogląda snapshot z nałożonym
 * `pricing_override` (`toPublicOfferDto` → `applyOverride`). Przy cenniku
 * ręcznym obie liczby się rozjeżdżały: oferta pokazywała 63 000 zł (6% z
 * 1 050 000), a powiadomienie, kolumna FEE i webhook do CRM — 73 500 zł (7% z
 * siatki segmentów). Zawyżone o 10 500 zł względem tego, na co klient się
 * zgodził, czyli w kierunku najgorszym z możliwych.
 *
 * Źródłem prawdy o kwotach decyzji jest to, co klient WIDZIAŁ. Każda ścieżka
 * zapisu decyzji (formularz klienta, wpis z panelu) i każdy odbiorca
 * (powiadomienie, webhook) liczy je tutaj, żeby nie dało się naprawić jednej
 * ścieżki i zapomnieć o drugiej — tak właśnie powstał ten błąd.
 */
import { applyOverride, parsePricingOverride } from './override';
import { isLoanPricing } from './loan';
import { isExecPricing } from './exec';
import type {
  OfferPricingResult,
  PricingResult,
  PricingVariant,
  PricingVariantId,
} from './types';

/** Składniki wynagrodzenia z zaakceptowanego wariantu (tylko dotacja). */
export type AcceptedVariant = {
  id: PricingVariantId;
  name: string;
  /** Opłata wstępna. */
  base: number;
  sfPct: number;
  /** Wynagrodzenie wynikowe (success fee). */
  sfAmount: number;
  /** Stawka miesięczna za obsługę i rozliczanie. */
  monthly: number;
  /** base + sfAmount. Bez części miesięcznej — ta zależy od długości projektu. */
  total: number;
};

export type AcceptedBreakdown = {
  /**
   * Kwota do `offers.accepted_fee`. Dla dotacji to samo wynagrodzenie
   * wynikowe, dla pożyczki i zakresu 2 — całość wynagrodzenia ze snapshotu.
   * Znaczenie zostaje jak było; naprawiamy skąd się bierze, nie co znaczy.
   */
  fee: number;
  /** Składniki do powiadomienia; `null` dla ofert bez wariantów. */
  variant: AcceptedVariant | null;
};

export class AcceptedVariantMissingError extends Error {
  constructor(public readonly variantId: string) {
    super(`Wariant ${variantId} nie istnieje w pricing_snapshot.`);
    this.name = 'AcceptedVariantMissingError';
  }
}

export function resolveAcceptedBreakdown(args: {
  /** `offers.pricing_snapshot` — jsonb, kształt zależny od typu oferty. */
  snapshot: unknown;
  /** `offers.pricing_override` — jsonb; dla pożyczki i zakresu 2 bez znaczenia. */
  override: unknown;
  /** Wariant wskazany przez klienta; ignorowany dla ofert bez wariantów. */
  variantId: PricingVariantId | null;
}): AcceptedBreakdown {
  const snapshot = args.snapshot as OfferPricingResult;

  // Pożyczka i zakres 2 nie mają wariantów ani override — całość wynagrodzenia.
  if (isLoanPricing(snapshot) || isExecPricing(snapshot)) {
    return { fee: snapshot.total, variant: null };
  }

  const grant = snapshot as PricingResult;
  if (!args.variantId) throw new AcceptedVariantMissingError('(brak)');

  // Ten sam `applyOverride`, którym liczony jest widok klienta — gdyby kiedyś
  // zmieniła się reguła nakładania, obie strony zmienią się razem.
  const rendered = applyOverride(grant, parsePricingOverride(args.override));
  const v = rendered.variants?.find((x: PricingVariant) => x.id === args.variantId);
  if (!v) throw new AcceptedVariantMissingError(args.variantId);

  return {
    fee: v.sfAmount,
    variant: {
      id: v.id,
      name: v.name,
      base: v.base,
      sfPct: v.sfPct,
      sfAmount: v.sfAmount,
      monthly: v.monthly,
      total: v.total,
    },
  };
}
