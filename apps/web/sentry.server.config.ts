/**
 * Sentry — server (Node runtime) config.
 * PII scrubbing per BACKEND_SPEC sekcja 12.1.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // M23 audit: tracesSampler zamiast flat 0.1 — krytyczne flow (accept/send/
  // recalculate/RODO) zawsze sampluje (1.0), reszta 10%. Wcześniej flat 0.1
  // losowo gubił trace akceptacji oferty (najważniejszy biznesowo moment).
  tracesSampler: (ctx) => {
    const name = ctx.name || '';
    if (/\/(accept|reject|send|recalculate|request-data-deletion)/.test(name)) return 1.0;
    return 0.1;
  },
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
