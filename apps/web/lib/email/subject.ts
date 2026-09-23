/**
 * Temat maila z ofertą.
 *
 * Dialog wysyłki od początku miał pole „Temat", a `SendOfferInput` je walidował
 * — ale nigdzie nie docierało do `sendEmail()`: temat był zawsze budowany z
 * szablonu. Konsultant wpisywał własny i wysyłał coś innego, nie wiedząc o tym.
 *
 * Domyślny temat zostaje bez zmian (klient i tak widzi go w skrzynce jako
 * „Oferta K2Biznes dla <firma> — <program>"), a własny wpis go nadpisuje.
 */
export function defaultOfferSubject(args: { clientName: string; programLabel: string }): string {
  return `Oferta K2Biznes dla ${args.clientName} — ${args.programLabel}`;
}

/**
 * Pusty / sam whitespace traktujemy jak brak tematu — inaczej wyczyszczenie pola
 * w dialogu wysyłałoby maila bez tematu, co u klienta wygląda jak spam.
 */
export function resolveOfferSubject(args: {
  custom?: string | null;
  clientName: string;
  programLabel: string;
}): string {
  const custom = args.custom?.trim();
  return custom && custom.length > 0 ? custom : defaultOfferSubject(args);
}
