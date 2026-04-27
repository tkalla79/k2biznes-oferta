/**
 * POST /api/offers/[id]/send (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Konsultant wysyła ofertę do klienta:
 * 1. Walidacja: status w (draft, sent) — można re-send już wysłanej
 * 2. Update offer: status='sent', sent_at=now, expires_at (jeśli podane)
 * 3. Wysyłka emaila przez Resend (lub log w dev gdy brak API key)
 * 4. Event 'sent' + 'email_sent' w offer_events
 * 5. Audit log
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { SendOfferInput } from '@/lib/validation/send';
import { notifyClientOfferSent } from '@/lib/email/notifications';
import { toOfferDto } from '@/lib/offers/mapper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const session = await requireSession();
    const body = SendOfferInput.parse(await req.json());

    const sb = createAdminClient();
    const { data: offer, error: e0 } = await sb
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();

    if (e0) throw new ApiError('INTERNAL_ERROR', e0.message, 500);
    if (!offer || offer.deleted_at) throw Errors.notFound();

    // Ownership (admin może wszystko)
    const isOwner =
      offer.created_by === session.userId || offer.assigned_consultant_id === session.userId;
    const isAdmin = session.role === 'admin' || session.role === 'super_admin';
    if (!isOwner && !isAdmin) {
      throw Errors.forbidden('Brak dostępu do tej oferty.');
    }

    // Status: można wysłać draft lub re-send sent
    if (offer.status !== 'draft' && offer.status !== 'sent') {
      throw Errors.conflictStatus(`Wysyłka niedozwolona dla statusu ${offer.status}.`);
    }

    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await sb
      .from('offers')
      .update({
        status: 'sent',
        sent_at: now,
        ...(body.expiresAt !== undefined ? { expires_at: body.expiresAt } : {}),
      })
      .eq('id', offer.id)
      .select()
      .single();

    if (upErr || !updated) {
      throw new ApiError('INTERNAL_ERROR', `send update failed: ${upErr?.message}`, 500);
    }

    // Wyślij email (best-effort: log + nie cofa update). Wewnątrz `notifyClientOfferSent`
    // robimy `offer_events.email_sent` insert.
    try {
      await notifyClientOfferSent({
        offer: updated,
        recipientEmail: body.recipientEmail,
        customMessage: body.message,
      });
    } catch (e) {
      console.error('[offers.send] email failed:', (e as Error).message);
      // Nie throw — status = sent już zapisany. Konsultant może retry przez UI.
    }

    // Event 'sent' + audit
    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: updated.id,
        type: 'sent',
        actor_id: session.userId,
        actor_type: session.role === 'consultant' ? 'consultant' : 'admin',
        payload: { recipientEmail: body.recipientEmail },
      }),
      logAudit({
        action: 'offer.send',
        resourceType: 'offer',
        resourceId: updated.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { status: offer.status },
        after: { status: 'sent', recipientEmail: body.recipientEmail },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ data: toOfferDto(updated, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}
