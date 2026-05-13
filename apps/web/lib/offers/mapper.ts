/**
 * Mapowanie Supabase row (snake_case) ↔ DTO API (camelCase).
 *
 * Konwencja sekcja 3.1: snake_case w DB, camelCase w TS na granicy API.
 */
import type { Database } from '@k2/database/types';
import type { PricingResult } from '@/lib/pricing';
import { applyOverride, parsePricingOverride, type PricingOverride } from '@/lib/pricing/override';
import { publicStorageUrl } from '@/lib/storage';

type OfferRow = Database['public']['Tables']['offers']['Row'];
type OfferInsert = Database['public']['Tables']['offers']['Insert'];

export type OfferDto = {
  id: string;
  offerNumber: string;
  status: OfferRow['status'];
  clientToken: string;
  clientUrl: string;

  createdBy: string;
  assignedConsultantId: string | null;
  contactPersonId: string | null;

  clientName: string;
  clientNip: string | null;
  clientIndustry: string | null;
  clientCompanySize: string | null;
  clientVoivodeship: string | null;

  programId: string | null;
  programLabel: string;
  programCustomName: string | null;

  projectValue: number;
  fundingRate: number;
  returningClient: boolean;
  projectCount: number;

  pricingSnapshot: PricingResult;
  pricingOverride: PricingOverride | null;

  selectedVariant: OfferRow['selected_variant'];
  offeredVariants: OfferRow['offered_variants'];

  caseStudyId: string | null;
  content: Record<string, unknown>;

  acceptedVariant: OfferRow['accepted_variant'];
  acceptedFee: number | null;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
  clientComment: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectedByEmail: string | null;
  rejectReason: string | null;

  gdprClauseVersion: string | null;
  gdprAcceptedAt: string | null;

  sentAt: string | null;
  firstViewedAt: string | null;
  lastViewedAt: string | null;
  viewCount: number;
  expiresAt: string | null;

  createdAt: string;
  updatedAt: string;
};

export function toOfferDto(row: OfferRow, appUrl: string): OfferDto {
  return {
    id: row.id,
    offerNumber: row.offer_number,
    status: row.status,
    clientToken: row.client_token,
    clientUrl: `${appUrl}/o/${row.client_token}`,

    createdBy: row.created_by,
    assignedConsultantId: row.assigned_consultant_id,
    contactPersonId: row.contact_person_id,

    clientName: row.client_name,
    clientNip: row.client_nip,
    clientIndustry: row.client_industry,
    clientCompanySize: row.client_company_size,
    clientVoivodeship: row.client_voivodeship,

    programId: row.program_id,
    programLabel: row.program_label,
    programCustomName: row.program_custom_name,

    projectValue: Number(row.project_value),
    fundingRate: Number(row.funding_rate),
    returningClient: row.returning_client,
    projectCount: row.project_count,

    pricingSnapshot: row.pricing_snapshot as unknown as PricingResult,
    pricingOverride: parsePricingOverride(row.pricing_override),

    selectedVariant: row.selected_variant,
    offeredVariants: row.offered_variants,

    caseStudyId: row.case_study_id,
    content: (row.content ?? {}) as Record<string, unknown>,

    acceptedVariant: row.accepted_variant,
    acceptedFee: row.accepted_fee == null ? null : Number(row.accepted_fee),
    acceptedByName: row.accepted_by_name,
    acceptedByEmail: row.accepted_by_email,
    clientComment: row.client_comment,
    acceptedAt: row.accepted_at,
    rejectedAt: row.rejected_at,
    rejectedByName: row.rejected_by_name,
    rejectedByEmail: row.rejected_by_email,
    rejectReason: row.reject_reason,

    gdprClauseVersion: row.gdpr_clause_version,
    gdprAcceptedAt: row.gdpr_accepted_at,

    sentAt: row.sent_at,
    firstViewedAt: row.first_viewed_at,
    lastViewedAt: row.last_viewed_at,
    viewCount: row.view_count,
    expiresAt: row.expires_at,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Embedded resources widoczne w publicznej ofercie.
 */
export type PublicContactPersonDto = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
};

export type PublicCaseStudyDto = {
  id: string;
  client: string;
  tag: string | null;
  title: string;
  paragraph1: string | null;
  paragraph2: string | null;
  stats: unknown[];
  industries: string[];
  programTags: string[];
  logoBig: string | null;
  logoSm: string | null;
};

type ContactPersonRow = Database['public']['Tables']['contact_persons']['Row'];
type CaseStudyRow = Database['public']['Tables']['case_studies']['Row'];

export function toContactPersonDto(row: ContactPersonRow): PublicContactPersonDto {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    photoUrl: publicStorageUrl(row.photo_storage_key, row.photo_url),
  };
}

export function toCaseStudyDto(row: CaseStudyRow): PublicCaseStudyDto {
  return {
    id: row.id,
    client: row.client,
    tag: row.tag,
    title: row.title,
    paragraph1: row.paragraph_1,
    paragraph2: row.paragraph_2,
    stats: Array.isArray(row.stats) ? row.stats : [],
    industries: row.industries,
    programTags: row.program_tags,
    logoBig: publicStorageUrl(row.logo_storage_key, row.logo_big),
    logoSm: row.logo_sm,
  };
}

/**
 * Pola, które klient PUBLIC (przez `/o/[token]`) NIE powinien widzieć.
 *
 * Strip:
 * - `clientToken`/`clientUrl` (tylko po stronie konsultanta)
 * - `clientNip` (PII firmy klienta)
 * - `createdBy`/`assignedConsultantId`/`contactPersonId` (id-ki wewnętrzne)
 * - `acceptedBy*`/`rejectedBy*`/`clientComment`/`rejectReason` (PII klientów —
 *   nie pokazujemy potencjalnemu kolejnemu odwiedzającemu)
 *
 * Embed:
 * - `contactPerson` (rozwinięty z `contact_person_id`)
 * - `caseStudy` (rozwinięty z `case_study_id`)
 */
/** Domyślne teksty exec-fee (sekcja 04 cennik, "Wynagrodzenie miesięczne"). */
export const DEFAULT_EXEC_FEE = {
  kicker: 'Obsługa i rozliczanie projektu (opcjonalnie)',
  title: 'Wynagrodzenie miesięczne',
  desc: 'Po pozytywnej decyzji, jeśli zdecydują się Państwo kontynuować współpracę przy obsłudze projektu.',
} as const;

export type ResolvedExecFee = {
  kicker: string;
  title: string;
  desc: string;
  monthly: number | null; // null = użyj selectedVariant.monthly
};

export type PublicOfferDto = Omit<
  OfferDto,
  | 'createdBy'
  | 'assignedConsultantId'
  | 'contactPersonId'
  | 'caseStudyId'
  | 'clientToken'
  | 'clientUrl'
  | 'clientNip'
  | 'acceptedByEmail'
  | 'acceptedByName'
  | 'clientComment'
  | 'rejectedByName'
  | 'rejectedByEmail'
  | 'rejectReason'
  | 'pricingOverride'
> & {
  contactPerson: PublicContactPersonDto | null;
  caseStudy: PublicCaseStudyDto | null;
  execFee: ResolvedExecFee;
};

export function toPublicOfferDto(
  row: OfferRow,
  contactPerson: ContactPersonRow | null,
  caseStudy: CaseStudyRow | null,
): PublicOfferDto {
  const full = toOfferDto(row, '');
  // Apply override przed wystawieniem publicznym — klient widzi finalne wartości,
  // nie rozróżnia auto-calc vs ręczne (sekcja 6.5 spec).
  const renderedSnapshot = applyOverride(full.pricingSnapshot, full.pricingOverride);
  const {
    createdBy: _createdBy,
    assignedConsultantId: _assignedConsultantId,
    contactPersonId: _contactPersonId,
    caseStudyId: _caseStudyId,
    clientToken: _clientToken,
    clientUrl: _clientUrl,
    clientNip: _clientNip,
    acceptedByEmail: _acceptedByEmail,
    acceptedByName: _acceptedByName,
    clientComment: _clientComment,
    rejectedByName: _rejectedByName,
    rejectedByEmail: _rejectedByEmail,
    rejectReason: _rejectReason,
    pricingOverride: _pricingOverride,
    ...rest
  } = full;
  const ovExec = full.pricingOverride?.execFee;
  const execFee: ResolvedExecFee = {
    kicker: ovExec?.kicker ?? DEFAULT_EXEC_FEE.kicker,
    title: ovExec?.title ?? DEFAULT_EXEC_FEE.title,
    desc: ovExec?.desc ?? DEFAULT_EXEC_FEE.desc,
    monthly: ovExec?.monthly ?? null,
  };
  return {
    ...rest,
    pricingSnapshot: renderedSnapshot,
    contactPerson: contactPerson ? toContactPersonDto(contactPerson) : null,
    caseStudy: caseStudy ? toCaseStudyDto(caseStudy) : null,
    execFee,
  };
}

export type { OfferRow, OfferInsert };
