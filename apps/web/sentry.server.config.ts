/**
 * Sentry — server (Node runtime) config.
 * PII scrubbing per BACKEND_SPEC.md sekcja 12.1.
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,
  sendDefaultPii: false,

  beforeSend(event) {
    // Strip token z URL `/o/[token]`
    if (event.request?.url) {
      event.request.url = event.request.url.replace(/\/o\/[^/?#]+/, '/o/[REDACTED]');
    }
    // Strip cookies (moga zawierac sb-* auth tokens)
    if (event.request) {
      delete event.request.cookies;
    }
    // Strip Authorization headers
    if (event.request?.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (/auth|cookie|token|key/i.test(key)) {
          event.request.headers[key] = '[REDACTED]';
        }
      }
    }
    // Strip emails z messages
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
});
