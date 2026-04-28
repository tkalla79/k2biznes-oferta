-- Fix: `stats_pipeline_by_month()` z migracji 002 zwracała pole `month_key`,
-- ale Zod schema (`MonthlyPipelineSchema` w lib/stats/schemas.ts) oczekuje
-- `month_start`. Mismatch -> ZodError przy /admin dashboard load.
--
-- Naprawa: rename pola w SQL na `month_start`. Format zostaje YYYY-MM string —
-- TS forecast.ts używa go jako klucz do wyklucza current partial month.

create or replace function public.stats_pipeline_by_month(months_back integer default 12)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(t) order by month_start), '[]'::jsonb)
    from (
      select
        to_char(date_trunc('month', sent_at), 'YYYY-MM') as month_start,
        count(*) filter (where status='accepted') as accepted,
        coalesce(sum(accepted_fee) filter (where status='accepted'), 0) as revenue
      from offers
      where deleted_at is null
        and sent_at is not null
        and sent_at >= date_trunc('month', now() - make_interval(months => months_back))
      group by 1
    ) t
  );
end $$;
