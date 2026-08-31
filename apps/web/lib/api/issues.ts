/**
 * Czytelne komunikaty walidacji dla formularzy panelu.
 *
 * API zwraca przy 422 `error.message = "Nieprawidłowe dane wejściowe."` oraz
 * `error.details.issues` z dokładną ścieżką każdego odrzuconego pola
 * (BACKEND_SPEC sekcja 5.1). Formularze pokazywały tylko `message`, więc
 * konsultant widział komunikat bez informacji, KTÓRE pole jest nie tak —
 * i nie miał jak tego odkryć bez zakładki Network.
 *
 * Ten helper składa jedno zdanie z nazwami pól po polsku.
 */

/** Etykiety pól — ścieżka z Zoda → nazwa widoczna w formularzu oferty. */
const FIELD_LABELS: Record<string, string> = {
  clientName: 'Nazwa klienta',
  clientNip: 'NIP',
  clientIndustry: 'Branża',
  clientCompanySize: 'Wielkość firmy',
  clientVoivodeship: 'Województwo',
  programId: 'Program (id)',
  programLabel: 'Nazwa programu / produktu',
  programCustomName: 'Własna nazwa programu',
  projectValue: 'Wartość projektu / kwota pożyczki',
  fundingRate: 'Intensywność dofinansowania',
  returningClient: 'Klient powracający',
  projectCount: 'Liczba projektów',
  selectedVariant: 'Wariant rekomendowany',
  offeredVariants: 'Warianty w ofercie',
  offerKind: 'Typ oferty',
  caseStudyId: 'Case study',
  contactPersonId: 'Osoba kontaktowa',
  assignedConsultantId: 'Opiekun oferty',
  content: 'Treść oferty',
  pricingOverride: 'Ręczny cennik',
  status: 'Status',
  expiresAt: 'Data wygaśnięcia',
  'loan.baseFee': 'Opłata wstępna',
  'loan.sfPct': 'Wynagrodzenie wynikowe (%)',
  'loan.product.name': 'Nazwa produktu',
  'loan.product.interestRate': 'Oprocentowanie',
  'loan.product.termMonths': 'Okres spłaty',
  'loan.product.graceMonths': 'Karencja',
  'loan.product.commission': 'Prowizja',
  'loan.product.ownContribution': 'Wkład własny',
};

type ApiIssue = { path?: unknown; message?: unknown };

function labelFor(path: unknown): string | null {
  if (!Array.isArray(path) || path.length === 0) return null;
  const dotted = path.filter((p) => typeof p === 'string' || typeof p === 'number').join('.');
  if (!dotted) return null;
  return FIELD_LABELS[dotted] ?? dotted;
}

/**
 * Wyciąga z odpowiedzi API komunikat do pokazania w formularzu.
 *
 * Gdy odpowiedź niesie `details.issues`, dopisuje do komunikatu listę pól
 * z powodem odrzucenia. Bez `issues` (albo przy nieznanym kształcie odpowiedzi)
 * zwraca `error.message`, a w ostateczności `fallback` — nigdy nie rzuca.
 */
export function formatApiError(body: unknown, fallback: string): string {
  const err = (body as { error?: { message?: unknown; details?: { issues?: unknown } } })?.error;
  const base = typeof err?.message === 'string' && err.message ? err.message : fallback;

  const issues = err?.details?.issues;
  if (!Array.isArray(issues) || issues.length === 0) return base;

  const parts: string[] = [];
  for (const raw of issues as ApiIssue[]) {
    const label = labelFor(raw?.path);
    const msg = typeof raw?.message === 'string' ? raw.message : '';
    if (label && msg) parts.push(`${label}: ${msg}`);
    else if (label) parts.push(label);
    else if (msg) parts.push(msg);
  }
  if (parts.length === 0) return base;

  // Dedup — Zod potrafi zwrócić dwa issues na to samo pole (np. union).
  const unique = [...new Set(parts)];
  return `${base} ${unique.join('; ')}`;
}
