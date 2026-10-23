/**
 * Kontrola PDF slajdów 16:9 po stronie serwera (trasa /o/[token]/slajdy).
 *
 * Te same warunki, które lokalny skrypt scripts/render-slides-pdf.mjs zamienia na kody
 * wyjścia 2, 3 i 4: brak slajdów, treść niemieszcząca się na slajdzie (przycięta albo
 * nachodząca na stopkę) i liczba stron PDF inna niż liczba slajdów. Serwer nie wysyła
 * takiego PDF, tylko błąd 422, bo slajdy nie dzielą treści na kolejne strony.
 */

export type SlideMetric = {
  /** Numer strony PDF (od 1). */
  page: number;
  /** Numer sekcji ze stopki (np. 04b); okładka nie ma stopki. */
  label: string;
  /** Treść wychodzi poza slajd. */
  clipped: boolean;
  /** Treść nachodzi na stopkę (stopka jest pozycjonowana absolutnie, więc samo scrollHeight tego nie widzi). */
  overlap: boolean;
};

/**
 * Wykonywane w przeglądarce przez `page.evaluate`, więc musi być samowystarczalne: bez
 * odwołań do modułu i bez składni, którą kompilator zamienia na pomocnicze funkcje
 * (spread po NodeList, `?.`). Mierzyć trzeba w trybie druku (`emulateMediaType('print')`),
 * bo PDF powstaje w tym trybie.
 */
export function collectSlideMetrics(): SlideMetric[] {
  const slides = Array.prototype.slice.call(document.querySelectorAll('.sl')) as Element[];
  return slides.map(function (s, i) {
    const top = s.getBoundingClientRect().top;
    const foot = s.querySelector('.sl-foot');
    const limit = foot ? foot.getBoundingClientRect().top - top : s.clientHeight;
    let bottom = 0;
    const all = Array.prototype.slice.call(s.querySelectorAll('*')) as Element[];
    for (let k = 0; k < all.length; k++) {
      const el = all[k];
      if (el.closest('.sl-foot, .sl-ring-wrap')) continue;
      bottom = Math.max(bottom, el.getBoundingClientRect().bottom - top);
    }
    const last = foot ? foot.lastElementChild : null;
    return {
      page: i + 1,
      label: foot ? (last && last.textContent ? last.textContent.trim() : '') : 'okładka',
      clipped: s.scrollHeight > s.clientHeight + 1,
      overlap: bottom > limit + 1,
    };
  });
}

export type SlidesCheck =
  | { ok: true }
  | { ok: false; reason: 'NO_SLIDES' | 'PAGE_COUNT' | 'OVERFLOW'; details: string[] };

/** Kolejność jak w skrypcie: brak slajdów, potem liczba stron, potem przycięcie. */
export function checkSlides(slides: SlideMetric[], pages: number): SlidesCheck {
  if (slides.length === 0) return { ok: false, reason: 'NO_SLIDES', details: [] };
  if (pages !== slides.length) {
    return { ok: false, reason: 'PAGE_COUNT', details: [`stron PDF: ${pages}, slajdów: ${slides.length}`] };
  }
  const bad = slides
    .filter((s) => s.clipped || s.overlap)
    .map((s) => `${s.label} (strona ${s.page}: ${s.clipped ? 'przycięty' : 'nachodzi na stopkę'})`);
  return bad.length > 0 ? { ok: false, reason: 'OVERFLOW', details: bad } : { ok: true };
}

/** Liczba obiektów /Type /Page w PDF z Chromium (`/Pages` nie jest liczone). */
export function countPdfPages(bytes: Uint8Array): number {
  const text = Buffer.from(bytes).toString('latin1');
  return (text.match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
}
