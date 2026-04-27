/**
 * Edge-safe client IP extraction (BACKEND_SPEC.md v1.1.1, sekcja 11.7).
 *
 * Wydzielone z `lib/ip-hash.ts` żeby nie wciągać `node:crypto` do middleware
 * (Next.js Edge Runtime nie wspiera Node built-ins). `lib/ip-hash.ts` używa
 * tej funkcji do hashowania IP w Node runtime'ie.
 *
 * Kolejność źródeł (PR #2 code review fix):
 * 1. `x-real-ip` — Vercel/Next.js wstrzykuje real client IP, NIE da się sfałszować
 *    przez klienta (override'owane przez proxy edge).
 * 2. `x-forwarded-for` — fallback. Bierzemy OSTATNI wpis (najbliżej naszego
 *    serwera), bo atakujący kontroluje początek listy, proxy dokleja swoje IP
 *    na końcu.
 */
export function getClientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip');
  if (realIp) return realIp.trim();

  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const parts = xff.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return '127.0.0.1';
}
