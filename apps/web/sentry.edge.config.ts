/**
 * Sentry — edge runtime (middleware) config.
 * Edge runtime ma podzbior @sentry/node API, ale beforeSend dziala.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
});
