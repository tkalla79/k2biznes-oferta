/**
 * POST /api/auth/request-data-deletion (BACKEND_SPEC.md v1.1.1, sekcja 11.4).
 *
 * Public — bez logowania, każdy może zażądać usunięcia po podaniu emaila.
 * Wysyłka emaila potwierdzającego (best-effort). Super admin zatwierdza
 * w `/admin/gdpr` (PR #9 admin UI).
 *
 * Rate-limit przez middleware (`/api/public/*` 100/min/IP) — TODO: dorzuć
 * `/api/auth/request-data-deletion` do bardziej restrykcyjnego bucket'u
 * (np. 5/dzień/IP) w follow-up.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError } from '@/lib/api/error';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { RequestDeletionInput } from '@/lib/validation/rodo';
import { notifyDeletionRequested } from '@/lib/email/notifications-rodo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = RequestDeletionInput.parse(await req.json());

    const sb = createAdminClient();
    const { data: inserted, error } = await sb
      .from('data_deletion_requests')
      .insert({
        email: body.email,
        reason: body.reason ?? null,
        status: 'requested',
      })
      .select()
      .single();

    if (error || !inserted) {
      throw new ApiError('INTERNAL_ERROR', `request insert failed: ${error?.message}`, 500);
    }

    // Email confirmation (best-effort).
    notifyDeletionRequested({
      email: body.email,
      requestId: inserted.id,
      reason: body.reason ?? null,
    }).catch((e) =>
      console.error('[gdpr] notify request failed:', (e as Error).message),
    );

    await logAudit({
      action: 'gdpr.request.approved', // initial state — przemianujemy gdy super_admin podejmie decyzję
      resourceType: 'data_deletion_request',
      resourceId: inserted.id,
      actorId: null,
      actorEmail: body.email,
      after: { status: 'requested', email: body.email },
    });

    // Świadomie nie zwracamy `id` — uniemożliwia atakującemu wniesienie żądania
    // i potem przeglądanie statusu (wymaga maila z linkiem-tokenem do follow-up).
    // PR follow-up: dodać token w mailu do statusu.
    return NextResponse.json(
      { data: { ok: true, message: 'Żądanie zarejestrowane. Sprawdź skrzynkę email.' } },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}
