/**
 * Cennik oferty pożyczkowej (sekcja 04) — odpowiednik `PricingVariants` dla
 * `offer_kind='loan'`.
 *
 * Pożyczka nie ma wariantów ani części miesięcznej: jedno wynagrodzenie
 * (opłata wstępna + success fee liczony od kwoty przyznanej pożyczki).
 * Komponent jest server-side (brak stanu — nie ma czego wybierać), inaczej
 * niż interaktywne karty wariantów w ofercie dotacyjnej.
 */
import type { LoanPricingResult } from '@/lib/pricing';

const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export default function LoanPricing({ pricing }: { pricing: LoanPricingResult }) {
  const sfPctLabel = `${(pricing.sfPct * 100).toFixed(2).replace(/\.?0+$/, '')}%`;

  return (
    <>
      <div className="loan-fee">
        <div className="loan-fee-row">
          <div className="loan-fee-label">
            <strong>Opłata wstępna</strong>
            <span>jednorazowo, po podpisaniu umowy o współpracy</span>
          </div>
          <div className="loan-fee-val">{fmt(pricing.baseFee)}</div>
        </div>
        <div className="loan-fee-row">
          <div className="loan-fee-label">
            <strong>Wynagrodzenie wynikowe</strong>
            <span>
              {sfPctLabel} wartości przyznanej pożyczki — płatne po decyzji pożyczkowej
            </span>
          </div>
          <div className="loan-fee-val">{fmt(pricing.sfAmount)}</div>
        </div>
        <div className="loan-fee-row loan-fee-total">
          <div className="loan-fee-label">
            <strong>Razem (szacunkowo)</strong>
            <span>przy pożyczce {fmt(pricing.loanAmount)}</span>
          </div>
          <div className="loan-fee-val">{fmt(pricing.total)}</div>
        </div>
      </div>

      <p className="vat-note">
        Wszystkie kwoty są kwotami netto — do faktur zostanie doliczony podatek VAT (23%).
        Wynagrodzenie wynikowe zależy od ostatecznej kwoty przyznanej pożyczki.
      </p>
    </>
  );
}
