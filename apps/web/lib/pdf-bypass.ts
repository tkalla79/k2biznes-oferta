/**
 * HMAC bypass dla Edge Function PDF (BACKEND_SPEC.md v1.1, sekcja 9.1.1).
 *
 * Edge Function generująca PDF wywołuje publiczny endpoint
 *   /o/<token>?print=true&__pdfBypass=<hmac>&__pdfTs=<unix>
 * a middleware sprawdza HMAC + wiek timestamp (max 60s) — jeśli OK, oznacza
 * request jako internal (omija rate-limit, wybiera print-friendly markup).
 */

const SECRET_ENV = 'PDF_BYPASS_SECRET';
const MAX_AGE_SEC = 60;
// Code review PR #4: spec mówi 32 bajty hex (= 64 chars). Wcześniej walidacja
// 16 chars była zbyt liberalna. 32 chars daje min 128 bitów entropy (jeśli
// hex), 64 chars to 256 bitów.
const MIN_SECRET_LENGTH = 32;

function getSecret(): string {
  const s = process.env[SECRET_ENV];
  if (!s || s.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `${SECRET_ENV} must be set (>=${MIN_SECRET_LENGTH} chars; spec: 32 bytes hex = 64 chars).`,
    );
  }
  return s;
}

function base64UrlEncode(bytes: Uint8Array): string {
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Generuje token bypass do użycia w URL przez Edge Function.
 */
export async function signPdfBypass(token: string): Promise<{ sig: string; ts: number }> {
  const ts = Math.floor(Date.now() / 1000);
  const message = `${token}:${ts}`;
  const sig = await hmacSha256(getSecret(), message);
  return { sig: base64UrlEncode(sig), ts };
}

/**
 * Weryfikacja w middleware. Zwraca true jeśli HMAC i timestamp są OK.
 */
export async function verifyPdfBypass(
  token: string,
  sig: string,
  ts: string,
): Promise<boolean> {
  const tsNum = parseInt(ts, 10);
  if (!Number.isFinite(tsNum)) return false;
  // Code review PR #4: jednostronny check (przeszłość) zamiast Math.abs.
  // Wcześniej `Math.abs(now - ts) > 60` akceptował też przyszłe timestamps,
  // efektywne okno ~120s zamiast 60s przy lekkim drift'cie zegara klienta.
  // Dopuszczamy mały skew zegara serwera (2s) na wypadek desync'u Lambda.
  const nowSec = Date.now() / 1000;
  const ageSec = nowSec - tsNum;
  if (ageSec < -2 || ageSec > MAX_AGE_SEC) return false;

  const expected = await hmacSha256(getSecret(), `${token}:${tsNum}`);
  let provided: Uint8Array;
  try {
    provided = base64UrlDecode(sig);
  } catch {
    return false;
  }
  return timingSafeEqual(expected, provided);
}
