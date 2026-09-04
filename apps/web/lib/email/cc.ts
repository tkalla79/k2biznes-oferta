/**
 * Kto — poza klientem — dostaje kopię maila z ofertą.
 *
 * Reguła biznesowa (T. Kalla, 2026-09): kopia idzie do osoby wskazanej w ofercie
 * jako kontakt (`offers.contact_person_id` → `contact_persons.email`). Ta osoba
 * jest i tak widoczna dla klienta w sekcji kontaktowej oferty, więc jawne CC
 * niczego nie ujawnia, a daje wspólny wątek: klient odpowiadając „do wszystkich"
 * trafia i do konsultanta (Reply-To), i do osoby kontaktowej.
 *
 * Funkcja jest czysta, bo cała wartość siedzi w przypadkach brzegowych:
 * brak osoby kontaktowej, osoba bez maila, osoba kontaktowa będąca zarazem
 * odbiorcą (wtedy CC oznaczałoby dwa razy ten sam adres w jednej wiadomości).
 */

/** Zgrubna sanity-check — nie walidator RFC. Adres i tak pochodzi z katalogu. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function resolveOfferCc(args: {
  /** Email osoby kontaktowej z oferty (może być null — kolumna jest nullable). */
  contactEmail?: string | null;
  /** Adres, na który idzie oferta — nie dublujemy go w CC. */
  recipientEmail: string;
}): string[] {
  const contact = args.contactEmail?.trim();
  if (!contact || !EMAIL_RE.test(contact)) return [];
  if (contact.toLowerCase() === args.recipientEmail.trim().toLowerCase()) return [];
  return [contact];
}
