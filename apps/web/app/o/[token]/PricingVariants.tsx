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
  /**
   * Token oferty do trackingu zainteresowania wariantami (audyt 2026-07 pkt 6).
   * Podany tylko dla realnego klienta (nie preview/print) — undefined = brak
   * eventów variant_hovered / variant_selected.
   */
  trackToken?: string;
};

const fmt = (n: number) =>
  new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export default function PricingVariants({ variants, initialSelected, execFee, trackToken }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    initialSelected || variants[0]?.id || '',
  );
  const selected = variants.find((v) => v.id === selectedId) ?? variants[0] ?? null;

  // Tracking zainteresowania wariantami — dedup per (typ, wariant) na sesję,
  // fire-and-forget (UX nie zależy od trackingu). Backend przyjmuje te typy
  // od MVP; frontend dotąd ich nie emitował.
  function track(type: 'variant_hovered' | 'variant_selected', variant: string) {
    if (!trackToken) return;
    const key = `k2_${type}_${trackToken}_${variant}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* tryb prywatny — wysyłamy bez dedupu */
    }
    fetch(`/api/public/offers/${encodeURIComponent(trackToken)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload: { variant } }),
      keepalive: true,
    }).catch(() => {});
  }

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
              // preventDefault na mousedown blokuje focus-scroll (przeglądarka
              // dosuwała wysoką kartę do widoku przy kliku). Klik nadal podświetla;
              // dostępność klawiaturą (Tab + Enter/Space) zachowana.
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => track('variant_hovered', v.id)}
              onClick={() => {
                setSelectedId(v.id);
                track('variant_selected', v.id);
              }}
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

      {/* Audyt 2026-07: jednoznaczność cen — wszystkie kwoty netto (wymóg
          formalny oferty handlowej; wcześniej "netto" tylko przy 2 z ~10 kwot). */}
      <p className="vat-note">
        Wszystkie kwoty są kwotami netto — do faktur zostanie doliczony podatek VAT (23%).
      </p>

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
