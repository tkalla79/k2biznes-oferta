#!/usr/bin/env node
/**
 * PROTOTYP: lokalny PDF 16:9 z trasy /o/<token>/slajdy.
 *
 *   LOCAL_CHROME_PATH="/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
 *     node scripts/render-slides-pdf.mjs <token> [plik.pdf] [adres-aplikacji]
 *
 * Bez nazwy pliku zapisuje oferta-<numer oferty>-slajdy.pdf w bieżącym katalogu
 * (numer w nazwie, żeby PDF jednego klienta nie nadpisał PDF innego).
 *
 * Nie dotyka produkcyjnego PDF (apps/web/lib/pdf/render.ts). Używa tej samej
 * biblioteki (puppeteer-core), ale z rozmiarem strony 1280x720 z CSS (@page).
 *
 * Kod wyjścia inny niż 0 oznacza: nie wysyłaj tego PDF klientowi.
 *   0  PDF zapisany, każdy slajd mieści treść, stron tyle co slajdów
 *   1  złe wywołanie (brak tokenu albo LOCAL_CHROME_PATH)
 *   2  trasa nie zwróciła slajdów (zły token, wersja robocza, wygasła oferta albo
 *      oferta innego rodzaju niż dotacyjna); PDF NIE zapisany
 *   3  PDF zapisany, ale treść nie mieści się na części slajdów (są przycinane,
 *      nie przenoszone na kolejną stronę)
 *   4  PDF zapisany, ale liczba stron różni się od liczby slajdów
 *   5  błąd w trakcie pracy (np. serwer nie odpowiada)
 */
import puppeteer from 'puppeteer-core';
import { writeFile } from 'node:fs/promises';

const [token, outArg, base = process.env.APP_URL ?? 'http://localhost:3000'] = process.argv.slice(2);
const chrome = process.env.LOCAL_CHROME_PATH;

if (!token || !chrome) {
  console.error(
    'Użycie: LOCAL_CHROME_PATH=<chrome lub edge> node scripts/render-slides-pdf.mjs <token> [plik.pdf] [adres-aplikacji]',
  );
  process.exit(1);
}

// Strony PDF to obiekty /Type /Page (bez /Pages i innych /Page...).
const countPdfPages = (pdf) =>
  (Buffer.from(pdf).toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;

let exitCode = 0;
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.goto(`${base}/o/${encodeURIComponent(token)}/slajdy`, {
    waitUntil: 'networkidle0',
    timeout: 30_000,
  });
  await page.evaluate(() => document.fonts.ready);
  // PDF powstaje w trybie druku, więc w nim też mierzymy.
  await page.emulateMediaType('print');

  // Slajd nie mieści treści, gdy (a) wychodzi poza dolną krawędź albo (b) nachodzi na stopkę
  // (stopka jest pozycjonowana absolutnie, więc samo scrollHeight tego nie widzi).
  // Etykieta to numer sekcji ze stopki (np. 04b), bo slajdy 01, 04b i 04c są warunkowe i
  // numer strony nie odpowiada numerowi sekcji.
  const slides = await page.evaluate(() =>
    [...document.querySelectorAll('.sl')].map((s, i) => {
      const top = s.getBoundingClientRect().top;
      const foot = s.querySelector('.sl-foot');
      const limit = foot ? foot.getBoundingClientRect().top - top : s.clientHeight;
      let bottom = 0;
      for (const el of s.querySelectorAll('*')) {
        if (el.closest('.sl-foot, .sl-ring-wrap')) continue;
        bottom = Math.max(bottom, el.getBoundingClientRect().bottom - top);
      }
      return {
        page: i + 1,
        label: foot ? foot.lastElementChild.textContent.trim() : 'okładka',
        clipped: s.scrollHeight > s.clientHeight + 1,
        overlap: bottom > limit + 1,
      };
    }),
  );

  if (slides.length === 0) {
    const seen = await page.evaluate(
      () => `${document.title} | ${document.body.innerText.trim().slice(0, 100).replace(/\s+/g, ' ')}`,
    );
    console.error(
      `BŁĄD: trasa nie zwróciła żadnego slajdu (widać: "${seen}"). Zły token, wersja robocza, oferta wygasła ` +
        'albo oferta innego rodzaju niż dotacyjna. PDF nie został zapisany.',
    );
    exitCode = 2;
  } else {
    const number = await page.evaluate(
      () => (document.querySelector('.sl-pill')?.textContent ?? '').match(/K2\/\d{4}\/\d{2}\/\d+/)?.[0] ?? '',
    );
    const out = outArg || `oferta-${number ? number.replaceAll('/', '-') : 'bez-numeru'}-slajdy.pdf`;
    const pdf = await page.pdf({
      width: '1280px',
      height: '720px',
      printBackground: true,
      preferCSSPageSize: true,
    });
    await writeFile(out, pdf);

    const pages = countPdfPages(pdf);
    const bad = slides
      .filter((s) => s.clipped || s.overlap)
      .map((s) => `${s.label} (strona ${s.page}: ${s.clipped ? 'przycięty' : 'nachodzi na stopkę'})`);
    console.log(`Zapisano ${out} (${(pdf.length / 1024).toFixed(0)} KB), slajdów: ${slides.length}, stron PDF: ${pages}`);
    if (pages !== slides.length) {
      console.error(
        `BŁĄD: stron w PDF (${pages}) jest inaczej niż slajdów (${slides.length}), np. pusta dodatkowa strona. Nie wysyłaj tego PDF.`,
      );
      exitCode = 4;
    }
    if (bad.length) {
      console.error(`BŁĄD: treść nie mieści się na slajdach: ${bad.join(', ')}. Nie wysyłaj tego PDF.`);
      exitCode = exitCode || 3;
    }
    if (!exitCode) console.log('Treść mieści się na wszystkich slajdach.');
  }
} catch (e) {
  console.error(`BŁĄD: ${e.message}`);
  exitCode = 5;
} finally {
  // Na żywej trasie close() potrafił nie wrócić i proces wisiał po zapisie PDF.
  await Promise.race([browser.close(), new Promise((r) => setTimeout(r, 5000))]);
  browser.process()?.kill('SIGKILL');
}
process.exit(exitCode);
