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
import { sendEmail } from '@/lib/email/send';
import OfferSentToClient, {
  type OfferSentToClientProps,
} from '@/lib/email/templates/OfferSentToClient';
import OfferAcceptedConsultant from '@/lib/email/templates/OfferAcceptedConsultant';
import OfferRejectedConsultant from '@/lib/email/templates/OfferRejectedConsultant';
import type { OfferRow } from '@/lib/offers/mapper';
import type { PricingResult } from '@/lib/pricing';
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
 */
async function logEmailEvent(offerId: string, payload: Record<string, unknown>) {
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
}): Promise<void> {
  const { offer, recipientEmail, customMessage } = args;
  const sb = createAdminClient();

  // Konsultant — z `assigned_consultant_id` lub `created_by`.
  const consultantId = offer.assigned_consultant_id ?? offer.created_by;
  const { data: consultant } = await sb
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', consultantId)
    .maybeSingle();

  const snapshot = offer.pricing_snapshot as unknown as PricingResult;
  const variant = snapshot.variants.find((v) => v.id === offer.selected_variant);

  const props: OfferSentToClientProps = {
    clientName: offer.client_name,
    programLabel: offer.program_label,
    fundingAmount: fmtPLN(snapshot.funding),
    variantName: variant ? `${variant.name} — ${variant.tag}` : `Wariant ${offer.selected_variant}`,
    variantTotal: variant ? fmtPLN(variant.total) : '—',
    consultantName: consultant?.full_name ?? 'Zespół K2Biznes',
    consultantEmail: consultant?.email ?? 'kontakt@k2biznes.pl',
    consultantPhone: consultant?.phone ?? null,
    offerUrl: offerUrl(offer.client_token),
    customMessage,
  };

  const { html, text } = await renderEmail(createElement(OfferSentToClient, props));
  const result = await sendEmail({
    to: recipientEmail,
    subject: `Oferta K2Biznes dla ${offer.client_name} — ${offer.program_label}`,
    html,
    text,
    tags: [
      { name: 'event', value: 'offer_sent' },
      { name: 'offer_number', value: offer.offer_number.replace(/[^A-Za-z0-9_-]/g, '_') },
    ],
  });

  await logEmailEvent(offer.id, {
    template: 'OfferSentToClient',
    to: recipientEmail,
    result,
  });
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
    acceptedVariant: offer.accepted_variant ?? offer.selected_variant,
    acceptedFee: fmtPLN(Number(offer.accepted_fee ?? 0)),
    clientName: offer.accepted_by_name ?? '—',
    clientEmail: offer.accepted_by_email ?? '—',
    comment: offer.client_comment,
    acceptedAt: offer.accepted_at ? fmtDate(offer.accepted_at) : '—',
    adminUrl: adminOfferUrl(offer.id),
  };

  const { html, text } = await renderEmail(createElement(OfferAcceptedConsultant, props));
  const result = await sendEmail({
    to: consultant.email,
    subject: `✅ Oferta ${offer.offer_number} zaakceptowana — ${offer.client_name}, wariant ${props.acceptedVariant}`,
    html,
    text,
    tags: [
      { name: 'event', value: 'offer_accepted' },
      { name: 'offer_number', value: offer.offer_number.replace(/[^A-Za-z0-9_-]/g, '_') },
    ],
  });

  await logEmailEvent(offer.id, {
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
    clientName: offer.accepted_by_name ?? '—',
    clientEmail: offer.accepted_by_email,
    reason: offer.client_comment,
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
    template: 'OfferRejectedConsultant',
    to: consultant.email,
    result,
  });
}
