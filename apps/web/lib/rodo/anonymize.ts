/**
 * Anonimizacja PII (BACKEND_SPEC.md v1.1.1, sekcja 11.4 + 11.7).
 *
 * Reguły:
 * - `offers.accepted_by_name/email/comment` → '[RODO usunięto]' / NULL
 *   (nie hard-delete, bo retention 7 lat dla księgowości)
 * - `offer_events.ip_hash/user_agent` → NULL (zachowujemy event log dla audytu,
 *   ale bez korelacji per-IP po rotacji salta — sekcja 11.7)
 * - `profiles.email/full_name/phone/photo_url` → tombstone, `is_active=false`
 *   `auth.users` zostaje (Supabase Auth ma własny soft-delete flow przez admin API)
 * - Storage: PDFy z `offer-pdfs/{number}_*.pdf` zostają (sekcja 11.8 — life-cycle 7 lat
 *   per-bucket, bez hard delete dla compliance)
 */
import { createAdminClient } from '@/lib/supabase/admin';

const TOMBSTONE_TEXT = '[RODO usunięto]';

export type AnonymizeResult = {
  offers_anonymized: number;
  events_anonymized: number;
  profile_anonymized: boolean;
  consultant_id: string | null;
};

/**
 * Anonimizuje wszystkie offers, events i profile dla danego email klienta.
 *
 * Email klienta (`accepted_by_email`) — anonimizujemy jego dane na ofertach.
 * Email konsultanta — anonimizujemy profile (osobna metoda).
 *
 * Best-effort: każda część leci osobno, błędy logujemy ale kontynuujemy.
 */
export async function anonymizeByClientEmail(email: string): Promise<AnonymizeResult> {
  const sb = createAdminClient();
  const result: AnonymizeResult = {
    offers_anonymized: 0,
    events_anonymized: 0,
    profile_anonymized: false,
    consultant_id: null,
  };

  // 1. offers — anonimizuj akceptujących klientów
  const { data: offerIds, error: offersErr } = await sb
    .from('offers')
    .update({
      accepted_by_name: TOMBSTONE_TEXT,
      accepted_by_email: TOMBSTONE_TEXT,
      client_comment: null,
    })
    .eq('accepted_by_email', email)
    .select('id');

  if (offersErr) {
    console.error('[rodo.anonymize] offers update failed:', offersErr.message);
  } else {
    result.offers_anonymized = offerIds?.length ?? 0;
  }

  // 2. offer_events — anonimizuj ip_hash/user_agent dla offers powyżej
  if (result.offers_anonymized > 0 && offerIds) {
    const ids = offerIds.map((o) => o.id);
    const { count, error: eventsErr } = await sb
      .from('offer_events')
      .update({ ip_hash: null, user_agent: null }, { count: 'exact' })
      .in('offer_id', ids);

    if (eventsErr) {
      console.error('[rodo.anonymize] events update failed:', eventsErr.message);
    } else {
      result.events_anonymized = count ?? 0;
    }
  }

  return result;
}

/**
 * Anonimizuje profile konsultanta — używane gdy konsultant żąda usunięcia.
 * Profile pozostaje (FK z offers), ale email/imię → tombstone.
 */
export async function anonymizeProfileByEmail(email: string): Promise<AnonymizeResult> {
  const sb = createAdminClient();
  const result: AnonymizeResult = {
    offers_anonymized: 0,
    events_anonymized: 0,
    profile_anonymized: false,
    consultant_id: null,
  };

  // Najpierw pobierz id profilu (potrzebne w response)
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!profile) {
    return result;
  }
  result.consultant_id = profile.id;

  // Tombstone email zamiast pustego maila — zachowuje unique constraint
  const tombstoneEmail = `deleted-${profile.id}@tombstone`;

  const { error } = await sb
    .from('profiles')
    .update({
      email: tombstoneEmail,
      full_name: TOMBSTONE_TEXT,
      phone: null,
      photo_url: null,
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  if (error) {
    console.error('[rodo.anonymize] profile update failed:', error.message);
  } else {
    result.profile_anonymized = true;
  }

  return result;
}

/**
 * Pełen execute: klient + (jeśli ma profile) + audyt.
 */
export async function executeFullAnonymization(
  email: string,
  executedBy: string,
): Promise<AnonymizeResult> {
  const clientResult = await anonymizeByClientEmail(email);
  const profileResult = await anonymizeProfileByEmail(email);

  return {
    offers_anonymized: clientResult.offers_anonymized,
    events_anonymized: clientResult.events_anonymized,
    profile_anonymized: profileResult.profile_anonymized,
    consultant_id: profileResult.consultant_id,
  };
}
