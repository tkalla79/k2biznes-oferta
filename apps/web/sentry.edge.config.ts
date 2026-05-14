/**
 * Sentry — edge runtime (middleware) config.
 * Edge runtime nie wspiera @sentry/node, uzywamy bardzo lekkiego setupu.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
});
