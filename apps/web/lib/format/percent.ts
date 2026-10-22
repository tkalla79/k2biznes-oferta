/**
 * Procent widoczny dla klienta, z dokładnością do dwóch miejsc po przecinku.
 *
 * Panel przyjmuje stawkę z dwoma miejscami po przecinku, a karta wariantu
 * pokazywała ją przez `toFixed(1)` — więc 9,06 % wyświetlało się jako 9,1 %.
 * Kwota w złotych liczyła się poprawnie (od 9,06 %), ale klient przeliczający
 * ofertę „na kartce" dostawał inną liczbę niż my. Dotyczy stawek wypadających
 * z formuły, a nie z okrągłej liczby.
 *
 * Ta sama klasa błędu: intensywność dofinansowania pokazywana przez
 * `Math.round(fundingRate * 100)` — 45,5 % czytało się jako 46 %, a kwota
 * dofinansowania obok liczyła się od 45,5 %.
 *
 * Zbędne zera obcinamy, żeby 6 % nie czytało się jako „6,00 %".
 * Zwraca liczbę bez znaku „%" — dopisuje go wywołujący.
 */
export function formatPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0';
  const pct = Math.round(fraction * 10000) / 100;
  return pct.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}

/** Procent wynagrodzenia wynikowego — to samo co `formatPct`, nazwa zostaje dla czytelności wywołań. */
export const formatSfPct = formatPct;
