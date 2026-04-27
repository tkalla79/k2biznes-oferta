/**
 * Loader stats overview + per-consultant breakdown.
 *
 * Wszystkie agregacje są w SQL functions (migracja 003) — tu tylko unwrap
 * jsonb → typed DTO + walidacja.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { ConsultantStats, OverviewStats } from './types';

export async function fetchOverview(): Promise<OverviewStats> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc('stats_overview');
  if (error) throw new Error(`stats_overview failed: ${error.message}`);
  if (!data) throw new Error('stats_overview returned null');
  return data as unknown as OverviewStats;
}

export async function fetchConsultantBreakdown(): Promise<ConsultantStats[]> {
  const sb = createAdminClient();
  const { data, error } = await sb.rpc('stats_by_consultant');
  if (error) throw new Error(`stats_by_consultant failed: ${error.message}`);
  return (data ?? []) as unknown as ConsultantStats[];
}
