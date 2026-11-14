/**
 * Podział punktów założeń (slajd 04b) na kolejne slajdy, gdy nie mieszczą się na jednym.
 * Slajd ma stały rozmiar, a zmniejszanie czcionki (bulletsSize) ma dolną granicę czytelności,
 * więc dłuższe założenia idą na slajd kontynuacji. Dzielimy po całych punktach, bez cięcia
 * punktu w połowie; jeden bardzo długi punkt nadal może przekroczyć slajd (wtedy 422).
 */

/**
 * Najwięcej „wagi" (znaki plus koszt punktu), która mieści się na jednym slajdzie.
 * Pomiar na wyrenderowanych slajdach 16:9 (limit treści 668 px): waga 4654 mieści się
 * z zapasem, 5430 nachodzi na stopkę o 2 px, a 6059 o 1 px. Liczymy w wadze, nie w
 * samych znakach, bo przy tej samej liczbie znaków slajd z większą liczbą punktów jest
 * wyższy, a przy podziale po znakach wychodził o jeden slajd za mało.
 */
export const BULLETS_SINGLE_MAX = 4600;
/** Koszt miejsca jednego punktu poza jego tekstem (odstęp, numer); wyrównuje slajdy po wysokości, nie po znakach. */
export const BULLET_OVERHEAD = 150;

export type BulletsPage = {
  bullets: string[];
  /** Ile punktów było na wcześniejszych slajdach (numeracja idzie dalej). */
  offset: number;
};

export function splitBullets(bullets: string[], singleMax: number = BULLETS_SINGLE_MAX): BulletsPage[] {
  const total = bullets.reduce((sum, b) => sum + b.length, 0);
  // Ta sama miara decyduje o liczbie slajdów i o ich wyrównaniu. Wcześniej liczba slajdów
  // szła z samych znaków, a wyrównanie z wagi, więc 13 krótkich punktów zajmowało więcej
  // miejsca niż 9 długich o tej samej liczbie znaków i slajd nachodził na stopkę.
  const totalWeight = total + bullets.length * BULLET_OVERHEAD;
  const pageCount = Math.max(1, Math.ceil(totalWeight / singleMax));
  if (pageCount === 1) return [{ bullets, offset: 0 }];
  const target = totalWeight / pageCount;
  const pages: BulletsPage[] = [];
  let current: string[] = [];
  let weight = 0;
  let offset = 0;
  bullets.forEach((b, i) => {
    current.push(b);
    weight += b.length + BULLET_OVERHEAD;
    if (i < bullets.length - 1 && weight >= target && pages.length < pageCount - 1) {
      pages.push({ bullets: current, offset });
      offset += current.length;
      current = [];
      weight = 0;
    }
  });
  if (current.length > 0) pages.push({ bullets: current, offset });
  return pages;
}

/**
 * Podział uwag do oferty (slajd 04c) na kolejne slajdy. Czcionka uwag ma dolną granicę
 * czytelności (11 px), więc dłuższy tekst idzie na slajd kontynuacji. Dzielimy po całych
 * akapitach (puste linie), bez cięcia akapitu w połowie; jeden bardzo długi akapit nadal
 * może przekroczyć slajd (wtedy 422).
 *
 * Waga to znaki plus koszt każdego podziału akapitu (pusta linia zajmuje miejsce jak
 * kilkadziesiąt znaków). Pojemności z pomiaru na wyrenderowanych slajdach 16:9 przy 11 px
 * (oferta K2/2026/11/007: 3824 znaków w 8 akapitach przekraczało 04c o 409 px):
 * - pierwszy slajd z kartą opłaty (uwagi w węższej kolumnie): waga 2171 mieści się z zapasem
 *   22 px, a około 2320 nachodzi na stopkę;
 * - slajd bez karty opłaty (jedna szeroka kolumna): waga 3100 mieści się z zapasem 22 px.
 */
export const NOTES_FIRST_MAX_WITH_EXEC = 2250;
export const NOTES_PAGE_MAX = 3000;
export const NOTES_PARAGRAPH_COST = 100;

/**
 * `hasExec`: pierwszy slajd dzieli kolumnę z kartą opłaty, więc mieści mniej. Kolejne slajdy
 * nie mają karty. Wybieramy najmniejszą liczbę slajdów, przy której każdy się mieści, a w jej
 * ramach podział o najmniejszym największym obciążeniu (slajdy mniej więcej równe).
 * Pusty tekst daje jeden pusty element, bo slajd z samą opłatą też jest slajdem.
 */
export function splitNotes(notes: string, hasExec: boolean): string[] {
  const text = notes.trim();
  if (text === '') return [''];
  const paras = text.split(/\n{2,}/).map((x) => x.trim()).filter((x) => x !== '');
  const m = paras.length;
  const cap = (page: number) => (page === 0 && hasExec ? NOTES_FIRST_MAX_WITH_EXEC : NOTES_PAGE_MAX);
  const prefix = [0];
  paras.forEach((x) => prefix.push(prefix[prefix.length - 1] + x.length));
  // Obciążenie strony (od akapitu a do b, bez b) względem jej pojemności.
  const load = (page: number, a: number, b: number) =>
    (prefix[b] - prefix[a] + (b - a - 1) * NOTES_PARAGRAPH_COST) / cap(page);
  let best: { ratio: number; cuts: number[] } | null = null;
  for (let n = 1; n <= m; n++) {
    // dp[k][i]: najmniejsze możliwe największe obciążenie, gdy pierwsze i akapitów leży na k stronach.
    const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
    const from: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(-1));
    dp[0][0] = 0;
    for (let k = 1; k <= n; k++) {
      for (let i = k; i <= m; i++) {
        for (let j = k - 1; j < i; j++) {
          const v = Math.max(dp[k - 1][j], load(k - 1, j, i));
          if (v < dp[k][i]) {
            dp[k][i] = v;
            from[k][i] = j;
          }
        }
      }
    }
    const ratio = dp[n][m];
    if (best === null || ratio < best.ratio) {
      const cuts: number[] = [];
      let i = m;
      for (let k = n; k >= 1; k--) {
        cuts.unshift(i);
        i = from[k][i];
      }
      best = { ratio, cuts };
    }
    if (ratio <= 1) break; // najmniejsza liczba slajdów, przy której wszystko się mieści
  }
  const cuts = best!.cuts;
  const pages: string[] = [];
  let start = 0;
  for (const end of cuts) {
    pages.push(paras.slice(start, end).join('\n\n'));
    start = end;
  }
  return pages;
}
