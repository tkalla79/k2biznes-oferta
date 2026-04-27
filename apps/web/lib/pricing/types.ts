/**
 * Pricing types — domena (BACKEND_SPEC.md v1.1.1, sekcja 6 + Appendix C).
 *
 * Te typy są lekkie i niezależne od Supabase — engine `calcPricing()` jest
 * pure function, dostaje SEGMENTS + CONFIG jako argumenty. Mapowanie z
 * `Database['public']['Tables']['pricing_segments']['Row']` (camelCase) do
 * tych typów odbywa się w `lib/pricing/load.ts`.
 */

export type PricingVariantId = 'I' | 'II' | 'III' | 'IV';

export type PricingSegment = {
  id: string;
  label: string;
  fundingMin: number;
  fundingMax: number | null; // null = infinity
  baseFee: number;
  sfVariant1: number;
  sfVariant2: number;
  sfVariant3: number;
  monthlyFee: number;
  displayOrder: number;
};

export type PricingConfig = {
  loyaltyDiscount: number; // 0.20 = 20%
  multiDiscount: number;
  minSfAmount: number;
  minBaseFee: number;
};

export type PricingInput = {
  projectValue: number;
  fundingRate: number; // 0..1
  returningClient?: boolean;
  projectCount?: number; // 1..5
};

export type PaymentMilestone = {
  pct: number;
  when: string;
};

export type PricingVariant = {
  id: PricingVariantId;
  name: string;
  tag: string;
  sfPct: number;
  sfAmount: number;
  base: number;
  monthly: number;
  total: number;
  payment: PaymentMilestone[];
};

export type PricingResult = {
  funding: number;
  segment: PricingSegment;
  base: number;
  variants: PricingVariant[];
};
