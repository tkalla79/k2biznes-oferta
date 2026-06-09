/**
 * API error helpers (BACKEND_SPEC.md v1.1.1, sekcja 5.1 + 14).
 *
 * Single shape dla wszystkich błędów:
 *   { error: { code, message, details? } }
 *
 * `ApiError` to throwable — handlery łapią `instanceof ApiError` i mapują
 * na `errorResponse()`.
 */
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorResponse(e: ApiError): NextResponse<ApiErrorBody> {
  return NextResponse.json<ApiErrorBody>(
    { error: { code: e.code, message: e.message, details: e.details } },
    { status: e.status },
  );
}

/**
 * Mapowanie ZodError → response (sekcja 5.1 — `details.issues`).
 */
export function toApiError(e: ZodError): ApiError {
  return new ApiError('VALIDATION_ERROR', 'Nieprawidłowe dane wejściowe.', 422, {
    issues: e.issues.map((i) => ({
      path: i.path,
      code: i.code,
      message: i.message,
    })),
  });
}

/**
 * Konwencja: wszystkie route handlery owijają logikę w try/catch i wołają
 * `handleError(e)` w catch. Nieznane błędy → 500 INTERNAL_ERROR (bez wycieku
 * stack trace do klienta — Sentry łapie po stronie serwera).
 */
export function handleError(e: unknown): NextResponse<ApiErrorBody> {
  if (e instanceof ApiError) return errorResponse(e);
  if (e instanceof ZodError) return errorResponse(toApiError(e));
  // unknown — log + 500
  console.error('[api] unhandled error:', e);
  return errorResponse(
    new ApiError('INTERNAL_ERROR', 'Wewnętrzny błąd serwera.', 500),
  );
}

// Convenience constructors — najczęściej używane z sekcji 14
export const Errors = {
  unauthorized: (msg = 'Brak sesji.') => new ApiError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Brak uprawnień.') => new ApiError('FORBIDDEN', msg, 403),
  // H11 audit: generic 404 dla dowolnego zasobu (users, FAQ, programs, etc.).
  // Wcześniej zwracał OFFER_NOT_FOUND dla wszystkiego → frontend sprawdzający
  // ten kod (np. redirect do listy ofert) trafiał na false-positive z /api/admin/users.
  notFound: (msg = 'Zasób nie istnieje.') => new ApiError('NOT_FOUND', msg, 404),
  // Dedykowany dla ofert — public offer view + offer routes.
  offerNotFound: (msg = 'Oferta nie istnieje lub została usunięta.') =>
    new ApiError('OFFER_NOT_FOUND', msg, 404),
  conflictStatus: (msg = 'Niedopuszczalny status oferty.') =>
    new ApiError('OFFER_INVALID_STATUS', msg, 409),
  expired: (msg = 'Link wygasł.') => new ApiError('OFFER_EXPIRED', msg, 410),
  variantNotOffered: () =>
    new ApiError(
      'VARIANT_NOT_OFFERED',
      'Wybrany wariant nie jest dostępny w tej ofercie.',
      422,
    ),
  rateLimited: () => new ApiError('RATE_LIMITED', 'Zbyt wiele żądań.', 429),
};
