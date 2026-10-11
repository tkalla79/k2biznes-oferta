/**
 * Procent wynagrodzenia wynikowego w widoku klienta.
 *
 * Panel przyjmuje stawkę z dwoma miejscami po przecinku, a karta wariantu
 * pokazywała ją przez `toFixed(1)` — więc 9,06 % wyświetlało się jako 9,1 %.
 * Kwota w złotych liczyła się poprawnie (od 9,06 %), ale klient przeliczający
 * ofertę „na kartce" dostawał inną liczbę niż my. Dotyczy stawek wypadających
 * z formuły, a nie z okrągłej liczby.
 *
 * Zbędne zera obcinamy, żeby 6 % nie czytało się jako „6,00 %".
 */
export function formatSfPct(fraction: number): string {
  if (!Number.isFinite(fraction)) return '0';
  const pct = Math.round(fraction * 10000) / 100;
  return pct.toLocaleString('pl-PL', { maximumFractionDigits: 2 });
}
