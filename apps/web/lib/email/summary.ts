/**
 * Podsumowanie finansowe oferty dla maili — czysta funkcja, bez I/O.
 *
 * Wydzielone z `notifications.ts`, żeby dało się testować bez klienta Supabase
 * i bez Resend (moduł nie ciągnie żadnych zależności runtime'owych).
 *
 * Funkcja zwraca gotowe etykiety, nie flagę typu oferty. Przy dwóch modelach
 * wystarczało `isLoan`, ale szablon obrósł wtedy ternarami w pięciu miejscach —
 * przy trzecim modelu (sam zakres 2) każdy z nich trzeba by rozbijać osobno,
 * a pominięcie jednego daje maila z etykietą z innego typu oferty.
 */
import type { PricingResult } from '../pricing';
import { resolveLoanPricing } from '../pricing/loan';
import { resolveExecPricing } from '../pricing/exec';
import { normalizeOfferKind } from '../offers/kind';

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

export type OfferEmailSummary = {
  kind: 'grant' | 'loan' | 'exec';
  /** Dalszy ciąg zdania „przesyłam ofertę…" — przed nazwą programu. */
  intro: string;
  /** Czy po intro pada nazwa programu (pożyczka mówi o produkcie, nie o naborze). */
  showProgram: boolean;
  amountLabel: string;
  amountValue: string;
  /** null = wiersz pomijany (pożyczka nie ma czego tu pokazać). */
  detailLabel: string | null;
  detailValue: string;
  totalLabel: string;
  totalValue: string;
  /** Zdanie „W ofercie znajdą Państwo…" — bez końcówki o ważności linku. */
  contents: string;
};

/**
 * Zwraca `null` gdy snapshot dotacyjny jest niepoprawny (brak `variants`) —
 * wtedy wysyłka jest blokowana, bo mail pokazałby „—" zamiast ceny. Dla
 * pożyczki i zakresu 2 brak `variants` jest normą, nie błędem.
 */
export function buildOfferSummary(offer: {
  offer_kind?: string | null;
  pricing_snapshot: unknown;
  project_value: number | string;
  selected_variant: string;
}): OfferEmailSummary | null {
  const kind = normalizeOfferKind(offer.offer_kind);
  const raw = offer.pricing_snapshot;

  if (kind === 'loan') {
    const p = resolveLoanPricing(raw, Number(offer.project_value));
    return {
      kind,
      intro: 'przesyłam ofertę na pozyskanie finansowania zwrotnego',
      showProgram: false,
      amountLabel: 'Wnioskowana kwota pożyczki:',
      amountValue: fmtPLN(p.loanAmount),
      detailLabel: null,
      detailValue: '',
      totalLabel: 'Łączne wynagrodzenie:',
      totalValue: fmtPLN(p.total),
      contents:
        'W ofercie znajdą Państwo warunki produktu, zakres naszych prac, wynagrodzenie oraz ' +
        'nasze referencje',
    };
  }

  if (kind === 'exec') {
    const p = resolveExecPricing(raw, Number(offer.project_value));
    return {
      kind,
      intro: 'przesyłam ofertę na obsługę i rozliczenie projektu w programie',
      showProgram: true,
      amountLabel: 'Kwota przyznanego dofinansowania:',
      amountValue: fmtPLN(p.grantAmount),
      detailLabel: 'Wynagrodzenie:',
      detailValue: `${fmtPLN(p.monthlyFee)} miesięcznie`,
      totalLabel: `Łącznie za ${p.months} mies.:`,
      totalValue: fmtPLN(p.total),
      contents:
        'W ofercie znajdą Państwo pełny zakres obsługi projektu, wynagrodzenie oraz nasze ' +
        'referencje',
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
    kind: 'grant',
    intro: 'przesyłam ofertę na pozyskanie dofinansowania w programie',
    showProgram: true,
    amountLabel: 'Kwota dofinansowania:',
    amountValue: fmtPLN(snapshot.funding),
    detailLabel: 'Rekomendowany wariant:',
    detailValue: variant
      ? `${variant.name} — ${variant.tag}`
      : `Wariant ${offer.selected_variant}`,
    totalLabel: 'Łączne wynagrodzenie:',
    totalValue: variant ? fmtPLN(variant.total) : '—',
    contents:
      'W ofercie znajdą Państwo szczegółowy opis programu, trzy warianty wynagrodzenia oraz ' +
      'nasze referencje',
  };
}
