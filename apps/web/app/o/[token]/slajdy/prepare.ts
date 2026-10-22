/**
 * Przygotowanie danych slajdów: dwa wybory, które strona oferty robi inline
 * w page.tsx. Tu wydzielone, żeby dało się je sprawdzić testem bez bazy.
 */
import { normalizeOfferKind } from '@/lib/offers/kind';
import { resolveScopeVariant } from '@/lib/offers/scopeVariant';
import { SCOPE_BY_VARIANT } from '../staticContent';

export type FaqRow = { question: string; answer: string; kind?: string | null };
export type FaqItem = { q: string; a: string };

/**
 * FAQ jak na stronie oferty: panel trzyma osobny zestaw dla każdego typu oferty
 * (kolumna `faq_items.kind`). Wiersz bez `kind` (stan sprzed migracji) i z
 * nieznaną wartością liczy się jako dotacyjny, tak jak w `normalizeOfferKind`.
 * Slajdy obsługują tylko dotacje, więc bierzemy ten typ; pusty zestaw wraca do
 * treści zaszytej w kodzie, żeby oferta nigdy nie wyszła bez FAQ.
 */
export function grantFaq(rows: FaqRow[], fallback: FaqItem[]): FaqItem[] {
  const own = rows.filter((f) => normalizeOfferKind(f.kind) === 'grant');
  return own.length > 0 ? own.map((f) => ({ q: f.question, a: f.answer })) : fallback;
}

/**
 * Zakres prac i opłata wykonawcza z wariantu zadeklarowanego przy rekomendowanym
 * programie. Oferta sprzed migracji nie ma tego pola i wraca do rozpoznania po
 * nazwie programu (`resolveScopeVariant`), tak samo jak na stronie.
 */
export function slideScope(recommended: { scopeVariant?: unknown; name?: unknown; program?: unknown } | null) {
  return SCOPE_BY_VARIANT[resolveScopeVariant(recommended)];
}
