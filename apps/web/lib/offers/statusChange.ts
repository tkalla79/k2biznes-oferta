/**
 * Ręczna zmiana statusu oferty przez admina — które przejścia są dozwolone
 * i co każde z nich robi z danymi oferty.
 *
 * Dotąd panel umiał tylko wpisać decyzję klienta (zaakceptowana/odrzucona) i
 * cofnąć decyzję wpisaną z panelu. Brakowało reszty: przywrócenia statusu
 * „wysłana", gdy ofertę „obejrzał" ktoś z zespołu, zamknięcia oferty jako
 * wygasłej, wznowienia wygasłej, cofnięcia decyzji, którą klient kliknął
 * przez pomyłkę. Surowy `PATCH {status}` byłby furtką: przestawiłby samo pole,
 * zostawiając kwotę akceptacji przy ofercie „obejrzanej" albo licznik otwarć
 * przy ofercie „nieotwartej" — dane przeczące statusowi.
 *
 * Dlatego każde przejście jest tu nazwane razem ze swoimi skutkami.
 * Akceptację i odmowę obsługuje osobny endpoint decyzji, bo wymagają wariantu,
 * kwoty i kanału, nie tylko powodu.
 */
import type { Database } from '@k2/database/types';

export type OfferStatus = Database['public']['Enums']['offer_status'];

/** Statusy, na które przestawia `POST /api/offers/:id/status`. */
export const MANUAL_STATUS_TARGETS = ['sent', 'viewed', 'expired'] as const;
export type ManualStatusTarget = (typeof MANUAL_STATUS_TARGETS)[number];

/** Statusy ustawiane przez endpoint decyzji (`POST /api/offers/:id/decision`). */
export const DECISION_TARGETS = ['accepted', 'rejected'] as const;
export type DecisionTarget = (typeof DECISION_TARGETS)[number];

/**
 * Dozwolone ręczne przejścia. Draft nie ma żadnego: wyjście z wersji roboczej
 * prowadzi przez wysyłkę albo „Otwórz link bez maila", które pilnują
 * wewnętrznej akceptacji — ręczna zmiana statusu byłaby jej obejściem.
 */
const MANUAL: Record<OfferStatus, readonly ManualStatusTarget[]> = {
  draft: [],
  sent: ['expired'],
  viewed: ['sent', 'expired'],
  accepted: ['sent', 'viewed'],
  rejected: ['sent', 'viewed'],
  expired: ['sent', 'viewed'],
};

const DECISION: Record<OfferStatus, readonly DecisionTarget[]> = {
  draft: [],
  sent: ['accepted', 'rejected'],
  viewed: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
  expired: [],
};

export function manualTargetsFrom(status: OfferStatus): readonly ManualStatusTarget[] {
  return MANUAL[status] ?? [];
}

export function decisionTargetsFrom(status: OfferStatus): readonly DecisionTarget[] {
  return DECISION[status] ?? [];
}

/** Wszystkie statusy, na które admin może przestawić ofertę z bieżącego. */
export function allTargetsFrom(status: OfferStatus): readonly (ManualStatusTarget | DecisionTarget)[] {
  return [...decisionTargetsFrom(status), ...manualTargetsFrom(status)];
}

/** Pola decyzji klienta — czyszczone, gdy oferta wraca do stanu sprzed decyzji. */
const CLEARED_DECISION = {
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
} as const;

export type StatusChangePlan = {
  update: Database['public']['Tables']['offers']['Update'];
  /** Opis skutków po polsku — do potwierdzenia w UI i do audytu. */
  effects: string[];
};

/**
 * Co zmienia w ofercie przejście `from` → `to`. `null`, gdy przejście nie jest
 * dozwolone.
 *
 * Zgód RODO (`gdpr_*`) nie czyścimy nigdy: to zapis tego, na co klient się
 * zgodził w danej chwili. Cofnięcie decyzji nie cofa historii.
 */
export function planStatusChange(args: {
  from: OfferStatus;
  to: ManualStatusTarget;
  expiresAt: string | null;
  now?: Date;
}): StatusChangePlan | null {
  const { from, to } = args;
  if (!manualTargetsFrom(from).includes(to)) return null;

  const now = args.now ?? new Date();
  const update: StatusChangePlan['update'] = { status: to };
  const effects: string[] = [];

  if (from === 'accepted' || from === 'rejected') {
    Object.assign(update, CLEARED_DECISION);
    effects.push(
      from === 'accepted'
        ? 'Usuwa zapis akceptacji: wariant, kwotę, akceptującego i komentarz. Historia zdarzeń i zgoda RODO zostają.'
        : 'Usuwa zapis odmowy: odrzucającego i powód. Historia zdarzeń zostaje.',
    );
  }

  // „Wysłana" znaczy „klient jeszcze nie otworzył". Licznik otwarć przy takim
  // statusie przeczyłby mu — i nie pozwoliłby uchwycić pierwszego prawdziwego
  // otwarcia, które samo przestawia ofertę na „obejrzana".
  if (to === 'sent') {
    update.view_count = 0;
    update.first_viewed_at = null;
    update.last_viewed_at = null;
    effects.push(
      'Zeruje licznik otwarć — następne otwarcie przez klienta znów przestawi ofertę na „obejrzana". Zdarzenia w historii zostają.',
    );
  }

  // Wznowienie oferty, której termin minął: link zwracałby „wygasła" (410)
  // niezależnie od statusu. Usuwamy termin zamiast zgadywać nowy.
  if (
    from === 'expired' &&
    args.expiresAt &&
    new Date(args.expiresAt).getTime() < now.getTime()
  ) {
    update.expires_at = null;
    effects.push(
      'Termin ważności minął, więc zostaje usunięty — inaczej link dalej pokazywałby „oferta wygasła". Nowy termin ustawisz w edytorze.',
    );
  }

  if (to === 'expired') {
    effects.push('Link pokaże klientowi „Oferta wygasła" i wyłączy formularz akceptacji.');
  }

  return { update, effects };
}
