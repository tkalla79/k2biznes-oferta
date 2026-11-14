import { describe, expect, it } from 'vitest';
import {
  BULLETS_SINGLE_MAX,
  NOTES_FIRST_MAX_WITH_EXEC,
  NOTES_PAGE_MAX,
  NOTES_PARAGRAPH_COST,
  splitBullets,
  splitNotes,
} from './paginate';

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

describe('splitNotes', () => {
  const para = (n: number) => 'a'.repeat(n);
  const joined = (...lens: number[]) => lens.map(para).join('\n\n');
  // Waga strony jak w kodzie: znaki + koszt podziału akapitu.
  const weight = (page: string) => {
    const ps = page.split('\n\n');
    return ps.reduce((sum, p) => sum + p.length, 0) + (ps.length - 1) * NOTES_PARAGRAPH_COST;
  };

  it('pusty tekst daje jeden pusty element (slajd z samą opłatą też jest slajdem)', () => {
    expect(splitNotes('', true)).toEqual(['']);
    expect(splitNotes('  \n\n ', false)).toEqual(['']);
  });

  it('mieszczące się uwagi zostają na jednym slajdzie', () => {
    const text = joined(500, 500, 500);
    expect(splitNotes(text, true)).toEqual([text]);
    expect(splitNotes(text, false)).toEqual([text]);
  });

  it('slajd z kartą opłaty mieści mniej niż slajd bez niej', () => {
    // Jeden akapit o wadze tuż nad pojemnością pierwszego slajdu z kartą, ale pod pojemnością slajdu bez niej.
    const text = joined(1200, 1100, 60); // waga 2360 + 200 = 2560 > 2250 i < 3000
    expect(splitNotes(text, true)).toHaveLength(2);
    expect(splitNotes(text, false)).toHaveLength(1);
  });

  it('regresja K2/2026/11/007: 8 akapitów, 3824 znaki, dzieli się na dwa slajdy, każdy się mieści', () => {
    const lens = [340, 305, 474, 752, 1118, 361, 345, 115];
    const text = joined(...lens);
    const pages = splitNotes(text, true);
    expect(pages).toHaveLength(2);
    // Podział po czwartym akapicie: 1871 i 1939 znaków (pomiar: 22 px i 145 px zapasu).
    expect(pages[0].split('\n\n').map((p) => p.length)).toEqual([340, 305, 474, 752]);
    expect(pages[1].split('\n\n').map((p) => p.length)).toEqual([1118, 361, 345, 115]);
    expect(weight(pages[0])).toBeLessThanOrEqual(NOTES_FIRST_MAX_WITH_EXEC);
    expect(weight(pages[1])).toBeLessThanOrEqual(NOTES_PAGE_MAX);
    // Bez karty opłaty ten sam tekst nadal wymaga dwóch slajdów (waga 4524 > 3000).
    expect(splitNotes(text, false)).toHaveLength(2);
  });

  it('nie gubi i nie tnie akapitów: sklejone strony dają ten sam tekst', () => {
    const text = joined(900, 800, 700, 600, 500, 400, 300, 200, 900, 800);
    for (const hasExec of [true, false]) {
      const pages = splitNotes(text, hasExec);
      expect(pages.join('\n\n')).toBe(text);
      expect(pages.length).toBeGreaterThan(1);
    }
  });

  it('liczba slajdów rośnie z długością, a jedna strona nie przekracza pojemności, gdy to możliwe', () => {
    const text = joined(1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000); // 8000 znaków
    const pages = splitNotes(text, true);
    expect(pages.length).toBeGreaterThanOrEqual(3);
    pages.forEach((pg, i) => expect(weight(pg)).toBeLessThanOrEqual(i === 0 ? NOTES_FIRST_MAX_WITH_EXEC : NOTES_PAGE_MAX));
  });

  it('jeden akapit dłuższy niż slajd zostaje w całości (renderer zgłosi 422), reszta się dzieli', () => {
    const text = joined(100, 4000, 100);
    const pages = splitNotes(text, true);
    expect(pages.join('\n\n')).toBe(text);
    expect(pages.some((pg) => pg.includes(para(4000)))).toBe(true);
  });

  it('normalizuje wiele pustych linii między akapitami', () => {
    expect(splitNotes('A\n\n\n\nB', true)).toEqual(['A\n\nB']);
  });
});
