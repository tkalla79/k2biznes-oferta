import { describe, expect, it } from 'vitest';
import { BULLETS_SINGLE_MAX, splitBullets } from './paginate';

const b = (n: number) => 'x'.repeat(n);

describe('splitBullets', () => {
  it('mieszczące się punkty zostają na jednym slajdzie', () => {
    const bullets = [b(1000), b(1000), b(900)];
    expect(splitBullets(bullets)).toEqual([{ bullets, offset: 0 }]);
    // BULLETS_SINGLE_MAX to waga (znaki + 150 za punkt), więc jeden punkt mieści się,
    // gdy ma o te 150 mniej znaków.
    expect(splitBullets([b(BULLETS_SINGLE_MAX - 150)])).toHaveLength(1);
    expect(splitBullets([b(BULLETS_SINGLE_MAX - 150), b(1)])).toHaveLength(2);
  });

  it('pusta lista daje jeden pusty slajd (wywołujący i tak go nie renderuje)', () => {
    expect(splitBullets([])).toEqual([{ bullets: [], offset: 0 }]);
  });

  it('dzieli po całych punktach na w miarę równe slajdy i ciągnie numerację', () => {
    const bullets = Array.from({ length: 12 }, () => b(500)); // waga 6000 + 12*150 = 7800 -> 2 slajdy
    const pages = splitBullets(bullets);
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.bullets.length)).toEqual([6, 6]);
    expect(pages.map((p) => p.offset)).toEqual([0, 6]);
    expect(pages.flatMap((p) => p.bullets)).toEqual(bullets);
  });

  it('nie tnie punktu i nie gubi żadnego; liczba slajdów rośnie z długością', () => {
    const bullets = [b(3500), b(100), b(3500), b(100), b(3500)]; // waga 10700 + 5*150 = 11450 -> 3 slajdy
    const pages = splitBullets(bullets);
    expect(pages).toHaveLength(3);
    expect(pages.flatMap((p) => p.bullets)).toEqual(bullets);
    expect(pages.every((p) => p.bullets.length > 0)).toBe(true);
  });

  it('wyrównuje slajdy po wysokości: więcej krótkich punktów ląduje na slajdzie z mniejszą liczbą znaków', () => {
    const bullets = [...Array.from({ length: 9 }, () => b(340)), ...Array.from({ length: 13 }, () => b(200))]; // 5660
    const [first, second] = splitBullets(bullets);
    const chars = (p: string[]) => p.reduce((n, x) => n + x.length, 0);
    expect(chars(first.bullets)).toBeGreaterThan(chars(second.bullets));
    expect(first.bullets.length).toBeLessThan(second.bullets.length);
  });

  // Regresja: oferty Bio Herbs (K2/2026/11/003 i 004) dostawały o jeden slajd za mało,
  // bo liczba slajdów szła z samych znaków. Slajdy 04b nachodziły wtedy na stopkę.
  it('długie założenia dostają tyle slajdów, ile wynika z wagi, a nie z samych znaków', () => {
    // 25 punktów, 7200 znaków (Dig.IT): po znakach wychodziły 2 slajdy, po wadze 3.
    expect(splitBullets(Array.from({ length: 25 }, () => b(288)))).toHaveLength(3);
    // 23 punkty, 8142 znaki (SMART).
    expect(splitBullets(Array.from({ length: 23 }, () => b(354)))).toHaveLength(3);
    // 24 punkty, 5472 znaki (PSM METALLBAU) nadal mieszczą się na dwóch slajdach.
    expect(splitBullets(Array.from({ length: 24 }, () => b(228)))).toHaveLength(2);
  });

  it('jeden bardzo długi punkt zostaje w całości (nie da się go podzielić po punktach)', () => {
    const pages = splitBullets([b(7000)]);
    expect(pages.flatMap((p) => p.bullets)).toEqual([b(7000)]);
  });
});
