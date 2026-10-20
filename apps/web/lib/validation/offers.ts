/**
 * Zod schematy dla `/api/offers/*` (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Jeden source of truth: typy są pochodne od schematów (`z.infer<...>`).
 */
import { z } from 'zod';
import { PricingOverrideSchema } from '@/lib/pricing/override';
import { expiresAtSchema, offerKindSchema } from './shared';
import { normalizeOfferKind } from '@/lib/offers/kind';

// =============================================================================
// Wspólne
// =============================================================================

const PricingVariantId = z.enum(['I', 'II', 'III', 'IV']);
const CompanySize = z.enum(['micro', 'small', 'medium', 'large']);
const OfferStatus = z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']);
const OfferKind = offerKindSchema;

// =============================================================================
// Pożyczki (tryb `loan`) — parametry produktu per-oferta + stawki.
// Parametry produktu jako wolny tekst (np. "od 2% w skali roku", "do 84 mies.").
// =============================================================================

const LoanProductInput = z.object({
  name: z.string().max(200).optional(),
  interestRate: z.string().max(120).optional(),
  termMonths: z.string().max(120).optional(),
  graceMonths: z.string().max(120).optional(),
  commission: z.string().max(120).optional(),
  ownContribution: z.string().max(120).optional(),
});

export const LoanInput = z.object({
  baseFee: z.number().min(0).max(1_000_000).default(4000),
  sfPct: z.number().min(0).max(1).default(0.015),
  /**
   * Opis wynagrodzenia wynikowego w cenniku oferty. Domyślne zdanie („% wartości
   * przyznanej pożyczki — płatne po decyzji pożyczkowej") jest nieprawdziwe dla
   * części produktów (FRS liczy 2% kwoty umorzenia, PAKCER płaci w transzach),
   * więc tekst musi być nadpisywalny per oferta.
   *
   * Trzy stany, celowo rozróżniane: brak pola → zdanie domyślne, `''` → wiersz
   * opisu znika w całości, tekst → zastępuje domyślny.
   */
  sfNote: z.string().max(200).optional(),
  product: LoanProductInput.optional(),
});

export type LoanInput = z.infer<typeof LoanInput>;

// =============================================================================
// Sam zakres 2 (tryb `exec`) — obsługa i rozliczanie już przyznanego projektu.
// Sama stawka miesięczna: bez opłaty wstępnej, bez wariantów, bez success fee.
// =============================================================================

export const ExecInput = z.object({
  monthlyFee: z.number().min(0).max(1_000_000).default(3000),
  /** Okres obsługi — realizacja i trwałość potrafią zejść się w 10 lat. */
  months: z.number().int().min(1).max(120).default(12),
});

export type ExecInput = z.infer<typeof ExecInput>;

// =============================================================================
// Wspólne pola — single source of truth dla Create + Update
// =============================================================================

const offerFields = {
  clientName: z.string().min(1).max(200),
  clientNip: z.string().regex(/^\d{10}$/, 'NIP musi mieć 10 cyfr').optional(),
  clientIndustry: z.string().max(200).optional(),
  clientCompanySize: CompanySize.optional(),
  clientVoivodeship: z.string().max(50).optional(),

  programId: z.string().max(80).optional(),
  programLabel: z.string().min(1).max(200),
  programCustomName: z.string().max(200).optional(),

  projectValue: z.number().positive().max(1_000_000_000),
  fundingRate: z.number().min(0.1).max(0.95),

  caseStudyId: z.string().max(80).optional(),
  contactPersonId: z.string().max(80).optional(),
  assignedConsultantId: z.string().uuid().optional(),
};

// =============================================================================
// POST /api/offers — required + defaults
// =============================================================================

export const CreateOfferInput = z
  .object({
    ...offerFields,
    // fundingRate wymagany warunkowo (dotacja) — patrz superRefine niżej.
    fundingRate: offerFields.fundingRate.optional(),

    offerKind: OfferKind.default('grant'),
    loan: LoanInput.optional(),
    exec: ExecInput.optional(),

    returningClient: z.boolean().default(false),
    projectCount: z.number().int().min(1).max(5).default(1),

    selectedVariant: PricingVariantId.default('I'),
    offeredVariants: z.array(PricingVariantId).min(1).max(4).default(['I', 'II', 'III']),

    content: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((v, ctx) => {
    if (v.offerKind === 'grant' && v.fundingRate === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fundingRate'],
        message: 'fundingRate jest wymagany dla oferty dotacyjnej',
      });
    }
  });

export type CreateOfferInput = z.infer<typeof CreateOfferInput>;

// =============================================================================
// PATCH /api/offers/:id — wszystkie pola opcjonalne, BEZ defaults
// =============================================================================

export const UpdateOfferInput = z.object({
  // pola wspólne — opcjonalne na update
  clientName: offerFields.clientName.optional(),
  clientNip: offerFields.clientNip,
  clientIndustry: offerFields.clientIndustry,
  clientCompanySize: offerFields.clientCompanySize,
  clientVoivodeship: offerFields.clientVoivodeship,

  programId: offerFields.programId,
  programLabel: offerFields.programLabel.optional(),
  programCustomName: offerFields.programCustomName,

  projectValue: offerFields.projectValue.optional(),
  fundingRate: offerFields.fundingRate.optional(),
  returningClient: z.boolean().optional(),
  projectCount: z.number().int().min(1).max(5).optional(),

  selectedVariant: PricingVariantId.optional(),
  offeredVariants: z.array(PricingVariantId).min(1).max(4).optional(),

  offerKind: OfferKind.optional(),
  loan: LoanInput.optional(),
  exec: ExecInput.optional(),

  caseStudyId: offerFields.caseStudyId,
  contactPersonId: offerFields.contactPersonId,
  assignedConsultantId: offerFields.assignedConsultantId,

  content: z.record(z.string(), z.unknown()).optional(),

  // Manual override pricingu (toggle Auto/Ręczne w UI editora).
  // {} oznacza brak override — auto-calc. Patrz lib/pricing/override.ts.
  pricingOverride: PricingOverrideSchema.optional(),

  // PATCH-only
  status: OfferStatus.optional(),
  // M9 audit: walidacja expiresAt w lib/validation/shared.ts (współdzielona z send).
  expiresAt: expiresAtSchema,
});

export type UpdateOfferInput = z.infer<typeof UpdateOfferInput>;

/**
 * Zwraca `true` jeśli zmiana wymaga przeliczenia `pricing_snapshot`.
 * Pola wpływające na pricing: projectValue, fundingRate, returningClient,
 * projectCount, programId (opcjonalnie — segment dobierany z funding,
 * ale program może warunkować wartość projektu).
 */
export function shouldRecalcSnapshot(patch: UpdateOfferInput): boolean {
  return (
    patch.projectValue !== undefined ||
    patch.fundingRate !== undefined ||
    patch.returningClient !== undefined ||
    patch.projectCount !== undefined ||
    patch.loan !== undefined ||
    patch.exec !== undefined ||
    // Zmiana typu oferty zmienia caly model cennika (segmenty+warianty vs
    // oplata+% od kwoty). Bez przeliczenia snapshot zostalby w starym ksztalcie,
    // a widok klienta dostalby dane niezgodne z offer_kind.
    patch.offerKind !== undefined
  );
}

// =============================================================================
// Decyzja klienta zgłoszona poza systemem (POST /api/offers/:id/decision)
// =============================================================================

/**
 * Kanał, którym klient przekazał decyzję. Zapisujemy go, bo przy akceptacji
 * poza formularzem to jedyny ślad, skąd wiemy o decyzji — w audycie „klient
 * potwierdził" bez źródła nie znaczy nic.
 */
export const DECISION_CHANNELS = ['email', 'phone', 'meeting', 'other'] as const;
export type DecisionChannel = (typeof DECISION_CHANNELS)[number];

export const OfferDecisionInput = z.object({
  decision: z.enum(['accepted', 'rejected']),
  channel: z.enum(DECISION_CHANNELS),
  /** Kto po stronie klienta przekazał decyzję — imię i nazwisko albo rola. */
  confirmedBy: z.string().min(1).max(200),
  /** Wariant — wymagany tylko w ofercie dotacyjnej przy akceptacji. */
  variant: z.enum(['I', 'II', 'III', 'IV']).optional(),
  /** Kontekst: cytat z maila, numer telefonu, powód odmowy. */
  note: z.string().max(2000).optional(),
});

export type OfferDecisionInput = z.infer<typeof OfferDecisionInput>;

/**
 * Stan cenotwórczy oferty przed zmianą — tyle, ile potrzeba, żeby odpowiedzieć
 * „czy te liczby faktycznie się ruszają". Celowo nie cały wiersz z bazy:
 * funkcja ma być testowalna bez mockowania Supabase.
 */
export type PricingInputsBefore = {
  offer_kind: string | null;
  project_value: number | string;
  funding_rate: number | string | null;
  returning_client: boolean;
  project_count: number;
  content: unknown;
};

const num = (v: unknown): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;

/**
 * Czy patch zmienia którąkolwiek LICZBĘ wchodzącą do cennika?
 *
 * `shouldRecalcSnapshot` patrzy tylko na obecność pól, a formularz oferty
 * wysyła cały obiekt `loan`/`exec` przy każdym zapisie. Skutkiem była blokada
 * nie do obejścia: żeby poprawić sam OPIS wynagrodzenia (`content.loan.sfNote`,
 * czysty tekst) na ofercie już wysłanej, trzeba było przepchnąć `loan`, a to
 * wyglądało jak zmiana finansowa i kończyło się 409 — mimo że żadna kwota się
 * nie ruszała. Zamrożenie cennika po wysyłce ma chronić kwoty, nie zdania.
 *
 * Porównujemy wartości efektywne (patch albo stan sprzed zmiany), więc zapis
 * bez realnej zmiany liczb nie przelicza snapshotu i nie jest blokowany.
 */
export function pricingInputsChanged(
  patch: UpdateOfferInput,
  before: PricingInputsBefore,
): boolean {
  const kindBefore = normalizeOfferKind(before.offer_kind);
  const kind = patch.offerKind ?? kindBefore;
  if (kind !== kindBefore) return true;

  if ((patch.projectValue ?? num(before.project_value)) !== num(before.project_value)) return true;

  if (kind === 'grant') {
    return (
      (patch.fundingRate ?? num(before.funding_rate)) !== num(before.funding_rate) ||
      (patch.returningClient ?? before.returning_client) !== before.returning_client ||
      (patch.projectCount ?? before.project_count) !== before.project_count
    );
  }

  const content = (before.content ?? {}) as Record<string, unknown>;
  if (kind === 'loan') {
    const b = (content.loan ?? {}) as { baseFee?: unknown; sfPct?: unknown };
    return (
      (patch.loan?.baseFee ?? num(b.baseFee)) !== num(b.baseFee) ||
      (patch.loan?.sfPct ?? num(b.sfPct)) !== num(b.sfPct)
    );
  }

  const b = (content.exec ?? {}) as { monthlyFee?: unknown; months?: unknown };
  return (
    (patch.exec?.monthlyFee ?? num(b.monthlyFee)) !== num(b.monthlyFee) ||
    (patch.exec?.months ?? num(b.months)) !== num(b.months)
  );
}

/**
 * Czy ta zmiana kasuje wewnętrzną akceptację oferty?
 *
 * Akceptacja dotyczy **treści, którą zobaczy klient**, więc traci ważność, gdy
 * ta treść się zmieni — inaczej kontrola byłaby pozorna: zatwierdzam czystą
 * ofertę, podmieniam kwoty przez `pricingOverride` i wysyłam zatwierdzoną.
 * To samo dotyczy oferty już wysłanej: `PATCH` blokuje po wysyłce tylko pola
 * finansowe, a `content` i `pricingOverride` przechodziły bez sprawdzenia
 * statusu, zmieniając to, co klient widzi pod tym samym linkiem.
 *
 * Lista jest jawna, a nie „wszystko poza kilkoma polami", żeby dodanie nowego
 * pola do oferty wymagało świadomej decyzji, po której stronie ma leżeć.
 */
const CLIENT_VISIBLE_FIELDS = [
  'clientName',
  'clientNip',
  'clientIndustry',
  'clientCompanySize',
  'clientVoivodeship',
  'programId',
  'programLabel',
  'programCustomName',
  'projectValue',
  'fundingRate',
  'returningClient',
  'projectCount',
  'selectedVariant',
  'offeredVariants',
  'offerKind',
  'loan',
  'exec',
  'caseStudyId',
  'contactPersonId',
  'content',
  'pricingOverride',
  'expiresAt',
] as const satisfies ReadonlyArray<keyof UpdateOfferInput>;

/**
 * Nie kasują akceptacji, bo klient ich nie widzi: `assignedConsultantId`
 * (kto prowadzi ofertę po naszej stronie) i `status` (zmieniany i tak przez
 * dedykowane endpointy).
 */
export function clearsApproval(patch: UpdateOfferInput): boolean {
  return CLIENT_VISIBLE_FIELDS.some((f) => patch[f] !== undefined);
}

// =============================================================================
// GET /api/offers
// =============================================================================

const csv = <T extends z.ZodEnum<[string, ...string[]]>>(item: T) =>
  z
    .string()
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(item));

export const ListOffersQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  status: csv(OfferStatus).optional(),
  clientName: z.string().max(200).optional(),
  programId: z.string().max(80).optional(),
  createdBy: z.string().uuid().optional(),
  // sort: 'createdAt:desc,clientName:asc'
  sort: z
    .string()
    .max(200)
    .default('createdAt:desc')
    .transform((s) =>
      s
        .split(',')
        .map((part) => {
          const [field, dir] = part.split(':');
          return { field: field.trim(), dir: (dir?.trim() ?? 'asc') as 'asc' | 'desc' };
        })
        .filter((p) => p.field),
    ),
});

export type ListOffersQuery = z.infer<typeof ListOffersQuery>;

/**
 * Whitelist pól po których wolno sortować. Wszystko inne → 422.
 */
export const SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'clientName',
  'projectValue',
  'fundingRate',
  'status',
  'offerNumber',
  'sentAt',
  'acceptedAt',
]);

/**
 * Mapowanie camelCase → snake_case dla kolumn DB.
 */
export const SORT_COLUMN_MAP: Record<string, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  clientName: 'client_name',
  projectValue: 'project_value',
  fundingRate: 'funding_rate',
  status: 'status',
  offerNumber: 'offer_number',
  sentAt: 'sent_at',
  acceptedAt: 'accepted_at',
};
