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
