/**
 * Rate limiting via Upstash Redis (BACKEND_SPEC.md v1.1.1, sekcja 5.1.1).
 *
 * - `/api/public/*` — 100 req/min per IP
 * - `/api/*` (authenticated) — 1000 req/min per user
 * - `/api/admin/*` — 30 req/min per IP (PR #18 review: katalog mgmt + invite +
 *   role + GDPR — write-heavy admin endpointy. 1000/min auth bucket = za
 *   liberalny, attacker z compromised admin creds mógłby spamować DB)
 * - `/api/auth/signin` — 10 req/min per IP (sekcja 7.6, bruteforce protection)
 * - `/api/auth/mfa/verify` — 10 req/min per IP (PR #13 review: TOTP brute-force)
 * - `/api/auth/request-data-deletion` — 5 req/24h per IP (sekcja 11.4, anti-spam)
 * - `/api/public/offers/[token]/pdf` — 5 req/min per IP (PR #4 review:
 *   PDF render = ~17s CPU, brak limitu = realny DoS przez wyczerpanie Lambda)
 *
 * Jeśli RATE_LIMIT_REDIS_URL nie jest ustawione (lokalny dev), rate-limit jest no-op.
 */
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Bucket = 'public' | 'auth' | 'admin' | 'signin' | 'restrictive' | 'expensive';

let cachedLimiters: Record<Bucket, Ratelimit> | null = null;

function getLimiters(): Record<Bucket, Ratelimit> | null {
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
    // `admin`: dla `/api/admin/*` — write-heavy, gated przez requireAdmin.
    // 30/min/IP = realne admin operacje (kilka klików/sekundę), poniżej DoS.
    // Auth bucket (1000/min) byłby za liberalny: admin compromised credentials
    // + spam PATCH = DB write contention.
    admin: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '60 s'),
      prefix: 'rl:admin',
      analytics: true,
    }),
    signin: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'rl:signin',
      analytics: true,
    }),
    // `restrictive`: dla endpointów public, które piszą do DB i wysyłają emaile
    // — np. /api/auth/request-data-deletion (RODO). 5 prób na 24h chroni przed
    // spam'em DB i wyczerpaniem limitu Resend.
    restrictive: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '86400 s'),
      prefix: 'rl:strict',
      analytics: true,
    }),
    // `expensive`: dla endpointów public uruchamiających ciężkie operacje
    // (PDF render Puppeteer ~17s CPU). 5/min/IP zapobiega DoS przez wyczerpanie
    // Lambda concurrency.
    expensive: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '60 s'),
      prefix: 'rl:exp',
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
  bucket: Bucket,
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
