-- =============================================================================
-- K2Biznes Oferta — migracja 002 — RLS (BACKEND_SPEC.md v1.1, sekcja 4)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SECURITY DEFINER funkcje pomocnicze (sekcja 4.1, B8)
--    Omijają RLS na profiles → eliminują infinite recursion.
-- -----------------------------------------------------------------------------

-- UWAGA: funkcje są w schemacie `public` (nie `auth`) — schema `auth` jest
-- własnością `supabase_auth_admin` i postgres role nie ma uprawnień CREATE.
create or replace function public.user_role()
returns user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.user_role() in ('admin','super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.user_role() = 'super_admin', false)
$$;

-- `public` to nazwa zarówno schematu jak i ROLE PostgreSQL — używamy
-- `public._fn()` jako odwołania do schematu, ale `revoke ... from public`
-- referuje do roli. Stąd dwa różne znaczenia w jednej linii:
revoke all on function public.user_role(), public.is_admin(), public.is_super_admin() from public;
grant execute on function public.user_role(), public.is_admin(), public.is_super_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. ENABLE RLS na wszystkich tabelach
-- -----------------------------------------------------------------------------

alter table profiles                enable row level security;
alter table programs                enable row level security;
alter table case_studies            enable row level security;
alter table contact_persons         enable row level security;
alter table pricing_segments        enable row level security;
alter table pricing_config          enable row level security;
alter table offers                  enable row level security;
alter table offer_events            enable row level security;
alter table webhook_jobs            enable row level security;
alter table audit_log               enable row level security;
alter table data_deletion_requests  enable row level security;
alter table ip_hash_salts           enable row level security;
alter table gdpr_clauses            enable row level security;

-- -----------------------------------------------------------------------------
-- 3. POLICIES: profiles (sekcja 4.1.1)
-- -----------------------------------------------------------------------------

create policy "own profile read" on profiles
  for select using (auth.uid() = id);

create policy "admin read all profiles" on profiles
  for select using (public.is_admin());

create policy "super_admin update profiles" on profiles
  for update using (public.is_super_admin());

create policy "own profile update" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Trigger: brak self-escalation roli (sekcja 4.1.1)
create or replace function prevent_role_self_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_super_admin() then
    raise exception 'role change forbidden — super_admin only';
  end if;
  return new;
end $$;

create trigger profiles_no_self_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();

-- -----------------------------------------------------------------------------
-- 4. POLICIES: offers (sekcja 4.2)
-- -----------------------------------------------------------------------------

create policy "consultant reads own offers" on offers
  for select using (
    auth.uid() = created_by or auth.uid() = assigned_consultant_id
  );

create policy "admin reads all offers" on offers
  for select using (public.is_admin());

create policy "consultant creates offers" on offers
  for insert with check (auth.uid() = created_by);

create policy "consultant updates own offers" on offers
  for update using (
    auth.uid() = created_by or public.is_admin()
  );

-- Anon (klient z tokenem) idzie przez service role w API — RLS deny-all dla anon.

-- -----------------------------------------------------------------------------
-- 5. POLICIES: offer_events (sekcja 4.3, B9)
-- -----------------------------------------------------------------------------

create policy "insert own events" on offer_events
  for insert with check (
    actor_id = auth.uid()
    and (
      exists (
        select 1 from offers o
        where o.id = offer_events.offer_id
          and (o.created_by = auth.uid() or o.assigned_consultant_id = auth.uid())
      )
      or public.is_admin()
    )
  );

create policy "read events of own offers" on offer_events
  for select using (
    exists (
      select 1 from offers o
      where o.id = offer_events.offer_id
        and (o.created_by = auth.uid() or o.assigned_consultant_id = auth.uid())
    )
    or public.is_admin()
  );

-- -----------------------------------------------------------------------------
-- 6. POLICIES: lookups (programs, case_studies, contact_persons, pricing_*) — sekcja 4.4
-- -----------------------------------------------------------------------------

-- Read: każdy authenticated
create policy "read programs"          on programs          for select using (auth.role() = 'authenticated');
create policy "read case_studies"      on case_studies      for select using (auth.role() = 'authenticated');
create policy "read contact_persons"   on contact_persons   for select using (auth.role() = 'authenticated');
create policy "read pricing_segments"  on pricing_segments  for select using (auth.role() = 'authenticated');
create policy "read pricing_config"    on pricing_config    for select using (auth.role() = 'authenticated');
create policy "read gdpr_clauses"      on gdpr_clauses      for select using (true);  -- klauzule jawne

-- Write: super_admin
create policy "super_admin writes programs"          on programs          for all using (public.is_super_admin());
create policy "super_admin writes case_studies"      on case_studies      for all using (public.is_super_admin());
create policy "super_admin writes contact_persons"   on contact_persons   for all using (public.is_super_admin());
create policy "super_admin writes pricing_segments"  on pricing_segments  for all using (public.is_super_admin());
create policy "super_admin writes pricing_config"    on pricing_config    for all using (public.is_super_admin());
create policy "super_admin writes gdpr_clauses"      on gdpr_clauses      for all using (public.is_super_admin());

-- -----------------------------------------------------------------------------
-- 7. POLICIES: audit_log, webhook_jobs, data_deletion_requests, ip_hash_salts (sekcja 4.5)
--    Zapis: tylko service role (z poziomu API). Odczyt: admin+.
-- -----------------------------------------------------------------------------

create policy "admin reads audit_log"               on audit_log               for select using (public.is_admin());
create policy "admin reads webhook_jobs"            on webhook_jobs            for select using (public.is_admin());
create policy "admin reads data_deletion_requests"  on data_deletion_requests  for select using (public.is_admin());
create policy "super_admin manages deletion"        on data_deletion_requests  for update using (public.is_super_admin());
create policy "super_admin reads ip_hash_salts"     on ip_hash_salts           for select using (public.is_super_admin());

-- =============================================================================
-- KONIEC migracji 002
-- =============================================================================
