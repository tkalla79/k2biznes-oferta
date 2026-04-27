/**
 * Rate limiting via Upstash Redis (BACKEND_SPEC.md v1.1, sekcja 5.1.1).
 *
 * - `/api/public/*` — 100 req/min per IP
 * - `/api/*` (authenticated) — 1000 req/min per user
 * - `/api/auth/signin` — 10 req/min per IP (sekcja 7.6, bruteforce protection)
 *
 * Jeśli RATE_LIMIT_REDIS_URL nie jest ustawione (lokalny dev), rate-limit jest no-op.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let cachedLimiters: { public: Ratelimit; auth: Ratelimit; signin: Ratelimit } | null = null;

function getLimiters() {
  if (cachedLimiters) return cachedLimiters;

  const url = process.env.RATE_LIMIT_REDIS_URL;
  const token = process.env.RATE_LIMIT_REDIS_TOKEN;
  if (!url || !token) return null;

  const redis = new Redis({ url, token });

  cachedLimiters = {
    public: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '60 s'),
      prefix: 'rl:pub',
      analytics: true,
    }),
    auth: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(1000, '60 s'),
      prefix: 'rl:auth',
      analytics: true,
    }),
    signin: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:signin',
      analytics: true,
    }),
  };
  return cachedLimiters;
}

export type LimitResult = {
  success: boolean;
  remaining: number;
  reset: number; // unix seconds
};

export async function checkRateLimit(
  bucket: 'public' | 'auth' | 'signin',
  key: string,
): Promise<LimitResult> {
  const limiters = getLimiters();
  if (!limiters) {
    // Lokalny dev bez Upstash → bypass.
    return { success: true, remaining: 999, reset: 0 };
  }
  const r = await limiters[bucket].limit(key);
  return { success: r.success, remaining: r.remaining, reset: Math.floor(r.reset / 1000) };
}
