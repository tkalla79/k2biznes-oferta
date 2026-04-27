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
    cachedBrowser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
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
  const page = await browser.newPage();
  try {
    await page.goto(opts.url, {
      waitUntil: 'networkidle0',
      timeout: opts.timeoutMs ?? 20_000,
    });
    const bytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', right: '16mm', bottom: '20mm', left: '16mm' },
    });
    return new Uint8Array(bytes);
  } finally {
    await page.close();
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
