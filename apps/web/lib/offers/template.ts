/**
 * Szablony oferty (feature #1) — extract/apply pól szablonowych.
 *
 * Jedno źródło prawdy KTÓRE pola formularza oferty należą do szablonu
 * (wszystko OPRÓCZ danych klienta). Operuje na generic record — niezależne
 * od OfferForm (client component), więc testowalne standalone.
 *
 * Szablon zapisuje strukturę oferty (program, warianty, treści, alt-programy,
 * case study, kontakt, pricing override). NIE zapisuje danych per-klient:
 * nazwa/NIP/branża klienta, wartość projektu, % dofinansowania, returningClient,
 * projectCount — te konsultant podaje przy konkretnej ofercie, pricing przelicza.
 */

// Pola FormState które trafiają do szablonu. Pominięte (klient): clientName,
// clientNip, clientIndustry, clientCompanySize, clientVoivodeship, projectValue,
// fundingRate, returningClient, projectCount.
export const TEMPLATE_FIELDS = [
  'programId',
  'programLabel',
  'programCustomName',
  'offeredVariants',
  'selectedVariant',
  'caseStudyId',
  'contactPersonId',
  'contentIntro',
  'contentFooter',
  'programDescription',
  'altPrograms',
  'needs',
  'programReason',
  'contentNotes',
  'assignedConsultantId',
  'pricingMode',
  'overrides',
  'execFee',
] as const;

/** Wyciąga pola szablonowe z form state (do zapisu jako template_data). */
export function extractTemplate(form: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TEMPLATE_FIELDS) {
    if (k in form) out[k] = form[k];
  }
  return out;
}

/**
 * Nakłada template_data na blank form state. Pola klienta zostają z blanku
 * (puste). Nieznane klucze w data są ignorowane (odporność na zmiany schematu).
 */
export function applyTemplate<T extends Record<string, unknown>>(
  blank: T,
  data: Record<string, unknown>,
): T {
  const out = { ...blank };
  for (const k of TEMPLATE_FIELDS) {
    if (k in data) (out as Record<string, unknown>)[k] = data[k];
  }
  return out;
}
