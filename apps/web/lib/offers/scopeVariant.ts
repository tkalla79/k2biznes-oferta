/**
 * Wariant zakresu prac (sekcja 03 oferty dotacyjnej).
 *
 * Program „Kultura" (Fundusze Norweskie i EOG) rządzi się inną procedurą niż
 * nabory krajowe, więc pokazuje inne czynności. Dotąd rozpoznawaliśmy go
 * regexem po nazwie rekomendowanej pozycji — a to znaczyło, że nabór nazwany
 * inaczej po cichu dostawał krajowy zakres i klient czytał listę czynności,
 * których u niego nie wykonujemy. Teraz wariant jest deklarowany przy
 * programie w bibliotece (`alt_programs.scope_variant`) i kopiowany do oferty
 * razem z resztą danych pozycji.
 *
 * DODANIE WARIANTU wymaga czterech rzeczy naraz, inaczej oferta cicho pokaże
 * zakres standardowy:
 *   1. wpis tutaj w `SCOPE_VARIANTS` i etykieta w `SCOPE_VARIANT_LABELS`,
 *   2. listy czynności w `app/o/[token]/staticContent.ts`,
 *   3. wpis w `SCOPE_BY_VARIANT` tamże,
 *   4. rozszerzenie checku `alt_programs_scope_variant_check` migracją.
 */

export const SCOPE_VARIANTS = ['standard', 'culture'] as const;
export type ScopeVariant = (typeof SCOPE_VARIANTS)[number];

export const SCOPE_VARIANT_LABELS: Record<ScopeVariant, string> = {
  standard: 'Standardowy (nabory krajowe)',
  culture: 'Kultura (Fundusze Norweskie i EOG)',
};

/**
 * Zawęża wartość z bazy albo z jsonb oferty. Nieznany wariant = standardowy:
 * zakres krajowy jest tym, co pasuje do większości naborów, a oferta nie może
 * się wywrócić przez literówkę w danych.
 */
export function normalizeScopeVariant(value: unknown): ScopeVariant {
  return SCOPE_VARIANTS.includes(value as ScopeVariant) ? (value as ScopeVariant) : 'standard';
}

/**
 * Wariant dla oferty sprzed wprowadzenia kolumny — po nazwie, czyli dokładnie
 * tą regułą, którą kod stosował wcześniej.
 *
 * Istnieje wyłącznie dla zgodności wstecznej: oferty wysłane przed tą zmianą
 * mają w `content.altPrograms` snapshot bez `scopeVariant`, a nie wolno im po
 * cichu podmienić zakresu prac pod działającym linkiem. Do usunięcia, gdy
 * żadna żywa oferta nie będzie starsza niż ta zmiana.
 */
export function legacyScopeVariantFromName(name: string, program: string): ScopeVariant {
  return /\b(EOG|norwesk)/i.test(`${program} ${name}`) ? 'culture' : 'standard';
}

/**
 * Wariant rekomendowanej pozycji oferty: jawny, gdy oferta go niesie; inaczej
 * reguła zgodnościowa po nazwie.
 */
export function resolveScopeVariant(
  recommended: { scopeVariant?: unknown; name?: unknown; program?: unknown } | null,
): ScopeVariant {
  if (!recommended) return 'standard';
  if (typeof recommended.scopeVariant === 'string') {
    return normalizeScopeVariant(recommended.scopeVariant);
  }
  return legacyScopeVariantFromName(
    typeof recommended.name === 'string' ? recommended.name : '',
    typeof recommended.program === 'string' ? recommended.program : '',
  );
}
