import { describe, expect, it } from 'vitest';
import { checkSlides, countPdfPages, type SlideMetric } from './slides-check';

const slide = (page: number, label: string, over: Partial<SlideMetric> = {}): SlideMetric => ({
  page,
  label,
  clipped: false,
  overlap: false,
  ...over,
});

describe('checkSlides', () => {
  const ok = [slide(1, 'okładka'), slide(2, '01'), slide(3, '02')];

  it('wszystkie slajdy mieszczą treść i stron tyle co slajdów', () => {
    expect(checkSlides(ok, 3)).toEqual({ ok: true });
  });

  it('brak slajdów (zły token, wersja robocza, oferta innego rodzaju)', () => {
    expect(checkSlides([], 0)).toEqual({ ok: false, reason: 'NO_SLIDES', details: [] });
  });

  it('inna liczba stron niż slajdów, np. pusta dodatkowa strona', () => {
    const r = checkSlides(ok, 4);
    expect(r).toEqual({ ok: false, reason: 'PAGE_COUNT', details: ['stron PDF: 4, slajdów: 3'] });
  });

  it('liczba stron ma pierwszeństwo przed przycięciem, jak w skrypcie', () => {
    const r = checkSlides([slide(1, 'okładka'), slide(2, '03', { overlap: true })], 3);
    expect(r).toMatchObject({ ok: false, reason: 'PAGE_COUNT' });
  });

  it('wskazuje slajdy z przyciętą treścią i nachodzące na stopkę, z numerem sekcji', () => {
    const r = checkSlides(
      [slide(1, 'okładka'), slide(2, '03', { overlap: true }), slide(3, '04c', { clipped: true }), slide(4, '05')],
      4,
    );
    expect(r).toEqual({
      ok: false,
      reason: 'OVERFLOW',
      details: ['03 (strona 2: nachodzi na stopkę)', '04c (strona 3: przycięty)'],
    });
  });
});

describe('countPdfPages', () => {
  const pdf = (body: string) => new TextEncoder().encode(body);

  it('liczy obiekty /Type /Page i pomija /Type /Pages', () => {
    const bytes = pdf('<< /Type /Pages /Kids [1 0 R] >> << /Type /Page >> << /Type/Page >> << /Type  /Page >>');
    expect(countPdfPages(bytes)).toBe(3);
  });

  it('pusty dokument ma zero stron', () => {
    expect(countPdfPages(pdf(''))).toBe(0);
  });
});
