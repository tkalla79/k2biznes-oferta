/**
 * Podział punktów założeń (slajd 04b) na kolejne slajdy, gdy nie mieszczą się na jednym.
 * Slajd ma stały rozmiar, a zmniejszanie czcionki (bulletsSize) ma dolną granicę czytelności,
 * więc dłuższe założenia idą na slajd kontynuacji. Dzielimy po całych punktach, bez cięcia
 * punktu w połowie; jeden bardzo długi punkt nadal może przekroczyć slajd (wtedy 422).
 */

/** Najwięcej znaków, które mieszczą się na jednym slajdzie (pomiar: 4024 znaki, zapas 15 px). */
export const BULLETS_SINGLE_MAX = 4100;
/** Koszt miejsca jednego punktu poza jego tekstem (odstęp, numer); wyrównuje slajdy po wysokości, nie po znakach. */
const BULLET_OVERHEAD = 150;

export type BulletsPage = {
  bullets: string[];
  /** Ile punktów było na wcześniejszych slajdach (numeracja idzie dalej). */
  offset: number;
};

export function splitBullets(bullets: string[], singleMax: number = BULLETS_SINGLE_MAX): BulletsPage[] {
  const total = bullets.reduce((sum, b) => sum + b.length, 0);
  const pageCount = Math.max(1, Math.ceil(total / singleMax));
  if (pageCount === 1) return [{ bullets, offset: 0 }];
  // Równa „wysokość" slajdów (znaki plus koszt punktu), bo 13 krótkich punktów zajmuje więcej
  // miejsca niż 9 długich o tej samej liczbie znaków (pomiar: 2632 znaki w 13 punktach nie mieściły się).
  const target = (total + bullets.length * BULLET_OVERHEAD) / pageCount;
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
