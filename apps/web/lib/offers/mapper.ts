/**
 * Mapowanie Supabase row (snake_case) ↔ DTO API (camelCase).
 *
 * Konwencja sekcja 3.1: snake_case w DB, camelCase w TS na granicy API.
 */
import type { Database } from '@k2/database/types';
import type { PricingResult } from '@/lib/pricing';

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
 * Pola, które klient PUBLIC (przez `/o/[token]`) NIE powinien widzieć.
 * Używane przez endpoint `/api/public/offers/:token` w PR #4.
 */
export function toPublicOfferDto(row: OfferRow): Omit<OfferDto, 'createdBy' | 'assignedConsultantId' | 'contactPersonId' | 'clientToken' | 'clientUrl' | 'clientNip'> {
  // Token i pole NIP nie powinny lecieć w widoku publicznym.
  // Szczegóły contact_person/case_study zaciągniemy joinem w PR #4.
  const dto = toOfferDto(row, '');
  const {
    createdBy: _createdBy,
    assignedConsultantId: _assignedConsultantId,
    contactPersonId: _contactPersonId,
    clientToken: _clientToken,
    clientUrl: _clientUrl,
    clientNip: _clientNip,
    ...publicDto
  } = dto;
  return publicDto;
}

export type { OfferRow, OfferInsert };
