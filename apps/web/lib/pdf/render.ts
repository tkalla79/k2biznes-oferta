/**
 * PDF renderer (BACKEND_SPEC.md v1.1.1, sekcja 9.1).
 *
 * Strategy:
 * - Lokalnie (dev): puppeteer-core używa Chrome'a wskazanego przez `LOCAL_CHROME_PATH`.
 *   Bez tej zmiennej — rzucamy 503 NOT_CONFIGURED (graceful, nie crash całej aplikacji).
 * - Produkcja (Vercel/Lambda): puppeteer-core + `@sparticuz/chromium` (warunkowy import).
 *   Dependency `@sparticuz/chromium` powinna być dodana do package.json przed deployem
 *   na Vercel (Linux x64 binary, ~50 MB). Lokalnie nie instalujemy żeby nie ważyć
 *   node_modules.
 *
 * Auth: Edge → render route bypass przez HMAC `__pdfBypass` (sekcja 9.1.1, lib/pdf-bypass.ts).
 */
import type { Browser } from 'puppeteer-core';
import { collectSlideMetrics, countPdfPages, type SlideMetric } from './slides-check';

let cachedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (cachedBrowser?.connected) return cachedBrowser;

  const puppeteer = await import('puppeteer-core');

  // Production (Vercel/AWS Lambda) — sparticuz/chromium
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    type SparticuzChromium = {
      args: string[];
      defaultViewport: { width: number; height: number } | null;
      executablePath: () => Promise<string>;
      headless: boolean | 'shell';
    };
    let chromium: SparticuzChromium;
    try {
      // Conditional import — pakiet musi być w deps tylko w prod (sekcja 2 spec'a).
      // Dynamic import string omija type-check; pakiet nie istnieje lokalnie.
      const moduleName = '@sparticuz/chromium';
      const mod = (await import(/* webpackIgnore: true */ moduleName)) as { default: SparticuzChromium };
      chromium = mod.default;
    } catch {
      throw new Error(
        'PDF_NOT_CONFIGURED_PROD: @sparticuz/chromium not installed (required for Vercel/Lambda).',
      );
    }
    // sparticuz v148+ wymaga chromium.headless ('shell'), nie literal true.
    cachedBrowser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    return cachedBrowser;
  }

  // Dev — local Chrome
  const localPath = process.env.LOCAL_CHROME_PATH;
  if (!localPath) {
    throw new Error(
      'PDF_NOT_CONFIGURED_DEV: ustaw LOCAL_CHROME_PATH w .env.local (np. /Applications/Google Chrome.app/Contents/MacOS/Google Chrome).',
    );
  }
  cachedBrowser = await puppeteer.launch({
    executablePath: localPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return cachedBrowser;
}

export type RenderOptions = {
  /** Pełny URL do print-friendly strony oferty z `__pdfBypass` w query. */
  url: string;
  /** Maks ms na załadowanie strony przed render'em. */
  timeoutMs?: number;
};

export async function renderOfferPdf(opts: RenderOptions): Promise<Uint8Array> {
  const browser = await getBrowser();
  // Code review PR #4: per-request browser context. `cachedBrowser` jest
  // re-używany między invocations Lambda — domyślny context sharuje
  // cookies/localStorage między stronami, co stwarza ryzyko cross-customer
  // leak. Tworzymy izolowany context per render i zamykamy go w `finally`.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  try {
    await page.goto(opts.url, {
      waitUntil: 'networkidle0',
      timeout: opts.timeoutMs ?? 20_000,
    });
    const bytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      // Marginesy zsynchronizowane z layoutem print w styles.css (kompaktowanie
      // PDF, uwagi 2026-06-15). Zmiana wpływa na paginację — sekcje są dostrojone
      // pod te wartości.
      margin: { top: '14mm', right: '12mm', bottom: '14mm', left: '12mm' },
    });
    return new Uint8Array(bytes);
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

export type SlidesRender = {
  /** PDF 16:9, jedna strona na slajd; pusty, gdy trasa nie zwróciła żadnego slajdu. */
  bytes: Uint8Array;
  /** Pomiar każdego slajdu w trybie druku (patrz slides-check.ts). */
  slides: SlideMetric[];
  /** Liczba stron w wygenerowanym PDF. */
  pages: number;
};

/**
 * PDF slajdów z trasy `/o/[token]/slajdy` (1280x720, rozmiar strony z CSS `@page`).
 * Osobna funkcja, bez zmian w `renderOfferPdf` (PDF A4). Nie ocenia wyniku: o tym,
 * czy PDF można wysłać, decyduje `checkSlides` w wywołującym.
 */
export async function renderSlidesPdf(opts: RenderOptions): Promise<SlidesRender> {
  const browser = await getBrowser();
  // Izolowany context per render, tak jak w renderOfferPdf (patrz komentarz wyżej).
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  try {
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto(opts.url, {
      waitUntil: 'networkidle0',
      timeout: opts.timeoutMs ?? 20_000,
    });
    await page.evaluate(() => document.fonts.ready);
    // PDF powstaje w trybie druku, więc w nim też mierzymy.
    await page.emulateMediaType('print');
    const slides = await page.evaluate(collectSlideMetrics);
    if (slides.length === 0) return { bytes: new Uint8Array(0), slides, pages: 0 };
    const bytes = new Uint8Array(
      await page.pdf({ width: '1280px', height: '720px', printBackground: true, preferCSSPageSize: true }),
    );
    return { bytes, slides, pages: countPdfPages(bytes) };
  } finally {
    await page.close().catch(() => {});
    await ctx.close().catch(() => {});
  }
}

/**
 * Used by tests / shutdown hooks. W normalnym run cache'owany browser zostaje
 * (Lambda re-use) — przy reload modułu Next dev usuwa go automatycznie.
 */
export async function closeBrowser(): Promise<void> {
  if (cachedBrowser?.connected) {
    await cachedBrowser.close();
  }
  cachedBrowser = null;
}
