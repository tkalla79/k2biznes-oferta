/**
 * Zod schemy dla RPC responses (PR #6 review fix).
 *
 * `lib/stats/overview.ts` i `forecast.ts` wcześniej `as unknown as Type` —
 * type cast nie waliduje runtime'u. Jeśli SQL function zmieni kształt
 * (kolejny migracja albo bug), TS uważa że dane są OK i błąd manifestuje się
 * przy property access w komponencie. Teraz parsujemy przez Zod, błąd schematu
 * → ApiError 500 zamiast crash w UI.
 */
import { z } from 'zod';

export const OverviewStatsSchema = z.object({
  counts: z.record(z.string(), z.number()).nullable().transform((v) => v ?? {}),
  totals: z.object({
    all: z.number(),
    active: z.number(),
    closed_won: z.number(),
    closed_lost: z.number(),
  }),
  revenue: z.object({
    accepted_fee_total: z.number(),
    accepted_fee_last_30d: z.number(),
    pipeline_sf_var1_sum: z.number(),
  }),
  conversion: z.object({
    sent_to_viewed: z.number(),
    viewed_to_accepted: z.number(),
  }),
  avg_time_hours: z.object({
    sent_to_viewed: z.number(),
    viewed_to_accepted: z.number(),
  }),
  computed_at: z.string(),
});

export const ConsultantStatsSchema = z.object({
  consultant_id: z.string(),
  full_name: z.string().nullable(),
  email: z.string().nullable(),
  total: z.number(),
  accepted: z.number(),
  rejected: z.number(),
  active: z.number(),
  revenue: z.number(),
});

export const ConsultantStatsArraySchema = z.array(ConsultantStatsSchema);

export const MonthlyPipelineSchema = z.object({
  month_start: z.string(),
  accepted: z.number(),
  revenue: z.number(),
});

export const MonthlyPipelineArraySchema = z.array(MonthlyPipelineSchema);
