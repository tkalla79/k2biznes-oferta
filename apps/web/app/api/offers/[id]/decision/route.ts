/**
 * POST /api/offers/[id]/decision — decyzja klienta przekazana poza systemem.
 *
 * Klienci potwierdzają wybór wariantu mailem albo telefonicznie częściej niż
 * przez formularz na ofercie. Do tej pory taka oferta zostawała na zawsze w
 * statusie `sent`/`viewed`: lejek i statystyki pokazywały brak decyzji, a
 * `accepted_fee` (podstawa raportowania przychodu) nie powstawał w ogóle.
 * Ręczna podmiana statusu przez `PATCH` też nie była rozwiązaniem — ustawiłaby
 * samo pole `status`, bez wariantu, kwoty, daty i bez śladu skąd decyzja.
 *
 * Czego ten endpoint NIE robi i nie zrobi: nie wypełnia pól RODO
 * (`gdpr_clause_version`, `gdpr_text_hash`, `gdpr_accepted_at`). Klient nie
 * zaakceptował klauzuli — zapisanie tam czegokolwiek byłoby sfabrykowanym
 * dowodem zgody. Zgoda zebrana przez telefon musi mieć własny ślad poza
 * systemem; tu zostaje pusto i to jest poprawny stan.
 *
 * Ślad decyzji: `offer_events` z `actor_type='admin'` i kanałem w payloadzie —
 * w historii oferty widać różnicę między „klient kliknął" a „wpisał to admin".
 */
import { NextResponse, type NextRequest } from 'next/server';
import { handleError, ApiError, Errors } from '@/lib/api/error';
import { requireAdmin } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { enqueueOfferWebhook } from '@/lib/webhooks/enqueue';
import { OfferDecisionInput } from '@/lib/validation/offers';
import { normalizeOfferKind, hasVariants } from '@/lib/offers/kind';
import { isLoanPricing } from '@/lib/pricing/loan';
import { isExecPricing } from '@/lib/pricing/exec';
import type { Json } from '@k2/database/types';
import type {
  ExecPricingResult,
  LoanPricingResult,
  PricingResult,
  PricingVariant,
} from '@/lib/pricing';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Decyzję można zapisać tylko dla oferty, którą klient mógł zobaczyć. */
const DECIDABLE = ['sent', 'viewed'] as const;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const session = await requireAdmin();
    const body = OfferDecisionInput.parse(await req.json());

    const sb = createAdminClient();
    const { data: offer, error: loadErr } = await sb
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (loadErr) throw new ApiError('INTERNAL_ERROR', loadErr.message, 500);
    if (!offer || offer.deleted_at) throw Errors.offerNotFound();

    if (!(DECIDABLE as readonly string[]).includes(offer.status)) {
      throw Errors.conflictStatus(
        offer.status === 'draft'
          ? 'Oferta nie została jeszcze wysłana — klient nie miał czego zaakceptować.'
          : `Oferta ma status "${offer.status}" — decyzja jest już zapisana.`,
      );
    }

    const now = new Date().toISOString();
    const kind = normalizeOfferKind(offer.offer_kind);

    // ---------------------------------------------------------------- odrzucenie
    if (body.decision === 'rejected') {
      const { data: updated, error } = await sb
        .from('offers')
        .update({
          status: 'rejected',
          rejected_by_name: body.confirmedBy,
          reject_reason: body.note ?? null,
          rejected_at: now,
        })
        .eq('id', offer.id)
        .eq('status', offer.status) // optimistic lock — klient mógł kliknąć równolegle
        .select()
        .maybeSingle();
      if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
      if (!updated) throw Errors.conflictStatus('Status oferty zmienił się podczas operacji.');

      await Promise.allSettled([
        sb.from('offer_events').insert({
          offer_id: offer.id,
          type: 'rejected',
          payload: { channel: body.channel, confirmedBy: body.confirmedBy, offline: true } as Json,
          actor_id: session.userId,
          actor_type: 'admin',
        }),
        logAudit({
          action: 'offer.reject',
          resourceType: 'offer',
          resourceId: offer.id,
          actorId: session.userId,
          actorEmail: session.email,
          before: { status: offer.status },
          after: { status: 'rejected', channel: body.channel, offline: true },
        }),
      ]);

      await enqueueOfferWebhook({ event: 'offer.rejected', offer: updated }).catch((e: Error) =>
        console.error('[decision] enqueue webhook failed:', e.message),
      );

      return NextResponse.json({ data: { success: true, status: 'rejected', at: now } });
    }

    // ---------------------------------------------------------------- akceptacja
    const snapshot = offer.pricing_snapshot as unknown as
      | PricingResult
      | LoanPricingResult
      | ExecPricingResult;

    let acceptedFee: number;
    let variant: 'I' | 'II' | 'III' | 'IV' | null = null;

    if (isLoanPricing(snapshot) || isExecPricing(snapshot)) {
      // Pożyczka i sam zakres 2 nie mają z czego wybierać — całość wynagrodzenia.
      acceptedFee = snapshot.total;
    } else if (hasVariants(kind)) {
      if (!body.variant) {
        throw new ApiError(
          'VALIDATION_ERROR',
          'Oferta dotacyjna wymaga wskazania wariantu, który klient wybrał.',
          422,
        );
      }
      if (!offer.offered_variants.includes(body.variant)) {
        throw Errors.variantNotOffered();
      }
      const v = snapshot.variants?.find((x: PricingVariant) => x.id === body.variant);
      if (!v) {
        throw new ApiError(
          'INTERNAL_ERROR',
          `Wariant ${body.variant} nie istnieje w pricing_snapshot.`,
          500,
        );
      }
      acceptedFee = v.sfAmount;
      variant = body.variant;
    } else {
      // offer_kind mówi loan/exec, a snapshot ma kształt dotacyjny — niespójność
      // z czasów przełączania typu oferty. Lepiej 409 niż kwota z sufitu.
      throw Errors.conflictStatus(
        'Cennik oferty nie pasuje do jej typu. Przelicz pricing przed zapisaniem decyzji.',
      );
    }

    const { data: updated, error } = await sb
      .from('offers')
      .update({
        status: 'accepted',
        accepted_variant: variant,
        accepted_fee: acceptedFee,
        accepted_by_name: body.confirmedBy,
        client_comment: body.note ?? null,
        accepted_at: now,
        // gdpr_* celowo nietknięte — patrz docstring.
      })
      .eq('id', offer.id)
      .eq('status', offer.status)
      .select()
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!updated) throw Errors.conflictStatus('Status oferty zmienił się podczas operacji.');

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: offer.id,
        type: 'accepted',
        payload: {
          channel: body.channel,
          confirmedBy: body.confirmedBy,
          offline: true,
          variant,
          acceptedFee,
        } as Json,
        actor_id: session.userId,
        actor_type: 'admin',
      }),
      logAudit({
        action: 'offer.accept',
        resourceType: 'offer',
        resourceId: offer.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { status: offer.status },
        after: { status: 'accepted', variant, acceptedFee, channel: body.channel, offline: true },
      }),
    ]);

    // Webhook do CRM leci tak samo jak przy akceptacji przez formularz — CRM ma
    // znać fakt, nie kanał. Maila do konsultanta świadomie NIE wysyłamy: ktoś
    // z zespołu właśnie tę decyzję wpisał, więc powiadomienie „klient
    // zaakceptował ofertę" trafiałoby do osoby, która już o tym wie.
    await enqueueOfferWebhook({ event: 'offer.accepted', offer: updated }).catch((e: Error) =>
      console.error('[decision] enqueue webhook failed:', e.message),
    );

    return NextResponse.json({
      data: { success: true, status: 'accepted', variant, acceptedFee, at: now },
    });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * DELETE /api/offers/[id]/decision — cofnięcie decyzji wpisanej z panelu.
 *
 * `accepted`/`rejected` to stany terminalne: blokują wysyłkę i zamykają
 * klientowi możliwość akceptacji pod tym samym linkiem. Skoro POST pozwala
 * wejść w nie jednym kliknięciem, musi istnieć wyjście — inaczej pomyłka w
 * wyborze „Odrzucona" trwale odcina klientowi możliwość przyjęcia oferty.
 *
 * Cofamy WYŁĄCZNIE decyzję wpisaną przez nas (zdarzenie z `actor_type='admin'`
 * i `offline: true`). Decyzji podjętej przez klienta w formularzu panel nie
 * kasuje: to jego oświadczenie woli, nie nasz wpis.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!UUID_RE.test(params.id)) {
      throw new ApiError('VALIDATION_ERROR', 'Niepoprawny format id (UUID).', 422);
    }
    const session = await requireAdmin();

    const sb = createAdminClient();
    const { data: offer, error: loadErr } = await sb
      .from('offers')
      .select('*')
      .eq('id', params.id)
      .maybeSingle();
    if (loadErr) throw new ApiError('INTERNAL_ERROR', loadErr.message, 500);
    if (!offer || offer.deleted_at) throw Errors.offerNotFound();

    if (offer.status !== 'accepted' && offer.status !== 'rejected') {
      throw Errors.conflictStatus(`Oferta ma status "${offer.status}" — nie ma czego cofać.`);
    }

    const { data: last } = await sb
      .from('offer_events')
      .select('actor_type, payload')
      .eq('offer_id', offer.id)
      .in('type', ['accepted', 'rejected'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const wasOffline =
      last?.actor_type === 'admin' &&
      (last.payload as { offline?: boolean } | null)?.offline === true;
    if (!wasOffline) {
      throw Errors.conflictStatus(
        'Tę decyzję podjął klient w formularzu oferty — nie cofamy jej z panelu.',
      );
    }

    // Wracamy tam, gdzie oferta była przed decyzją: `viewed`, jeśli klient ją
    // otworzył, inaczej `sent`. Osobnej kolumny na poprzedni status nie ma, a
    // te dwa stany różni dokładnie `view_count`.
    const back = offer.view_count > 0 ? 'viewed' : 'sent';

    const { data: updated, error } = await sb
      .from('offers')
      .update({
        status: back,
        accepted_variant: null,
        accepted_fee: null,
        accepted_by_name: null,
        accepted_by_email: null,
        accepted_at: null,
        client_comment: null,
        rejected_by_name: null,
        rejected_by_email: null,
        reject_reason: null,
        rejected_at: null,
      })
      .eq('id', offer.id)
      .eq('status', offer.status)
      .select()
      .maybeSingle();
    if (error) throw new ApiError('INTERNAL_ERROR', error.message, 500);
    if (!updated) throw Errors.conflictStatus('Status oferty zmienił się podczas operacji.');

    await Promise.allSettled([
      sb.from('offer_events').insert({
        offer_id: offer.id,
        type: 'updated',
        payload: { decisionReverted: offer.status, back } as Json,
        actor_id: session.userId,
        actor_type: 'admin',
      }),
      logAudit({
        action: 'offer.update',
        resourceType: 'offer',
        resourceId: offer.id,
        actorId: session.userId,
        actorEmail: session.email,
        before: { status: offer.status },
        after: { status: back, decisionReverted: true },
      }),
    ]);

    return NextResponse.json({ data: { success: true, status: back } });
  } catch (e) {
    return handleError(e);
  }
}
