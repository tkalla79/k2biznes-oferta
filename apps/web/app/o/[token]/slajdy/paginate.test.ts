import { describe, expect, it } from 'vitest';
import { BULLETS_SINGLE_MAX, splitBullets } from './paginate';

const b = (n: number) => 'x'.repeat(n);

describe('splitBullets', () => {
  it('mieszczące się punkty zostają na jednym slajdzie', () => {
    const bullets = [b(1000), b(1000), b(900)];
    expect(splitBullets(bullets)).toEqual([{ bullets, offset: 0 }]);
    expect(splitBullets([b(BULLETS_SINGLE_MAX)])).toHaveLength(1);
    expect(splitBullets([b(BULLETS_SINGLE_MAX), b(1)])).toHaveLength(2);
  });

  it('pusta lista daje jeden pusty slajd (wywołujący i tak go nie renderuje)', () => {
    expect(splitBullets([])).toEqual([{ bullets: [], offset: 0 }]);
  });

  it('dzieli po całych punktach na w miarę równe slajdy i ciągnie numerację', () => {
    const bullets = Array.from({ length: 12 }, () => b(500)); // 6000 znaków > 4100 -> 2 slajdy
    const pages = splitBullets(bullets);
    expect(pages).toHaveLength(2);
    expect(pages.map((p) => p.bullets.length)).toEqual([6, 6]);
    expect(pages.map((p) => p.offset)).toEqual([0, 6]);
    expect(pages.flatMap((p) => p.bullets)).toEqual(bullets);
  });

  it('nie tnie punktu i nie gubi żadnego; liczba slajdów rośnie z długością', () => {
    const bullets = [b(3500), b(100), b(3500), b(100), b(3500)]; // 10700 -> 3 slajdy
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

  it('jeden bardzo długi punkt zostaje w całości (nie da się go podzielić po punktach)', () => {
    const pages = splitBullets([b(7000)]);
    expect(pages.flatMap((p) => p.bullets)).toEqual([b(7000)]);
  });
});
