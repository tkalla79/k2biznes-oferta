/**
 * Cennik oferty na sam zakres 2 (sekcja 04) — odpowiednik `PricingVariants`
 * dla `offer_kind='exec'`.
 *
 * Bez wariantów, bez opłaty wstępnej i bez wynagrodzenia wynikowego: projekt ma
 * już decyzję o dofinansowaniu, więc nie ma czego pozyskiwać ani od czego liczyć
 * success fee. Zostaje stała stawka miesięczna za prowadzenie i rozliczanie
 * projektu. Komponent jest server-side — nie ma czego wybierać.
 */
import type { ExecPricingResult } from '@/lib/pricing';

const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

/** „18 miesięcy" / „1 miesiąc" / „22 miesiące" — polska odmiana po liczbie. */
function monthsLabel(n: number): string {
  if (n === 1) return '1 miesiąc';
  const last = n % 10;
  const lastTwo = n % 100;
  const few = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14);
  return `${n} ${few ? 'miesiące' : 'miesięcy'}`;
}

export default function ExecPricing({ pricing }: { pricing: ExecPricingResult }) {
  return (
    <>
      <div className="loan-fee">
        <div className="loan-fee-row">
          <div className="loan-fee-label">
            <strong>Wynagrodzenie miesięczne</strong>
            <span>za prowadzenie i rozliczanie projektu, płatne z dołu za każdy miesiąc obsługi</span>
          </div>
          <div className="loan-fee-val">{fmt(pricing.monthlyFee)}</div>
        </div>
        <div className="loan-fee-row">
          <div className="loan-fee-label">
            <strong>Okres obsługi</strong>
            <span>zgodnie z okresem realizacji projektu przyjętym w tej ofercie</span>
          </div>
          <div className="loan-fee-val">{monthsLabel(pricing.months)}</div>
        </div>
        <div className="loan-fee-row loan-fee-total">
          <div className="loan-fee-label">
            <strong>Razem za cały okres</strong>
            <span>
              {fmt(pricing.monthlyFee)} × {monthsLabel(pricing.months)}
            </span>
          </div>
          <div className="loan-fee-val">{fmt(pricing.total)}</div>
        </div>
      </div>

      <p className="vat-note">
        Wszystkie kwoty są kwotami netto — do faktur zostanie doliczony podatek VAT (23%).
        Rozliczenie jest miesięczne, więc łączna kwota zmieni się, jeśli zmieni się okres
        realizacji projektu.
      </p>
    </>
  );
}
