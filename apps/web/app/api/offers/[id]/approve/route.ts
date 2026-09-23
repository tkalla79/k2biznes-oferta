/**
 * POST /api/offers/[id]/approve — wewnętrzna akceptacja oferty przed wysyłką.
 * DELETE — cofnięcie akceptacji.
 *
 * Do tej pory ofertę mógł wysłać jej autor, bez żadnej pary oczu i bez śladu,
 * kto zaakceptował treść. Teraz `POST /send` wymaga akceptacji, a tu zapisujemy
 * KTO i KIEDY ją dał (reguła biznesowa, T. Kalla 2026-09).
 *
 * Zatwierdza admin+ — również własną ofertę. Świadomie nie blokujemy
 * samo-akceptacji: przy obecnym zespole jeden admin bywa jedyną osobą, która
 * ofertę widzi, a blokada oznaczałaby, że nikt nie może wysłać niczego.
 * Wartością jest tu ślad i moment zatrzymania, nie rozdzielenie ról.
 *
 * Akceptacja NIE jest trwała: każda edycja tego, co widzi klient, kasuje ją
 * w `PATCH /api/offers/:id` (patrz `clearsApproval`).
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { toOfferDto } from '@/lib/offers/mapper';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TERMINAL = ['accepted', 'rejected', 'expired'] as const;

async function loadOffer(id: string) {
  const sb = createAdminClient();
  const { data, error } = await sb.from('offers').select('*').eq('id', id).maybeSingle();
  if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
  if (!data || data.deleted_at) throw Errors.offerNotFound();
  return { sb, offer: data };
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const session = await requireAdmin();
    const { sb, offer } = await loadOffer(params.id);

    if ((TERMINAL as readonly string[]).includes(offer.status)) {
      throw Errors.conflictStatus(
        `Oferta ma status "${offer.status}" — zatwierdzanie nie ma już czego zmienić.`,
      );
    }

    // Idempotentnie: powtórne kliknięcie nie podmienia osoby zatwierdzającej
    // ani daty. Pierwszy podpis jest tym, który liczy się w audycie.
    if (offer.approved_at) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      return NextResponse.json({ data: toOfferDto(offer, appUrl) });
    }

    const now = new Date().toISOString();
    const { data: updated, error: upErr } = await sb
      .from('offers')
      .update({ approved_by: session.userId, approved_at: now })
      .eq('id', offer.id)
      .select()
      .single();
    if (upErr || !updated) {
      throw new ApiError('INTERNAL_ERROR', `approve failed: ${upErr?.message}`, 500);
    }

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: updated.id,
        type: 'approved',
        actor_id: session.userId,
        actor_type: 'admin',
        payload: { approvedByEmail: session.email },
      }),
      logAudit({
        action: 'offer.approve',
        resourceType: 'offer',
        resourceId: updated.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { approvedAt: null },
        after: { approvedAt: now, approvedBy: session.userId },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ data: toOfferDto(updated, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const session = await requireAdmin();
    const { sb, offer } = await loadOffer(params.id);

    // Idempotentnie: cofanie czegoś, czego nie ma, nie jest błędem.
    if (!offer.approved_at) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      return NextResponse.json({ data: toOfferDto(offer, appUrl) });
    }

    const { data: updated, error: upErr } = await sb
      .from('offers')
      .update({ approved_by: null, approved_at: null })
      .eq('id', offer.id)
      .select()
      .single();
    if (upErr || !updated) {
      throw new ApiError('INTERNAL_ERROR', `unapprove failed: ${upErr?.message}`, 500);
    }

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: updated.id,
        type: 'approval_revoked',
        actor_id: session.userId,
        actor_type: 'admin',
        payload: { reason: 'manual', revokedByEmail: session.email },
      }),
      logAudit({
        action: 'offer.approval_revoked',
        resourceType: 'offer',
        resourceId: updated.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { approvedAt: offer.approved_at, approvedBy: offer.approved_by },
        after: { approvedAt: null },
      }),
    ]);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    return NextResponse.json({ data: toOfferDto(updated, appUrl) });
  } catch (e) {
    return handleError(e);
  }
}
