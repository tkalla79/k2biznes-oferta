/**
 * Loader stats overview + per-consultant breakdown.
 *
 * Wszystkie agregacje są w SQL functions (migracja 003) — tu unwrap jsonb,
 * Zod parse (PR #6 review fix) i typed DTO.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { OverviewStatsSchema, ConsultantStatsArraySchema } from './schemas';
import type { ConsultantStats, OverviewStats } from './types';

export async function fetchOverview(): Promise<OverviewStats> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc('stats_overview');
  if (error) throw new Error(`stats_overview failed: ${error.message}`);
  if (!data) throw new Error('stats_overview returned null');
  // Runtime walidacja przez Zod — chroni przed cichym castem gdy SQL function
  // zmieni kształt po migracji (PR #6 review).
  return OverviewStatsSchema.parse(data);
}

export async function fetchConsultantBreakdown(): Promise<ConsultantStats[]> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc('stats_by_consultant');
  if (error) throw new Error(`stats_by_consultant failed: ${error.message}`);
  return ConsultantStatsArraySchema.parse(data ?? []);
}
