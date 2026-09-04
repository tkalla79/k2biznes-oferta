/**
 * Wysokopoziomowe wrappery dla email notifications na zdarzenia w domenie offers.
 *
 * Wszystkie best-effort: błąd wysyłki nie blokuje głównej operacji (accept,
 * reject, send). Zdarzenie zapisujemy też w `offer_events` (`type='email_sent'`)
 * dla audytu — w PR #5 minimalne, pełne tracking i retry queue w PR #7.
 */
import { createElement } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderEmail } from '@/lib/email/render';
import { sendEmail, type SendResult } from '@/lib/email/send';
import OfferSentToClient, {
  type OfferSentToClientProps,
} from '@/lib/email/templates/OfferSentToClient';
import OfferAcceptedConsultant from '@/lib/email/templates/OfferAcceptedConsultant';
import OfferRejectedConsultant from '@/lib/email/templates/OfferRejectedConsultant';
import type { OfferRow } from '@/lib/offers/mapper';
import { buildOfferSummary } from './summary';
import { resolveOfferCc } from './cc';
import type { Json } from '@k2/database/types';

const fmtPLN = (n: number) =>
  n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('pl-PL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

function offerUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/o/${token}`;
}

function adminOfferUrl(id: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/admin/offers/${id}`;
}

/**
 * Best-effort log do `offer_events` — używane do tracking wysyłek emailowych.
 * Ignorujemy błąd zapisu (audit nie powinien blokować notify).
 *
 * Code review PR #3: rozróżnia sukces/porażkę przez payload.outcome — failure
 * nie jest cicho zapisany jako "sent" event tylko z `result.ok=false` w payload.
 * Konsumenci eventów (admin dashboard PR #8) mogą filtrować po `outcome=failed`
 * żeby pokazać konsultantowi info "email się nie wysłał, spróbuj /send ponownie".
 */
async function logEmailEvent(offerId: string, payload: Record<string, unknown> & { outcome: 'sent' | 'failed' }) {
  const sb = createAdminClient();
  const { error } = await sb.from('offer_events').insert({
    offer_id: offerId,
    type: 'email_sent',
    payload: payload as Json,
    actor_id: null,
    actor_type: 'system',
  });
  if (error) console.error('[notifications] event insert failed:', error.message);
}

// =============================================================================
// 1. Konsultant → klient z linkiem do oferty (POST /api/offers/[id]/send)
// =============================================================================

export async function notifyClientOfferSent(args: {
  offer: OfferRow;
  recipientEmail: string;
  customMessage?: string;
  // Email-reliability 2026-07: zwracamy wynik wysyłki — send route przekazuje
  // go do UI, żeby konsultant OD RAZU widział "email nie dotarł" (wcześniej
  // fail był połykany i widoczny dopiero markerem na liście).
  //
  // `cc` w zwrotce mówi, kto FAKTYCZNIE dostał kopię — UI pokazuje to
  // konsultantowi, żeby "kopia poszła" nie było założeniem.
}): Promise<SendResult & { cc: string[] }> {
  const { offer, recipientEmail, customMessage } = args;
  const sb = createAdminClient();

  // Podsumowanie finansowe (dotacja vs pożyczka) — patrz buildOfferSummary.
  const summary = buildOfferSummary(offer);
  if (!summary) {
    console.error('[notifications] invalid pricing_snapshot for offer', offer.id);
    await logEmailEvent(offer.id, {
      outcome: 'failed',
      template: 'OfferSentToClient',
      to: recipientEmail,
      reason: 'invalid_pricing_snapshot',
    });
    return { ok: false, error: 'invalid pricing_snapshot — email nie został wysłany', cc: [] };
  }

  // Konsultant — z `assigned_consultant_id` lub `created_by`.
  const consultantId = offer.assigned_consultant_id ?? offer.created_by;
  const [{ data: consultant }, { data: contactPerson }] = await Promise.all([
    sb.from('profiles').select('full_name, email, phone').eq('id', consultantId).maybeSingle(),
    // Osoba wskazana w ofercie do kontaktu — dostaje kopię maila (CC).
    offer.contact_person_id
      ? sb
          .from('contact_persons')
          .select('name, email')
          .eq('id', offer.contact_person_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!consultant) {
    // Code review PR #3: spójne z notifyConsultant* — warn gdy brak profilu.
    console.warn('[notifications] no consultant profile for offer', offer.id, 'consultantId:', consultantId);
  }

  const cc = resolveOfferCc({ contactEmail: contactPerson?.email, recipientEmail });
  if (offer.contact_person_id && cc.length === 0) {
    // Osoba kontaktowa jest w ofercie, ale kopia nie poleciała (brak maila w
    // katalogu, śmieć w kolumnie albo ten sam adres co odbiorca). Cisza w tym
    // miejscu wygląda dokładnie jak wysłana kopia — dlatego log.
    console.warn(
      '[notifications] contact person without usable email — no CC for offer',
      offer.id,
      'contactPersonId:',
      offer.contact_person_id,
    );
  }

  // H6 audit: dynamiczny tekst wygaśnięcia zamiast hardkodowanego "30 dni".
  const expiresLabel = offer.expires_at
    ? new Date(offer.expires_at).toLocaleDateString('pl-PL', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  const props: OfferSentToClientProps = {
    clientName: offer.client_name,
    programLabel: offer.program_label,
    isLoan: summary.isLoan,
    fundingAmount: summary.fundingAmount,
    variantName: summary.variantName,
    variantTotal: summary.variantTotal,
    consultantName: consultant?.full_name ?? 'Zespół K2Biznes',
    consultantEmail: consultant?.email ?? 'kontakt@k2biznes.pl',
    consultantPhone: consultant?.phone ?? null,
    offerUrl: offerUrl(offer.client_token),
    customMessage,
    expiresLabel,
  };

  const { html, text } = await renderEmail(createElement(OfferSentToClient, props));
  const result = await sendEmail({
    to: recipientEmail,
    // Kopia do osoby wskazanej w ofercie do kontaktu (reguła biznesowa 2026-09).
    // Jawne CC, nie BCC: tę osobę klient i tak widzi w ofercie, a wspólny wątek
    // jest tu celem — patrz `lib/email/cc.ts`.
    cc,
    // Q3 audit: Reply-To = konsultant prowadzący, nie generic kontakt@.
    // Klient odpowiadając na ofertę trafia bezpośrednio do osoby prowadzącej.
    replyTo: consultant?.email ?? undefined,
    subject: `Oferta K2Biznes dla ${offer.client_name} — ${offer.program_label}`,
    html,
    text,
    tags: [
      { name: 'event', value: 'offer_sent' },
      { name: 'offer_number', value: offer.offer_number.replace(/[^A-Za-z0-9_-]/g, '_') },
    ],
  });

  await logEmailEvent(offer.id, {
    outcome: result.ok ? 'sent' : 'failed',
    template: 'OfferSentToClient',
    to: recipientEmail,
    cc,
    result,
  });
  return { ...result, cc };
}

// =============================================================================
// 2. System → konsultant po akceptacji
// =============================================================================

export async function notifyConsultantOfferAccepted(offer: OfferRow): Promise<void> {
  const sb = createAdminClient();

  const consultantId = offer.assigned_consultant_id ?? offer.created_by;
  const { data: consultant } = await sb
    .from('profiles')
    .select('email')
    .eq('id', consultantId)
    .maybeSingle();

  if (!consultant?.email) {
    console.warn('[notifications] no consultant email for offer', offer.id);
    return;
  }

  const props = {
    offerNumber: offer.offer_number,
    clientCompanyName: offer.client_name,
    programLabel: offer.program_label,
    isLoan: offer.offer_kind === 'loan',
    acceptedVariant: offer.accepted_variant ?? offer.selected_variant,
    acceptedFee: fmtPLN(Number(offer.accepted_fee ?? 0)),
    clientName: offer.accepted_by_name ?? '—',
    // PR #3 review: nullable email — template guarduje renderowanie linii email.
    clientEmail: offer.accepted_by_email,
    comment: offer.client_comment,
    acceptedAt: offer.accepted_at ? fmtDate(offer.accepted_at) : '—',
    adminUrl: adminOfferUrl(offer.id),
  };

  const { html, text } = await renderEmail(createElement(OfferAcceptedConsultant, props));
  const result = await sendEmail({
    to: consultant.email,
    subject: props.isLoan
      ? `Oferta ${offer.offer_number} zaakceptowana — ${offer.client_name} (pożyczka)`
      : `Oferta ${offer.offer_number} zaakceptowana — ${offer.client_name}, wariant ${props.acceptedVariant}`,
    html,
    text,
    tags: [
      { name: 'event', value: 'offer_accepted' },
      { name: 'offer_number', value: offer.offer_number.replace(/[^A-Za-z0-9_-]/g, '_') },
    ],
  });

  await logEmailEvent(offer.id, {
    outcome: result.ok ? 'sent' : 'failed',
    template: 'OfferAcceptedConsultant',
    to: consultant.email,
    result,
  });
}

// =============================================================================
// 3. System → konsultant po odrzuceniu
// =============================================================================

export async function notifyConsultantOfferRejected(offer: OfferRow): Promise<void> {
  const sb = createAdminClient();

  const consultantId = offer.assigned_consultant_id ?? offer.created_by;
  const { data: consultant } = await sb
    .from('profiles')
    .select('email')
    .eq('id', consultantId)
    .maybeSingle();

  if (!consultant?.email) {
    console.warn('[notifications] no consultant email for offer', offer.id);
    return;
  }

  const props = {
    offerNumber: offer.offer_number,
    clientCompanyName: offer.client_name,
    programLabel: offer.program_label,
    // Code review PR #2: dedykowane kolumny rejected_by_* (były accepted_by_* — false positive).
    clientName: offer.rejected_by_name ?? '—',
    clientEmail: offer.rejected_by_email,
    reason: offer.reject_reason,
    rejectedAt: offer.rejected_at ? fmtDate(offer.rejected_at) : '—',
    adminUrl: adminOfferUrl(offer.id),
  };

  const { html, text } = await renderEmail(createElement(OfferRejectedConsultant, props));
  const result = await sendEmail({
    to: consultant.email,
    subject: `Oferta ${offer.offer_number} odrzucona — ${offer.client_name}`,
    html,
    text,
    tags: [
      { name: 'event', value: 'offer_rejected' },
      { name: 'offer_number', value: offer.offer_number.replace(/[^A-Za-z0-9_-]/g, '_') },
    ],
  });

  await logEmailEvent(offer.id, {
    outcome: result.ok ? 'sent' : 'failed',
    template: 'OfferRejectedConsultant',
    to: consultant.email,
    result,
  });
}
