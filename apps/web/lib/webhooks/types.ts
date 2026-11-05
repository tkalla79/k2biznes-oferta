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
    /** Typ oferty: dotacja vs pozyczka (kolumna offers.offer_kind). */
    offerKind: 'grant' | 'loan' | 'exec';
    projectValue: number;
    /** null dla ofert pozyczkowych (intensywnosc dofinansowania nie wystepuje). */
    fundingRate: number | null;
    /** Dotacja: kwota dofinansowania. Pozyczka: wnioskowana kwota pozyczki. */
    funding: number;
    selectedVariant: string;
    acceptedVariant: string | null;
    acceptedFee: number | null;
    /**
     * Skladniki zaakceptowanego wariantu — z tego, co klient widzial (snapshot
     * z nalozonym recznym cennikiem). CRM ma z czego zlozyc produkty deala;
     * sama `acceptedFee` to tylko wynagrodzenie wynikowe, bez oplaty wstepnej
     * i czesci miesiecznej. `null` dla pozyczki i zakresu 2 (brak wariantow)
     * oraz dopoki oferta nie zostala zaakceptowana.
     */
    acceptedBreakdown: {
      variant: string;
      /** Oplata wstepna. */
      base: number;
      /** Ulamek, nie procent: 0.06 = 6%. */
      sfPct: number;
      /** Wynagrodzenie wynikowe — ta sama liczba co `acceptedFee`. */
      sfAmount: number;
      /** Stawka miesieczna za obsluge i rozliczanie. */
      monthly: number;
      /** base + sfAmount, bez czesci miesiecznej. */
      total: number;
    } | null;
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
