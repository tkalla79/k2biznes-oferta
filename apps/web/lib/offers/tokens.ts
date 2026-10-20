/**
 * Podstawienia w treści oferty — wartości, które zmieniają się globalnie,
 * a stoją w wielu szablonach naraz.
 *
 * Powód: limit pomocy de minimis wzrósł ze 200 000 do 300 000 EUR
 * (rozporządzenie 2023/2831). Kwota była wpisana ręcznie w treściach
 * szablonów, więc jedna zmiana przepisu oznaczała polowanie na wszystkie
 * kopie — a każda pominięta to nieprawda wysłana klientowi. Teraz w treści
 * pisze się `{{de_minimis}}`, a wartość stoi raz w `app_settings`.
 *
 * Nieznany token zostaje w tekście nietknięty. Celowo: wycięcie go po cichu
 * dałoby zdanie z dziurą („limit wynosi  w okresie 3 lat"), którego nikt nie
 * zauważy; `{{de_minimus}}` na podglądzie widać od razu.
 */

export const OFFER_TOKEN_KEYS = ['de_minimis'] as const;
export type OfferTokenKey = (typeof OFFER_TOKEN_KEYS)[number];
export type OfferTokens = Record<OfferTokenKey, string>;

export const OFFER_TOKEN_LABELS: Record<OfferTokenKey, string> = {
  de_minimis: 'Limit pomocy de minimis',
};

export const OFFER_TOKEN_HINTS: Record<OfferTokenKey, string> = {
  de_minimis:
    'Maksymalna wartość pomocy de minimis dla jednego przedsiębiorstwa w okresie 3 lat.',
};

/**
 * Wartości domyślne — stan prawny na 2024-01-01 (rozporządzenie 2023/2831).
 * Dzięki nim `{{de_minimis}}` działa poprawnie także zanim ktokolwiek wejdzie
 * w ustawienia; pusta baza nie oznacza pustego miejsca w ofercie.
 */
export const OFFER_TOKEN_DEFAULTS: OfferTokens = {
  de_minimis: '300 000 EUR',
};

/** `app_settings.value` to jsonb bez gwarancji kształtu — zawężamy do stringów. */
export function resolveOfferTokens(raw: unknown): OfferTokens {
  const v = (raw ?? {}) as Record<string, unknown>;
  const out = { ...OFFER_TOKEN_DEFAULTS };
  for (const k of OFFER_TOKEN_KEYS) {
    const val = v[k];
    if (typeof val === 'string' && val.trim() !== '') out[k] = val.trim();
  }
  return out;
}

const TOKEN_RE = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

/** Podstawia tokeny w jednym stringu. Nieznane zostawia bez zmian. */
export function applyOfferTokensToText(text: string, tokens: OfferTokens): string {
  return text.replace(TOKEN_RE, (match, name: string) => {
    const key = name.toLowerCase() as OfferTokenKey;
    return (OFFER_TOKEN_KEYS as readonly string[]).includes(key) ? tokens[key] : match;
  });
}

/**
 * Podstawia tokeny w całym `content` oferty — rekurencyjnie, bo treść to jsonb
 * o zmiennym kształcie (stringi, tablice punktorów, lista alt-programów).
 * Obejście pola po polu znaczyłoby, że każde nowe pole trzeba pamiętać dopisać.
 */
export function applyOfferTokens<T>(value: T, tokens: OfferTokens): T {
  if (typeof value === 'string') {
    return applyOfferTokensToText(value, tokens) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => applyOfferTokens(v, tokens)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyOfferTokens(v, tokens);
    }
    return out as unknown as T;
  }
  return value;
}
