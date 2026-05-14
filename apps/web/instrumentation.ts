/**
 * Next.js 14 instrumentation hook — auto-loaded przy starcie serwera.
 * Wymaga `experimental.instrumentationHook` w next.config (Next 15+ default true).
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
