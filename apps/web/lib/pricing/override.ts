/**
 * Pricing override — recnie nadpisywanie wartosci wariantow + execFee
 * (PR #29 / sekcja 6.5 spec).
 *
 * Use case: konsultant chce zaproponowac klientowi wartosci inne niz auto-calc
 * (np. negocjacje cenowe, oferta strategiczna). Toggle "Reczne" w editorze
 * przelacza tryb. Override jest zapisywany w offers.pricing_override (jsonb).
 *
 * Render: applyOverride() merguje snapshot z override przed wyswietleniem na
 * /o/[token] i w editorze.
 *
 * Toggle z "Reczne" na "Auto-calc" w UI czysci override (PATCH z {} jako
 * pricing_override).
 */
import { z } from 'zod';
import type { PricingResult, PricingVariant, PricingVariantId, PaymentMilestone } from './types';

// =============================================================================
// Zod schema dla offers.pricing_override
// =============================================================================

const PaymentMilestoneSchema = z.object({
  pct: z.number().min(0).max(100),
  when: z.string().min(1).max(120),
});

/** Override per wariant — wszystkie pola opcjonalne. */
const VariantOverrideSchema = z.object({
  base: z.number().min(0).max(10_000_000).optional(),
  sfPct: z.number().min(0).max(1).optional(),
  monthly: z.number().min(0).max(1_000_000).optional(),
  payment: z.array(PaymentMilestoneSchema).max(10).optional(),
});

const ExecFeeOverrideSchema = z.object({
  monthly: z.number().min(0).max(1_000_000).optional(),
  kicker: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  desc: z.string().max(2000).optional(),
});

export const PricingOverrideSchema = z.object({
  variants: z
    .object({
      I: VariantOverrideSchema.nullable().optional(),
      II: VariantOverrideSchema.nullable().optional(),
      III: VariantOverrideSchema.nullable().optional(),
      IV: VariantOverrideSchema.nullable().optional(),
    })
    .optional(),
  execFee: ExecFeeOverrideSchema.optional(),
}).strict();

export type PricingOverride = z.infer<typeof PricingOverrideSchema>;
export type VariantOverride = z.infer<typeof VariantOverrideSchema>;

// =============================================================================
// Merge logic — applyOverride(snapshot, override) -> rendered PricingResult
// =============================================================================

/**
 * Zwraca snapshot z nalozonym override. Jezeli override jest pusty / null,
 * zwraca snapshot bez zmian. Override moze nadpisywac per-wariant
 * (base/sfPct/monthly/payment) i execFee.
 *
 * Total per wariant zawsze przeliczany: total = base + sfAmount.
 * sfAmount = sfPct * funding (gdzie funding pochodzi ze snapshot, nie zmienia
 * sie przez override — bo zalozenia projektu sa odzielnym polem).
 */
export function applyOverride(snapshot: PricingResult, override: PricingOverride | null): PricingResult {
  if (!override || (!override.variants && !override.execFee)) return snapshot;

  const variants: PricingVariant[] = snapshot.variants.map((v) => {
    const ov = override.variants?.[v.id];
    if (!ov) return v;

    const base = ov.base ?? v.base;
    const sfPct = ov.sfPct ?? v.sfPct;
    const monthly = ov.monthly ?? v.monthly;
    const sfAmount = Math.round(snapshot.funding * sfPct);
    const total = base + sfAmount;
    const payment = ov.payment ?? v.payment;

    return {
      ...v,
      base,
      sfPct,
      sfAmount,
      monthly,
      total,
      payment,
    };
  });

  return {
    ...snapshot,
    variants,
  };
}

/**
 * Wyciaga override z offers.pricing_override (jsonb) z bezpieczna walidacja.
 * Bledny format -> zwraca null (zachowanie defensive: wolimy zignorowac
 * override niz crashowac).
 */
export function parsePricingOverride(value: unknown): PricingOverride | null {
  if (!value || typeof value !== 'object') return null;
  const result = PricingOverrideSchema.safeParse(value);
  return result.success ? result.data : null;
}

/**
 * Helper dla UI: zwraca true jezeli override ma jakies sensowne dane.
 * Pusty obiekt {} traktujemy jak brak override (auto-calc mode).
 */
export function hasOverride(override: PricingOverride | null | undefined): boolean {
  if (!override) return false;
  const hasVariants = !!override.variants && Object.values(override.variants).some(
    (v) => v && Object.keys(v).length > 0,
  );
  const hasExec = !!override.execFee && Object.keys(override.execFee).length > 0;
  return hasVariants || hasExec;
}

/** Lista variant IDs, ktore maja override (do pokazywania badge w UI). */
export function getOverriddenVariantIds(override: PricingOverride | null): PricingVariantId[] {
  if (!override?.variants) return [];
  const ids: PricingVariantId[] = [];
  for (const id of ['I', 'II', 'III', 'IV'] as PricingVariantId[]) {
    const v = override.variants[id];
    if (v && Object.keys(v).length > 0) ids.push(id);
  }
  return ids;
}

/** Default payment milestones gdy konsultant tworzy nowy harmonogram. */
export const DEFAULT_PAYMENT_MILESTONES: PaymentMilestone[] = [
  { pct: 50, when: 'po podpisaniu umowy' },
  { pct: 50, when: 'po pozytywnej decyzji o dofinansowaniu' },
];
