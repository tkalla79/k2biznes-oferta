/**
 * Wspolny PII scrubber dla Sentry (client + server + edge).
 * Per BACKEND_SPEC sekcja 12.1 — Sentry NIE wysyla emailow, imion, tokenow.
 *
 * Pokrycie:
 * - event.request.url + query_string (token w sciezce + JWT/access_token w query)
 * - event.message
 * - event.exception.values[].value
 * - event.exception.values[].stacktrace.frames[].vars (rekurencyjnie, depth-limited)
 * - event.breadcrumbs[] (URLs + data, rekurencyjnie)
 * - event.user (defensive zerowanie nawet po setUser)
 * - event.contexts.trace.data["http.url"]
 * - event.extra (rekurencyjnie)
 * - cookies + auth headers (server only)
 */
import type { ErrorEvent, EventHint } from '@sentry/nextjs';

// Token w URL `/o/<token>` — zawezone {8,} dla prod (24-byte base64url ≈ 32),
// ale fallback dla wszystkiego po /o/ rowniez (test/staging fixtures z krotkimi).
const TOKEN_PATH_RE = /\/o\/[^/?#\s]+/g;
const TOKEN_PATH_REDACT = '/o/[REDACTED]';

// Email — Unicode-aware (polskie znaki w local part jak `kowalśki@firma.pl`)
const EMAIL_RE = /[\p{L}\p{N}._%+'-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/gu;
const EMAIL_REDACT = '[EMAIL]';

// Query-string tokens — wildcard pokrywa access_token, refresh_token, id_token,
// session_key, api_key, csrf_token etc. + nasze __pdfBypass/__pdfTs.
// Wymaga `?` lub `&` przed param name; param=value oddzielone `=`.
const QUERY_TOKEN_RE =
  /([?&](?:[\w-]*(?:token|key|secret|password|auth|session|code|sig)[\w-]*|__pdf\w+)=)[^&#\s]+/gi;
const QUERY_TOKEN_REDACT = '$1[REDACTED]';

// Klucze ktore zawsze redactujemy (frame.vars, breadcrumb.data, extra)
const SENSITIVE_KEY_RE = /email|token|pass|secret|key|auth|cookie|session/i;

// Depth limit dla rekurencyjnego scrub — zapobiega cyclic refs + perf blowup.
const MAX_DEPTH = 4;

function scrubString(s: string): string {
  return s
    .replace(TOKEN_PATH_RE, TOKEN_PATH_REDACT)
    .replace(QUERY_TOKEN_RE, QUERY_TOKEN_REDACT)
    .replace(EMAIL_RE, EMAIL_REDACT);
}

/**
 * Rekurencyjny scrub dla obiektow (frame.vars, breadcrumb.data, extra).
 * - Klucze pasujace SENSITIVE_KEY_RE → '[REDACTED]'
 * - Stringi → scrubString
 * - Obiekty/Arrays → rekurencja (depth-limited)
 * Mutuje in-place dla performance.
 */
function scrubObject(obj: Record<string, unknown> | unknown[], depth: number): void {
  if (depth > MAX_DEPTH) return;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const v = obj[i];
      if (typeof v === 'string') {
        obj[i] = scrubString(v);
      } else if (v && typeof v === 'object') {
        scrubObject(v as Record<string, unknown> | unknown[], depth + 1);
      }
    }
    return;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (SENSITIVE_KEY_RE.test(k)) {
      obj[k] = '[REDACTED]';
    } else if (typeof v === 'string') {
      obj[k] = scrubString(v);
    } else if (v && typeof v === 'object') {
      scrubObject(v as Record<string, unknown> | unknown[], depth + 1);
    }
  }
}

/**
 * ApiError codes ktore SA intended behavior (security guards, walidacja) i NIE
 * powinny wywolac alertu w Sentry. Zwracaja 401/403/422/410 dla nie-uprawnionych
 * userow — to nie sa bugi.
 *
 * Per bug 2026-06-09: admin Michal klikajacy /admin/users wysylal email
 * z Sentry „ApiError: Wymagana rola super_admin" mimo ze to oczekiwane.
 */
const INTENDED_API_ERROR_CODES = new Set([
  'FORBIDDEN',           // 403 — security guard zadziaal
  'UNAUTHORIZED',        // 401 — wymagana sesja
  'VALIDATION_ERROR',    // 422 — Zod refuse
  'OFFER_NOT_FOUND',     // 404 — zasob nie istnieje
  'OFFER_EXPIRED',       // 410 — link wygasl
  'OFFER_INVALID_STATUS',// 409 — operacja niedozwolona dla statusu
  'VARIANT_NOT_OFFERED', // 422 — wariant nie w offered_variants
  'GDPR_CLAUSE_MISMATCH',// 422 — wersja klauzuli RODO nie odpowiada
]);

function isIntendedApiError(event: ErrorEvent): boolean {
  const exc = event.exception?.values?.[0];
  if (!exc || exc.type !== 'ApiError') return false;
  // ApiError ma `code` w `mechanism.data` albo w extra/contexts; sprawdzamy
  // tez sam value (message zawiera czesto "Wymagana rola super_admin." itp.).
  const code = (exc.mechanism?.data as Record<string, unknown>)?.code as string | undefined;
  if (code && INTENDED_API_ERROR_CODES.has(code)) return true;
  // Fallback: extra/contexts mogly miec code
  const extraCode = (event.extra as Record<string, unknown> | undefined)?.code as string | undefined;
  if (extraCode && INTENDED_API_ERROR_CODES.has(extraCode)) return true;
  return false;
}

export function scrubEvent(event: ErrorEvent, _hint?: EventHint): ErrorEvent | null {
  // Drop "intended" ApiErrors (security guards / validation refuse) — to nie bugi.
  if (isIntendedApiError(event)) {
    return null as unknown as ErrorEvent; // Sentry beforeSend: null = drop
  }

  // Strip request URL + headers + cookies
  if (event.request) {
    if (event.request.url) event.request.url = scrubString(event.request.url);
    delete event.request.cookies;
    if (event.request.headers && typeof event.request.headers === 'object') {
      for (const key of Object.keys(event.request.headers)) {
        if (SENSITIVE_KEY_RE.test(key)) {
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

  // Strip exception values + stack frame vars (rekurencyjny)
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = scrubString(ex.value);
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          if (frame.vars && typeof frame.vars === 'object') {
            scrubObject(frame.vars as Record<string, unknown>, 0);
          }
        }
      }
    }
  }

  // Strip breadcrumbs (rekurencyjny przez data)
  if (event.breadcrumbs) {
    for (const bc of event.breadcrumbs) {
      if (bc.message) bc.message = scrubString(bc.message);
      if (bc.data && typeof bc.data === 'object') {
        scrubObject(bc.data as Record<string, unknown>, 0);
      }
    }
  }

  // Defensive zerowanie event.user (nawet gdy ktos zrobil setUser)
  if (event.user) {
    event.user = { id: event.user.id ? '[REDACTED]' : undefined };
  }

  // Trace context (rekurencyjnie)
  if (event.contexts?.trace?.data && typeof event.contexts.trace.data === 'object') {
    scrubObject(event.contexts.trace.data as Record<string, unknown>, 0);
  }

  // Extras (rekurencyjnie)
  if (event.extra && typeof event.extra === 'object') {
    scrubObject(event.extra as Record<string, unknown>, 0);
  }

  return event;
}
