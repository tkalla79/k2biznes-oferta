'use client';

/**
 * Interaktywne karty wariantow cennika (sekcja 04 oferty).
 *
 * Bug raport Tomka 2026-06-01: "Wariant 1 ma czerwona obwodke ktora nie zmienia
 * sie kiedy wybiore lub najade kursorem na inny wariant — to musi sie zmieniac".
 *
 * Wczesniej karty byly server-rendered z `selected = dto.selectedVariant === v.id`.
 * Klik nie zmienial UI — wybor klienta byl tylko w AcceptForm.
 *
 * Teraz: useState lokalny dla aktualnie podswietlonego wariantu. Klik =>
 * - zmienia ktora karta ma '.selected' i badge 'Wybrany'
 * - exec-fee box pod kartami aktualizuje monthly value
 *
 * Bug raport Tomka 2026-06-14: klik w wariant 2/3 OD RAZU przenosil do sekcji
 * 09 (akceptacja). Przyczyna: karta byla <a href="#akcept"> (natywny skok).
 * Naprawione: karta to <button type="button"> — klik tylko podswietla, bez
 * nawigacji. Klient sam scrolluje do akceptacji gdy gotowy.
 *
 * Wybor klienta nadal finalizowany w AcceptForm (osobny komponent, wlasny state).
 * Tu jest tylko visual feedback "ktory rozwazam".
 */
import { useState } from 'react';
import type { PricingVariant } from '@/lib/pricing';

type Props = {
  variants: PricingVariant[];
  initialSelected: string;
  execFee: {
    kicker: string;
    title: string;
    desc: string;
    monthly: number | null;
  };
};

const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export default function PricingVariants({ variants, initialSelected, execFee }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    initialSelected || variants[0]?.id || '',
  );
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0] ?? null;

  return (
    <>
      <div className="variants">
        {variants.map((v) => {
          const isSelected = selectedId === v.id;
          return (
            // <button> jako selectable option — klik tylko podswietla (visual
            // feedback), NIE nawiguje do akceptacji. aria-pressed = stan toggle.
            <button
              key={v.id}
              type="button"
              className={`variant ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedId(v.id)}
              aria-label={`${v.name} — podświetl ten wariant`}
              aria-pressed={isSelected}
            >
              <header>
                <div className="v-id">{v.name}</div>
                <div className="v-tag">{v.tag}</div>
                {isSelected && <div className="v-selected">✓ Wybrany</div>}
              </header>
              <div className="v-rate">
                <strong>{(v.sfPct * 100).toFixed(1)}%</strong>
                <span>wartości dofinansowania</span>
              </div>
              <div className="v-stack">
                <div className="v-row">
                  <span>Opłata wstępna</span>
                  <strong>{fmt(v.base)}</strong>
                </div>
                <div className="v-row big">
                  <span>Wynagrodzenie wynikowe</span>
                  <strong>{fmt(v.sfAmount)}</strong>
                </div>
                <div className="v-divider" />
                <div className="v-row total">
                  <span>Razem (szacunkowo)</span>
                  <strong>{fmt(v.total)}</strong>
                </div>
              </div>
              <div className="v-schedule">
                <div className="v-sched-label">Harmonogram płatności</div>
                {(v.payment ?? []).map((p, i) => (
                  <div key={i} className="v-sched-row">
                    <div className="v-sched-bar" style={{ width: `${p.pct}%` }} />
                    <div className="v-sched-text">
                      <strong>{p.pct}%</strong> <span>{p.when}</span>
                    </div>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="exec-fee">
          <div>
            <div className="ef-kicker">{execFee.kicker}</div>
            <h4>{execFee.title}</h4>
            <p style={{ whiteSpace: 'pre-wrap' }}>{execFee.desc}</p>
          </div>
          <div className="ef-price">
            <strong>{fmt(execFee.monthly ?? selected.monthly)}</strong>
            <span>netto / miesiąc</span>
          </div>
        </div>
      )}
    </>
  );
}
