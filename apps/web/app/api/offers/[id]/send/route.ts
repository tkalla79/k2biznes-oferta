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
import { enqueueOfferWebhook } from '@/lib/webhooks/enqueue';
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
    if (!offer || offer.deleted_at) throw Errors.offerNotFound();

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

    // H5 audit: anti-double-click idempotency. Admin double-klika „Wyślij" przy
    // slow network → 2 requesty → 2 emaile do klienta + 2 offer_events. Re-send
    // jest intencjonalny (po jakimś czasie OK), ale 2 wysyłki w 60s to przypadek.
    if (offer.status === 'sent' && offer.sent_at) {
      const sinceLastSend = Date.now() - new Date(offer.sent_at).getTime();
      if (sinceLastSend < 60_000) {
        throw Errors.conflictStatus(
          'Oferta została właśnie wysłana. Odczekaj chwilę przed ponowną wysyłką.',
        );
      }
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
    // robimy `offer_events.email_sent` insert. Email-reliability 2026-07: wynik
    // wraca w response — konsultant widzi OD RAZU "email nie dotarł" zamiast
    // cichego sukcesu i markera na liście dopiero po fakcie.
    let emailResult: { ok: boolean; error?: string };
    try {
      emailResult = await notifyClientOfferSent({
        offer: updated,
        recipientEmail: body.recipientEmail,
        customMessage: body.message,
      });
    } catch (e) {
      console.error('[offers.send] email failed:', (e as Error).message);
      // Nie throw — status = sent już zapisany. Konsultant może retry przez UI.
      emailResult = { ok: false, error: (e as Error).message };
    }

    // Event 'sent' + audit + CRM webhook — H1 audit: webhook MUSI być awaited
    // przed return (Vercel zabija async po response). Wcześniej fire-and-forget
    // `.catch()` po enqueue dawał szansę tylko bo allSettled poniżej trochę czekał
    // — niedeterministyczne. Teraz webhook jest w samym allSettled.
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
      enqueueOfferWebhook({ event: 'offer.sent', offer: updated }).catch((e: Error) =>
        console.error('[send] enqueue webhook failed:', e.message),
      ),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({
      data: {
        ...toOfferDto(updated, appUrl),
        emailDelivered: emailResult.ok,
        ...(emailResult.ok ? {} : { emailError: emailResult.error }),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
