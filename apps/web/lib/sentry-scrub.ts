/**
 * Wspolny PII scrubber dla Sentry (client + server + edge).
 * Per BACKEND_SPEC sekcja 12.1 — Sentry NIE wysyla emailow, imion, tokenow.
 *
 * Pokrycie:
 * - event.request.url (token w sciezce)
 * - event.message
 * - event.exception.values[].value
 * - event.breadcrumbs[] (URLs + messages — default integrations zbieraja fetch/console/navigation)
 * - event.user (defensive — zerujemy, nawet jak ktos zrobi setUser)
 * - event.contexts.trace.data["http.url"]
 * - event.extra (best effort)
 * - cookies + auth headers (server only)
 */
import type { ErrorEvent, EventHint } from '@sentry/nextjs';

// Token w URL `/o/<24-byte-base64url>`
const TOKEN_RE = /\/o\/[A-Za-z0-9_-]{8,}/g;
const TOKEN_REDACT = '/o/[REDACTED]';

// Email (broader niz prosty — pokrywa +tags, IDN-friendly, polskie znaki w local part)
const EMAIL_RE = /[a-zA-Z0-9._%+'-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const EMAIL_REDACT = '[EMAIL]';

// Hex/JWT-like tokens w URL query (np. ?token=abc123, ?code=xyz, ?__pdfBypass=...)
const QUERY_TOKEN_RE = /([?&](?:token|code|sig|__pdfBypass|__pdfTs)=)[^&#]+/gi;
const QUERY_TOKEN_REDACT = '$1[REDACTED]';

function scrubString(s: string): string {
  return s
    .replace(TOKEN_RE, TOKEN_REDACT)
    .replace(QUERY_TOKEN_RE, QUERY_TOKEN_REDACT)
    .replace(EMAIL_RE, EMAIL_REDACT);
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent {
  // Strip request URL + headers + cookies
  if (event.request) {
    if (event.request.url) event.request.url = scrubString(event.request.url);
    delete event.request.cookies;
    if (event.request.headers && typeof event.request.headers === 'object') {
      for (const key of Object.keys(event.request.headers)) {
        if (/auth|cookie|token|key/i.test(key)) {
          (event.request.headers as Record<string, string>)[key] = '[REDACTED]';
        }
      }
    }
    if (event.request.query_string && typeof event.request.query_string === 'string') {
      event.request.query_string = scrubString(event.request.query_string);
    }
  }

  // Strip message
  if (event.message) event.message = scrubString(event.message);

  // Strip exception values + stack frame vars (lokalne zmienne ktore Sentry zalapuje)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          // vars: locals z funkcji — moga zawierac email/token/password
          if (frame.vars && typeof frame.vars === 'object') {
            for (const k of Object.keys(frame.vars)) {
              if (/email|token|pass|secret|key/i.test(k)) {
                (frame.vars as Record<string, unknown>)[k] = '[REDACTED]';
              } else if (typeof frame.vars[k] === 'string') {
                (frame.vars as Record<string, unknown>)[k] = scrubString(
                  frame.vars[k] as string,
                );
              }
            }
          }
        }
      }
    }
  }

  // Strip breadcrumbs — default integrations zbieraja navigation/fetch/xhr/console
  if (event.breadcrumbs) {
    for (const bc of event.breadcrumbs) {
      if (bc.message) bc.message = scrubString(bc.message);
      if (bc.data && typeof bc.data === 'object') {
        for (const k of Object.keys(bc.data)) {
          if (typeof bc.data[k] === 'string') {
            bc.data[k] = scrubString(bc.data[k] as string);
          }
        }
      }
    }
  }

  // Strip event.user — defensive zerowanie nawet gdy ktos zrobil setUser
  if (event.user) {
    event.user = { id: event.user.id ? '[REDACTED]' : undefined };
  }

  // Trace context http.url
  if (event.contexts?.trace?.data && typeof event.contexts.trace.data === 'object') {
    const data = event.contexts.trace.data as Record<string, unknown>;
    for (const k of Object.keys(data)) {
      if (typeof data[k] === 'string') {
        data[k] = scrubString(data[k] as string);
      }
    }
  }

  // Extras best-effort
  if (event.extra && typeof event.extra === 'object') {
    for (const k of Object.keys(event.extra)) {
      if (typeof event.extra[k] === 'string') {
        event.extra[k] = scrubString(event.extra[k] as string);
      }
    }
  }

  return event;
}
