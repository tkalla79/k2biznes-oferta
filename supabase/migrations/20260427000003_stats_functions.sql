-- =============================================================================
-- K2Biznes Oferta — migracja 003 — funkcje agregacyjne dla admin dashboard
-- (BACKEND_SPEC.md v1.1.1, sekcja 5.2)
-- =============================================================================
-- Decyzja: SQL functions zamiast widoków, bo:
-- 1. Filtrowanie soft-deleted offers (deleted_at is null) konsystentnie
-- 2. Łatwiejsza zmiana logiki (deploy migracji vs widok)
-- 3. RLS policy `for execute` da się zastosować per-funkcja
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. stats_overview() — pipeline + konwersja + liczby per status
-- -----------------------------------------------------------------------------

create or replace function public.stats_overview()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'counts', (
      select jsonb_object_agg(status, cnt)
      from (
        select status, count(*) as cnt
        from offers
        where deleted_at is null
        group by status
      ) s
    ),
    'totals', jsonb_build_object(
      'all', (select count(*) from offers where deleted_at is null),
      'active', (select count(*) from offers where deleted_at is null and status in ('sent','viewed')),
      'closed_won', (select count(*) from offers where deleted_at is null and status = 'accepted'),
      'closed_lost', (select count(*) from offers where deleted_at is null and status in ('rejected','expired'))
    ),
    'revenue', jsonb_build_object(
      'accepted_fee_total', coalesce((select sum(accepted_fee) from offers where deleted_at is null and status='accepted'), 0),
      'accepted_fee_last_30d', coalesce((select sum(accepted_fee) from offers
        where deleted_at is null and status='accepted' and accepted_at >= now() - interval '30 days'), 0),
      'pipeline_sf_var1_sum', coalesce((select sum(
        coalesce((pricing_snapshot->'variants'->0->>'sfAmount')::numeric, 0)
      ) from offers where deleted_at is null and status in ('sent','viewed')), 0)
    ),
    'conversion', jsonb_build_object(
      'sent_to_viewed', (
        with totals as (
          select
            count(*) filter (where status in ('viewed','accepted','rejected')) as viewed_or_later,
            count(*) filter (where status in ('sent','viewed','accepted','rejected','expired')) as sent_or_later
          from offers where deleted_at is null
        )
        select case when sent_or_later = 0 then 0
          else round(viewed_or_later::numeric / sent_or_later, 4)
        end from totals
      ),
      'viewed_to_accepted', (
        with totals as (
          select
            count(*) filter (where status='accepted') as accepted,
            count(*) filter (where status in ('viewed','accepted','rejected')) as viewed_or_later
          from offers where deleted_at is null
        )
        select case when viewed_or_later = 0 then 0
          else round(accepted::numeric / viewed_or_later, 4)
        end from totals
      )
    ),
    'avg_time_hours', jsonb_build_object(
      'sent_to_viewed', (
        select coalesce(round(avg(extract(epoch from (first_viewed_at - sent_at))/3600)::numeric, 1), 0)
        from offers
        where deleted_at is null and sent_at is not null and first_viewed_at is not null
      ),
      'viewed_to_accepted', (
        select coalesce(round(avg(extract(epoch from (accepted_at - first_viewed_at))/3600)::numeric, 1), 0)
        from offers
        where deleted_at is null and first_viewed_at is not null and accepted_at is not null
      )
    ),
    'computed_at', to_jsonb(now())
  ) into result;
  return result;
end $$;

revoke all on function public.stats_overview() from public;
grant execute on function public.stats_overview() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. stats_by_consultant() — breakdown per konsultant
-- -----------------------------------------------------------------------------

create or replace function public.stats_by_consultant()
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select
      coalesce(o.assigned_consultant_id, o.created_by) as consultant_id,
      p.full_name,
      p.email,
      count(*) as total,
      count(*) filter (where o.status='accepted') as accepted,
      count(*) filter (where o.status='rejected') as rejected,
      count(*) filter (where o.status in ('sent','viewed')) as active,
      coalesce(sum(o.accepted_fee) filter (where o.status='accepted'), 0) as revenue
    from offers o
    left join profiles p on p.id = coalesce(o.assigned_consultant_id, o.created_by)
    where o.deleted_at is null
    group by 1, p.full_name, p.email
    order by total desc
  ) t
$$;

revoke all on function public.stats_by_consultant() from public;
grant execute on function public.stats_by_consultant() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. stats_pipeline_by_month(months_back int) — historyczne accepted per miesiąc
-- używane jako baseline do forecast'u
-- -----------------------------------------------------------------------------

create or replace function public.stats_pipeline_by_month(months_back integer default 12)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(row_to_json(t) order by month_start), '[]'::jsonb)
  from (
    select
      to_char(date_trunc('month', accepted_at), 'YYYY-MM') as month_start,
      count(*) as accepted,
      coalesce(sum(accepted_fee), 0) as revenue
    from offers
    where deleted_at is null
      and status = 'accepted'
      and accepted_at >= date_trunc('month', now()) - (months_back || ' months')::interval
    group by 1
  ) t
$$;

revoke all on function public.stats_pipeline_by_month(integer) from public;
grant execute on function public.stats_pipeline_by_month(integer) to authenticated;

-- =============================================================================
-- KONIEC migracji 003
-- =============================================================================
