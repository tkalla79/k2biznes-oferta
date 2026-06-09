/**
 * Zod schematy dla `/api/offers/*` (BACKEND_SPEC.md v1.1.1, sekcja 5.3).
 *
 * Jeden source of truth: typy są pochodne od schematów (`z.infer<...>`).
 */
import { z } from 'zod';
import { PricingOverrideSchema } from '@/lib/pricing/override';
import { expiresAtSchema } from './shared';

// =============================================================================
// Wspólne
// =============================================================================

const PricingVariantId = z.enum(['I', 'II', 'III', 'IV']);
const CompanySize = z.enum(['micro', 'small', 'medium', 'large']);
const OfferStatus = z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']);

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

export const CreateOfferInput = z.object({
  ...offerFields,

  returningClient: z.boolean().default(false),
  projectCount: z.number().int().min(1).max(5).default(1),

  selectedVariant: PricingVariantId.default('I'),
  offeredVariants: z.array(PricingVariantId).min(1).max(4).default(['I', 'II', 'III']),

  content: z.record(z.string(), z.unknown()).default({}),
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
    patch.projectCount !== undefined
  );
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
