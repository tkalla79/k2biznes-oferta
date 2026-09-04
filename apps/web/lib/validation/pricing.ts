/**
 * Zod schematy dla edycji cennika z panelu (`PATCH /api/admin/pricing`).
 *
 * Cennik to dane, nie kod (BACKEND_SPEC 6.1): silnik `calcPricing` czyta
 * `pricing_segments` + `pricing_config` przez `lib/pricing/load.ts`. Dotąd
 * jedyną drogą zmiany stawek był SQL — ten schemat zabezpiecza formularz, żeby
 * z panelu nie dało się zapisać cennika, na którym silnik się wywali.
 */
import { z } from 'zod';

const money = z.number().min(0).max(100_000_000);
const pct = z.number().min(0).max(1);

export const PricingSegmentInput = z.object({
  id: z.string().min(1).max(40),
  label: z.string().min(1).max(120),
  fundingMin: money,
  /** null = brak górnej granicy (ostatni segment). */
  fundingMax: money.nullable(),
  baseFee: money,
  sfVariant1: pct,
  sfVariant2: pct,
  sfVariant3: pct,
  monthlyFee: money,
  displayOrder: z.number().int().min(1).max(99),
});

export const PricingConfigInput = z.object({
  loyaltyDiscount: pct,
  multiDiscount: pct,
  minSfAmount: money,
  minBaseFee: money,
});

export const UpdatePricingInput = z
  .object({
    segments: z.array(PricingSegmentInput).min(1).max(20),
    config: PricingConfigInput,
  })
  .superRefine((v, ctx) => {
    const segments = [...v.segments].sort((a, b) => a.displayOrder - b.displayOrder);

    // Widelki musza pokrywac cala os od zera w gore, bez dziur i bez
    // nakladania sie. `pickSegment` wybiera segment po kwocie dofinansowania,
    // wiec dziura miedzy 1M a 1,2M oznacza oferte, dla ktorej silnik nie ma
    // segmentu i rzuca bledem dopiero przy zapisie oferty.
    if (segments[0].fundingMin !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['segments', 0, 'fundingMin'],
        message: 'Pierwszy segment musi zaczynać się od 0.',
      });
    }

    segments.forEach((s, i) => {
      if (s.fundingMax !== null && s.fundingMax <= s.fundingMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['segments', i, 'fundingMax'],
          message: `Segment "${s.label}": górna granica musi być większa od dolnej.`,
        });
      }
      const next = segments[i + 1];
      if (next) {
        if (s.fundingMax === null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['segments', i, 'fundingMax'],
            message: `Segment "${s.label}": tylko ostatni segment może być bez górnej granicy.`,
          });
        } else if (next.fundingMin !== s.fundingMax) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['segments', i + 1, 'fundingMin'],
            message:
              `Dziura albo nachodzenie widełek: segment "${s.label}" kończy się na ` +
              `${s.fundingMax}, a "${next.label}" zaczyna od ${next.fundingMin}.`,
          });
        }
      }
    });

    const last = segments[segments.length - 1];
    if (last.fundingMax !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['segments', segments.length - 1, 'fundingMax'],
        message: 'Ostatni segment musi być bez górnej granicy (pusta wartość).',
      });
    }

    // Duplikaty id/kolejnosci — bez tego zapis nadpisze jeden wiersz dwa razy.
    const ids = new Set<string>();
    const orders = new Set<number>();
    for (const s of segments) {
      if (ids.has(s.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['segments'],
          message: `Zduplikowany identyfikator segmentu: ${s.id}.`,
        });
      }
      if (orders.has(s.displayOrder)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['segments'],
          message: `Zduplikowana kolejność wyświetlania: ${s.displayOrder}.`,
        });
      }
      ids.add(s.id);
      orders.add(s.displayOrder);
    }
  });

export type PricingSegmentInput = z.infer<typeof PricingSegmentInput>;
export type PricingConfigInput = z.infer<typeof PricingConfigInput>;
export type UpdatePricingInput = z.infer<typeof UpdatePricingInput>;
