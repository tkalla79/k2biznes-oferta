/**
 * Sanityzuje `next=` query param przed użyciem w `redirect()` / `router.push()`.
 *
 * Bez tego atakujący może wstawić `?next=https://evil.com` i wykorzystać naszą
 * stronę jako open-redirect (phishing). Akceptujemy wyłącznie ścieżki względne,
 * zaczynające się od pojedynczego `/`. Protocol-relative `//evil.com` blokujemy
 * — przeglądarka traktuje je jak absolute URL.
 */
export function safeNext(next: string | null | undefined, fallback = '/admin'): string {
  if (!next || typeof next !== 'string') return fallback;
  // Musi zaczynać się od `/` ale NIE od `//` (protocol-relative).
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  // Nie zezwalaj na backslashe — niektóre przeglądarki traktują je jak `/`,
  // co pozwala obejść walidację (`/\\evil.com`).
  if (next.includes('\\')) return fallback;
  return next;
}
