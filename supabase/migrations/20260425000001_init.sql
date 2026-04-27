-- =============================================================================
-- K2Biznes Oferta — migracja 001 — schema (BACKEND_SPEC.md v1.1, sekcja 3)
-- =============================================================================
-- Kolejność wykonania (sekcja 3.1):
--   1. extensions
--   2. enumy
--   3. funkcje pomocnicze (updated_at trigger)
--   4. tabele lookups: programs, profiles, case_studies, contact_persons,
--      pricing_segments, pricing_config, ip_hash_salts, gdpr_clauses
--   5. tabela offers (FK do lookups)
--   6. tabele zależne: offer_events, webhook_jobs, audit_log,
--      data_deletion_requests
--   7. cykliczne FK przez ALTER TABLE
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. ENUMY
-- -----------------------------------------------------------------------------

create type user_role        as enum ('super_admin', 'admin', 'consultant');
create type offer_status     as enum ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired');
create type pricing_variant  as enum ('I', 'II', 'III', 'IV');
create type event_type       as enum (
  'created', 'updated', 'sent', 'viewed', 'scroll_depth',
  'variant_hovered', 'variant_selected', 'accepted', 'rejected',
  'pdf_downloaded', 'link_shared', 'email_sent'
);
create type webhook_status   as enum ('pending', 'processing', 'sent', 'failed', 'dead');
create type deletion_status  as enum ('requested', 'approved', 'executed', 'rejected');

-- -----------------------------------------------------------------------------
-- 2. FUNKCJE POMOCNICZE
-- -----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. TABELE LOOKUPS (bez zależności od offers)
-- -----------------------------------------------------------------------------

-- 3.1 programs (sekcja 3.2.2)
create table programs (
  id              text primary key,
  group_name      text not null,
  label           text not null,
  description     text,
  is_custom       boolean not null default false,
  display_order   integer not null default 100,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index idx_programs_group on programs(group_name, display_order);

create trigger trg_programs_updated_at
  before update on programs for each row execute function set_updated_at();

-- 3.2 profiles (sekcja 3.2.1)
create table profiles (
  id              uuid primary key references auth.users(id) on delete restrict,  -- B3: restrict zamiast cascade
  email           text not null,
  full_name       text,
  role            user_role not null default 'consultant',
  phone           text,
  photo_url       text,
  job_title       text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);
-- B5: partial unique — pozwala na ponowne użycie emaila po soft-delete
create unique index uq_profiles_email_active on profiles(email) where deleted_at is null;

create trigger trg_profiles_updated_at
  before update on profiles for each row execute function set_updated_at();

-- 3.3 case_studies (sekcja 3.2.5)
create table case_studies (
  id              text primary key,
  client          text not null,
  logo_big        text,
  logo_sm         text,
  tag             text,
  title           text not null,
  paragraph_1     text,
  paragraph_2     text,
  stats           jsonb not null default '[]'::jsonb,
  industries      text[] not null default '{}',
  program_tags    text[] not null default '{}',
  is_active       boolean not null default true,
  display_order   integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_case_studies_updated_at
  before update on case_studies for each row execute function set_updated_at();

-- 3.4 contact_persons (sekcja 3.2.6)
create table contact_persons (
  id              text primary key,
  profile_id      uuid references profiles(id) on delete set null,
  name            text not null,
  role            text not null,
  phone           text,
  email           text,
  photo_url       text,
  is_active       boolean not null default true,
  display_order   integer not null default 100,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- B6: unique na profile_id, mimo że nullable
create unique index uq_contact_persons_profile_id on contact_persons(profile_id) where profile_id is not null;

create trigger trg_contact_persons_updated_at
  before update on contact_persons for each row execute function set_updated_at();

-- 3.5 pricing_segments (sekcja 3.2.7)
create table pricing_segments (
  id                text primary key,
  label             text not null,
  funding_min       numeric(14,2) not null,
  funding_max       numeric(14,2),
  base_fee          numeric(12,2) not null,
  sf_variant_1      numeric(5,4) not null,
  sf_variant_2      numeric(5,4) not null,
  sf_variant_3      numeric(5,4) not null,
  monthly_fee       numeric(10,2) not null,
  display_order     integer not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_pricing_segments_updated_at
  before update on pricing_segments for each row execute function set_updated_at();

-- 3.6 pricing_config (sekcja 3.2.7) — singleton
create table pricing_config (
  id                  text primary key default 'global',
  loyalty_discount    numeric(5,4) not null default 0.20,
  multi_discount      numeric(5,4) not null default 0.20,
  min_sf_amount       numeric(10,2) not null default 35000,
  min_base_fee        numeric(10,2) not null default 6000,
  crm_hubspot_token   text,
  crm_pipedrive_token text,
  crm_enabled_targets text[] not null default '{}',
  updated_at          timestamptz not null default now(),
  constraint pricing_config_single check (id = 'global')
);

create trigger trg_pricing_config_updated_at
  before update on pricing_config for each row execute function set_updated_at();

-- 3.7 ip_hash_salts (sekcja 11.7) — versioning salta dla ip_hash
create table ip_hash_salts (
  version     smallint primary key generated always as identity,
  salt        text not null,
  rotated_at  timestamptz not null default now()
);

-- 3.8 gdpr_clauses (sekcja 11.6) — wersjonowanie klauzul RODO
create table gdpr_clauses (
  version       text primary key,
  text          text not null,
  text_hash     text not null,
  valid_from    timestamptz not null default now(),
  is_current    boolean not null default false
);
create unique index uq_gdpr_clauses_current on gdpr_clauses(is_current) where is_current = true;

-- -----------------------------------------------------------------------------
-- 4. OFFERS (sekcja 3.2.3)
-- -----------------------------------------------------------------------------

create table offers (
  id                          uuid primary key default gen_random_uuid(),
  offer_number                text not null unique,
  -- B2: translate(encode(...,'base64'),'+/=','-_') — Postgres nie ma 'base64url'
  client_token                text not null unique
                              default translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_'),
  status                      offer_status not null default 'draft',

  -- ownership
  created_by                  uuid not null references profiles(id) on delete restrict,
  assigned_consultant_id      uuid references profiles(id) on delete set null,
  contact_person_id           text references contact_persons(id) on delete set null,

  -- client data
  client_name                 text not null,
  client_nip                  text,
  client_industry             text,
  client_company_size         text check (client_company_size in ('micro','small','medium','large')),
  client_voivodeship          text,

  -- program
  program_id                  text references programs(id) on delete set null,
  program_label               text not null,
  program_custom_name         text,

  -- financials
  project_value               numeric(14,2) not null check (project_value > 0),
  funding_rate                numeric(4,3) not null check (funding_rate between 0 and 1),
  returning_client            boolean not null default false,
  project_count               integer not null default 1 check (project_count between 1 and 5),

  -- pricing snapshot (denormalizowane, sekcja 3.2.3)
  pricing_snapshot            jsonb not null,

  -- variant selection
  selected_variant            pricing_variant not null default 'I',
  offered_variants            pricing_variant[] not null default '{I,II,III}'::pricing_variant[],

  -- case study & content
  case_study_id               text references case_studies(id) on delete set null,
  content                     jsonb not null default '{}'::jsonb,

  -- client response
  accepted_variant            pricing_variant,
  accepted_fee                numeric(12,2),
  accepted_by_name            text,
  accepted_by_email           text,
  client_comment              text,
  accepted_at                 timestamptz,
  rejected_at                 timestamptz,

  -- B28: zgoda RODO z wersjonowaniem klauzuli (sekcja 11.6)
  gdpr_clause_version         text references gdpr_clauses(version),
  gdpr_text_hash              text,
  gdpr_accepted_at            timestamptz,

  -- tracking
  sent_at                     timestamptz,
  first_viewed_at             timestamptz,
  last_viewed_at              timestamptz,
  view_count                  integer not null default 0,
  expires_at                  timestamptz,

  -- timestamps
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  deleted_at                  timestamptz
);

create index idx_offers_status         on offers(status) where deleted_at is null;
create index idx_offers_created_by     on offers(created_by);
create index idx_offers_assigned       on offers(assigned_consultant_id);
create index idx_offers_client_token   on offers(client_token);
create index idx_offers_offer_number   on offers(offer_number);
create index idx_offers_created_at     on offers(created_at desc);

create trigger trg_offers_updated_at
  before update on offers for each row execute function set_updated_at();

-- B12: per-miesięczna sekwencja dla offer_number (zamiast count(*))
create or replace function next_offer_number()
returns text language plpgsql as $$
declare
  yyyy_mm text := to_char(now(), 'YYYY/MM');
  seq_name text := 'offer_seq_' || to_char(now(), 'YYYY_MM');
  next_val bigint;
begin
  -- create sequence on demand
  execute format('create sequence if not exists %I', seq_name);
  execute format('select nextval(%L)', seq_name) into next_val;
  return 'K2/' || yyyy_mm || '/' || lpad(next_val::text, 3, '0');
end $$;

-- -----------------------------------------------------------------------------
-- 5. TABELE ZALEŻNE
-- -----------------------------------------------------------------------------

-- 5.1 offer_events (sekcja 3.2.4)
create table offer_events (
  id              uuid primary key default gen_random_uuid(),
  offer_id        uuid not null references offers(id) on delete restrict,  -- B3: restrict (RODO + audit)
  type            event_type not null,
  payload         jsonb not null default '{}'::jsonb,
  actor_id        uuid references profiles(id) on delete set null,
  actor_type      text not null check (actor_type in ('consultant','admin','client','system')),
  ip_hash         text,
  ip_salt_version smallint references ip_hash_salts(version),
  user_agent      text,
  created_at      timestamptz not null default now()
);

create index idx_offer_events_offer_id  on offer_events(offer_id, created_at desc);
create index idx_offer_events_type      on offer_events(type, created_at desc);

-- 5.2 webhook_jobs (sekcja 3.2.8 + 10.4 z idempotency)
create table webhook_jobs (
  id                    uuid primary key default gen_random_uuid(),  -- = idempotency key
  target                text not null,
  event                 text not null,
  url                   text not null,
  payload               jsonb not null,
  headers               jsonb not null default '{}'::jsonb,
  status                webhook_status not null default 'pending',
  attempts              integer not null default 0,
  max_attempts          integer not null default 5,
  next_attempt_at       timestamptz not null default now(),
  last_error            text,
  last_response_status  integer,
  completed_at          timestamptz,
  created_at            timestamptz not null default now()
);

create index idx_webhook_jobs_pending on webhook_jobs(status, next_attempt_at)
  where status in ('pending', 'failed');

-- 5.3 audit_log (sekcja 3.2.9)
create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  actor_id        uuid references profiles(id) on delete set null,
  actor_email     text,
  action          text not null,
  resource_type   text not null,
  resource_id     text not null,
  before          jsonb,
  after           jsonb,
  ip_hash         text,
  created_at      timestamptz not null default now()
);

create index idx_audit_log_resource on audit_log(resource_type, resource_id, created_at desc);
create index idx_audit_log_actor    on audit_log(actor_id, created_at desc);

-- 5.4 data_deletion_requests (sekcja 3.2.10 + 11.9 — audit trail)
create table data_deletion_requests (
  id              uuid primary key default gen_random_uuid(),
  email           text not null,
  reason          text,
  status          deletion_status not null default 'requested',
  requested_at    timestamptz not null default now(),
  reviewed_by     uuid references profiles(id) on delete set null,
  reviewed_at     timestamptz,
  reject_reason   text,
  executed_at     timestamptz,
  executed_by     uuid references profiles(id) on delete set null,
  notes           text
);

create index idx_data_deletion_status on data_deletion_requests(status, requested_at desc);

-- -----------------------------------------------------------------------------
-- 6. TRIGGER: tworzenie profilu po inserts do auth.users (sekcja 7.3)
-- -----------------------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data->>'role')::user_role, 'consultant')
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- KONIEC migracji 001
-- -----------------------------------------------------------------------------
