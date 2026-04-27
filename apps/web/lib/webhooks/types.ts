/**
 * Webhook event types + payload shapes (BACKEND_SPEC.md v1.1.1, sekcja 10).
 *
 * Wysyłamy do CRM-ów (HubSpot/Pipedrive/custom). Payload jest świadomie
 * minimalny — nie wysyłamy całego pricing_snapshot, tylko kluczowe pola
 * (CRM nie potrzebuje pełnej kalkulacji, a payload <2KB to mniejsze ryzyko
 * 413 Payload Too Large).
 */

export type WebhookEvent =
  | 'offer.created'
  | 'offer.sent'
  | 'offer.viewed'
  | 'offer.accepted'
  | 'offer.rejected';

export type WebhookTarget = 'hubspot' | 'pipedrive' | 'custom';

export type WebhookOfferPayload = {
  idempotencyKey: string;
  event: WebhookEvent;
  timestamp: string;
  offer: {
    id: string;
    offerNumber: string;
    status: string;
    clientName: string;
    clientNip: string | null;
    clientIndustry: string | null;
    programLabel: string;
    projectValue: number;
    fundingRate: number;
    funding: number;
    selectedVariant: string;
    acceptedVariant: string | null;
    acceptedFee: number | null;
  };
  client?: {
    name: string;
    email: string | null;
  };
  consultant: {
    id: string;
    email: string | null;
  };
};
