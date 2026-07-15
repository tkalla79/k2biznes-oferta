/**
 * Czysta logika ekstrakcji oferty z transkrypcji (AI-DRAFT).
 *
 * Wyodrębniona z route handlera, żeby normalizację wyjścia modelu dało się
 * testować jednostkowo bez Anthropic SDK / Next / Supabase. Handler dostarcza
 * surowe `raw` (wyjście tool-use) + realną bibliotekę programów z bazy.
 */

export const COMPANY_SIZES = ['micro', 'small', 'medium', 'large'] as const;

export const VOIVODESHIPS = [
  'dolnoslaskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'lodzkie',
  'malopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie',
  'pomorskie', 'slaskie', 'swietokrzyskie', 'warminsko-mazurskie',
  'wielkopolskie', 'zachodniopomorskie', 'ogolnopolski',
] as const;

export type DraftLibItem = {
  id: string;
  name: string;
  program: string;
  nabor: string | null;
  desc: string | null;
};

export type DraftData = {
  fields: {
    clientName: string | null;
    clientNip: string | null;
    clientIndustry: string | null;
    clientCompanySize: string | null;
    clientVoivodeship: string | null;
    recommendationBasis: string | null;
    projectValue: number | null;
  };
  suggestedProgram: DraftLibItem | null;
  warnings: string[];
};

/**
 * Defensywna normalizacja wyjścia modelu — NIE ufamy ślepo temu, co zwróci LLM.
 * Odrzuca niepasujące enumy, zły NIP, nierealne kwoty i sugestie programów
 * spoza dostarczonej biblioteki.
 */
export function buildDraftData(
  raw: Record<string, unknown>,
  library: DraftLibItem[],
  serverWarnings: string[] = [],
): DraftData {
  const libIds = library.map((p) => p.id);
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  const clientNipRaw = str(raw.clientNip)?.replace(/\D/g, '') ?? null;
  const clientNip = clientNipRaw && /^\d{10}$/.test(clientNipRaw) ? clientNipRaw : null;

  const sizeRaw = str(raw.clientCompanySize);
  const clientCompanySize = (COMPANY_SIZES as readonly string[]).includes(sizeRaw ?? '') ? sizeRaw : null;

  const voivRaw = str(raw.clientVoivodeship);
  const clientVoivodeship = (VOIVODESHIPS as readonly string[]).includes(voivRaw ?? '') ? voivRaw : null;

  const pv = typeof raw.projectValue === 'number' && isFinite(raw.projectValue) ? raw.projectValue : null;
  const projectValue = pv !== null && pv > 0 && pv <= 1_000_000_000 ? Math.round(pv) : null;

  const recommendationBasis = str(raw.recommendationBasis)?.slice(0, 1500) ?? null;

  const suggestedId = str(raw.suggestedProgramId);
  const suggestedProgram =
    suggestedId && libIds.includes(suggestedId)
      ? library.find((p) => p.id === suggestedId) ?? null
      : null;

  const modelWarnings = Array.isArray(raw.warnings)
    ? raw.warnings.filter((w): w is string => typeof w === 'string')
    : [];
  if (projectValue !== null) {
    modelWarnings.push('Wartość projektu wyciągnięto z rozmowy — potwierdź kwotę przed wyceną.');
  }

  return {
    fields: {
      clientName: str(raw.clientName),
      clientNip,
      clientIndustry: str(raw.clientIndustry),
      clientCompanySize,
      clientVoivodeship,
      recommendationBasis,
      projectValue,
    },
    suggestedProgram,
    warnings: [...serverWarnings, ...modelWarnings],
  };
}
