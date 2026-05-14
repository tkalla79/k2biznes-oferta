/**
 * Sentry — client (browser) config.
 * PII scrubbing per BACKEND_SPEC.md sekcja 12.1: nie wysylamy emailow,
 * imion klientow, tokenow oferty w URL.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Sample rate dla performance — niski, prod-friendly
  tracesSampleRate: 0.1,

  // Replay tylko dla bledow (oszczedza limit)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.0,

  // NIE wysylaj domyslnych PII (IP, user-agent, etc.)
  sendDefaultPii: false,

  beforeSend(event) {
    // Strip token z URL `/o/[token]` (token jest PII — moze byc enumerated)
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/\/o\/[^/?#]+/, '/o/[REDACTED]');
    }
    // Strip emails z error messages
    if (event.message) {
      event.message = event.message.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    }
    if (event.exception?.values) {
      for (const ex of event.exception.values) {
        if (ex.value) {
          ex.value = ex.value.replace(/[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
        }
      }
    }
    return event;
  },

  // Ignorujemy znane bledy zewnetrznych skryptow + browser-specific noise
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    'NetworkError',
    'Failed to fetch',
  ],
});
