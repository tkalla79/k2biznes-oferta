/**
 * Cennik oferty pożyczkowej (sekcja 04) — odpowiednik `PricingVariants` dla
 * `offer_kind='loan'`.
 *
 * Pożyczka nie ma wariantów ani części miesięcznej: jedno wynagrodzenie
 * (opłata wstępna + success fee). Podstawa naliczenia success fee bywa inna niż
 * kwota pożyczki (FRS: % kwoty umorzenia kapitału), dlatego opis pod kwotą jest
 * nadpisywalny per oferta — `content.loan.sfNote`.
 * Komponent jest server-side (brak stanu — nie ma czego wybierać), inaczej
 * niż interaktywne karty wariantów w ofercie dotacyjnej.
 */
import type { LoanPricingResult } from '@/lib/pricing';
import { resolveLoanSfNote } from '@/lib/pricing/loan';

const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export default function LoanPricing({
  pricing,
  sfNote,
}: {
  pricing: LoanPricingResult;
  /**
   * Opis pod „Wynagrodzenie wynikowe". `undefined` (brak pola w ofercie) →
   * zdanie domyślne; `''` → wiersz opisu znika. Rozróżnienie jest istotne:
   * domyślne zdanie nie pasuje do każdego produktu pożyczkowego (FRS liczy
   * success fee od kwoty umorzenia, nie od kwoty pożyczki).
   */
  sfNote?: string;
}) {
  const sfPctLabel = `${(pricing.sfPct * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  const sfNoteText = resolveLoanSfNote(sfNote, sfPctLabel);

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
            {sfNoteText !== '' && <span>{sfNoteText}</span>}
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
