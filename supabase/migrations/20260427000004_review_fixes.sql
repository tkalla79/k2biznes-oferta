-- =============================================================================
-- K2Biznes Oferta — migracja 004 — fixes from code review on PRs #2-#8
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Atomic view counter — fix dla PR #2 race condition
--    (read-then-write w events/route.ts traci inkrementacje przy współbieżności)
-- -----------------------------------------------------------------------------

create or replace function public.bump_offer_view_count(p_offer_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update offers
  set
    view_count = view_count + 1,
    last_viewed_at = now(),
    first_viewed_at = coalesce(first_viewed_at, now()),
    status = case when status = 'sent' then 'viewed'::offer_status else status end
  where id = p_offer_id and deleted_at is null;
$$;

revoke all on function public.bump_offer_view_count(uuid) from public;
grant execute on function public.bump_offer_view_count(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Webhook jobs `claimed_at` — fix dla PR #5 stuck processing
--    Sweep-back jobów których claim'er padł (status='processing' > 10 min)
-- -----------------------------------------------------------------------------

alter table webhook_jobs add column if not exists claimed_at timestamptz;

create index if not exists idx_webhook_jobs_processing
  on webhook_jobs(status, claimed_at)
  where status = 'processing';

-- -----------------------------------------------------------------------------
-- 3. Admin guard dla SECURITY DEFINER stats funkcji — fix dla PR #6
--    Privilege escalation: konsultant przez bezpośredni POST /rest/v1/rpc/...
--    omija requireAdmin() w API. Trzeba check w samej funkcji.
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
  -- B2 fix: privilege escalation check (sekcja 4.4 + code review PR #6)
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

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

create or replace function public.stats_by_consultant()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return (
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
  );
end $$;

create or replace function public.stats_pipeline_by_month(months_back integer default 12)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(row_to_json(t) order by month_start), '[]'::jsonb)
    from (
      select
        to_char(date_trunc('month', accepted_at), 'YYYY-MM') as month_start,
        count(*) as accepted,
        coalesce(sum(accepted_fee), 0) as revenue
      from offers
      where deleted_at is null
        and status = 'accepted'
        and accepted_at >= date_trunc('month', now()) - make_interval(months => months_back)
      group by 1
    ) t
  );
end $$;

-- =============================================================================
-- KONIEC migracji 004
-- =============================================================================
