/**
 * PATCH /api/admin/data-deletion-requests/[id] (BACKEND_SPEC.md v1.1.1, sekcja 11.4 + 11.9).
 *
 * Decisions:
 * - approve  → status=approved + reviewed_by/reviewed_at
 * - reject   → status=rejected + reject_reason
 * - execute  → status=executed (po approve), wykonuje anonimizację + email
 *
 * Audit log per każdą decyzję (sekcja 11.9).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireSuperAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { ReviewDeletionInput } from '@/lib/validation/rodo';
import { executeFullAnonymization } from '@/lib/rodo/anonymize';
import { notifyDeletionExecuted } from '@/lib/email/notifications-rodo';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id.', 422);
    }
    const session = await requireSuperAdmin();
    const body = ReviewDeletionInput.parse(await req.json());

    const sb = createAdminClient();
    const { data: before, error: e0 } = await sb
      .from('data_deletion_requests')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (e0) throw new ApiError('INTERNAL_ERROR', e0.message, 500);
    if (!before) throw Errors.notFound('Żądanie nie istnieje.');

    const now = new Date().toISOString();

    if (body.decision === 'approve') {
      if (before.status !== 'requested') {
        throw Errors.conflictStatus(`Approve niedozwolony dla statusu ${before.status}.`);
      }
      const { data, error } = await sb
        .from('data_deletion_requests')
        .update({
          status: 'approved',
          reviewed_by: session.userId,
          reviewed_at: now,
          notes: body.notes ?? null,
        })
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);

      await logAudit({
        action: 'gdpr.request.approved',
        resourceType: 'data_deletion_request',
        resourceId: params.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { status: before.status },
        after: { status: 'approved' },
      });

      return NextResponse.json({ data });
    }

    if (body.decision === 'reject') {
      if (before.status !== 'requested') {
        throw Errors.conflictStatus(`Reject niedozwolony dla statusu ${before.status}.`);
      }
      const { data, error } = await sb
        .from('data_deletion_requests')
        .update({
          status: 'rejected',
          reviewed_by: session.userId,
          reviewed_at: now,
          reject_reason: body.rejectReason ?? null,
          notes: body.notes ?? null,
        })
        .eq('id', params.id)
        .select()
        .single();
      if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);

      await logAudit({
        action: 'gdpr.request.rejected',
        resourceType: 'data_deletion_request',
        resourceId: params.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { status: before.status },
        after: { status: 'rejected', reason: body.rejectReason },
      });

      return NextResponse.json({ data });
    }

    // execute
    if (before.status !== 'approved') {
      throw Errors.conflictStatus(
        `Execute wymaga statusu 'approved' (obecny: ${before.status}).`,
      );
    }

    const result = await executeFullAnonymization(before.email, session.userId);

    const { data: updated, error: upErr } = await sb
      .from('data_deletion_requests')
      .update({
        status: 'executed',
        executed_at: now,
        executed_by: session.userId,
        notes: body.notes ?? before.notes,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (upErr) throw new ApiError('INTERNAL_ERROR', upErr.message, 500);

    // Email post-execute (best-effort)
    notifyDeletionExecuted({
      email: before.email,
      requestId: params.id,
      offersAnonymized: result.offers_anonymized,
      eventsAnonymized: result.events_anonymized,
      profileAnonymized: result.profile_anonymized,
      executedAt: now,
    }).catch((e) =>
      console.error('[gdpr] notify executed failed:', (e as Error).message),
    );

    await logAudit({
      action: 'gdpr.request.executed',
      resourceType: 'data_deletion_request',
      resourceId: params.id,
      actorId: session.userId,
      actorEmail: session.email,
      before: { status: before.status },
      after: {
        status: 'executed',
        offers_anonymized: result.offers_anonymized,
        events_anonymized: result.events_anonymized,
        profile_anonymized: result.profile_anonymized,
      },
    });

    return NextResponse.json({ data: { request: updated, anonymization: result } });
  } catch (e) {
    return handleError(e);
  }
}
