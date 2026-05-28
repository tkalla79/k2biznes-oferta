/**
 * Sentry — client (browser) config.
 * PII scrubbing per BACKEND_SPEC sekcja 12.1.
 */
import * as Sentry from '@sentry/nextjs';
import { scrubEvent } from '@/lib/sentry-scrub';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,
  sendDefaultPii: false,

  beforeSend: scrubEvent,

  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'NetworkError',
    'Failed to fetch',
  ],
});

// Defensive: nikt nie powinien wywolac setUser, ale gdyby — zerujemy.
Sentry.setUser(null);
