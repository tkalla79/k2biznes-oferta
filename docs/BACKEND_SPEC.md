# K2Biznes Oferta — Specyfikacja techniczna backendu

> **📌 Single source of truth:** ten plik (`docs/BACKEND_SPEC.md` w repo).
> Kopia robocza zespołu istnieje w OneDrive (`CLAUDE_CODE/OFERTA/BACKEND_SPEC.md`)
> wyłącznie do edycji wspólnej. Po zatwierdzeniu zmian — commit do repo.
> Repo zawsze wygrywa nad OneDrive.

**Wersja:** 1.1.1 · **Data:** 2026-04-26 · **Status:** gotowe do wdrożenia (wymaga uzupełnienia Appendix C przez biznes); migracje zweryfikowane na realnym `supabase db reset`
**Stan startowy:** `OFERTA_INTERAKTYWNA/` (statyczny vanilla-JS template — `index.html` + `js/app.js` + `css/styles.css`); szczegóły w Appendix A.
**Target:** Supabase (Postgres + Auth + Storage + Edge Functions) + Next.js 14 App Router + TypeScript strict + Zod
**Deployment:** Vercel **Pro** (cron co minutę) lub Supabase `pg_cron` + Edge Functions (sekcja 10.4)

---

## 1. Cel i zakres MVP

Aplikacja K2Biznes Oferta to SaaS do wystawiania i obsługi ofert handlowych dla klientów ubiegających się o dotacje (FENG, FEPW, KPO, FELU itd.). Stan startowy to statyczny template `OFERTA_INTERAKTYWNA/` (Appendix A) — budujemy wokół niego pełny backend Next.js + Supabase z autoryzacją, persistence, trackingiem, generowaniem PDF i emailami.

### 1.1 Obszary w MVP

| Obszar | W MVP | Uwagi |
|---|---|---|
| Katalog ofert (CRUD) | ✅ | Tabela `offers` + REST API (sekcja 5) |
| Dopasowanie oferty do profilu (matching) | ✅ | Hybrid: filtry + scoring; opcjonalnie Claude API |
| System użytkowników i logowanie (auth) | ✅ | Supabase Auth, email+hasło + magic link |
| Role: konsultant, admin, super admin, klient (gość z tokenem) | ✅ | Row Level Security |
| Zapisywanie ulubionych / koszyk zainteresowań klienta | ✅ | Po stronie klienta po otwarciu linku |
| Panel admina do zarządzania ofertami | ✅ | Dashboard + symulator + prognoza |
| Analytics / tracking zachowań klienta na ofercie | ✅ | Event log (view, scroll depth, variant hover, accept) |
| Generowanie PDF z oferty | ✅ | Edge Function, Puppeteer/Playwright |
| Integracja z HubSpot / Pipedrive CRM | ✅ | Webhook przy akceptacji oferty |
| Email do konsultanta przy akceptacji | ✅ | Resend (domyślnie) |
| Claude API do matching AI | ✅ | Opcjonalne wzbogacenie wyszukiwania |
| RODO — cookie consent, privacy, retention, prawo do usunięcia | ✅ | Wymagane |
| Płatności / subskrypcje | ❌ | Poza MVP |
| Scraping zewnętrznych baz (PARP, NCBR) | ❌ | Poza MVP — oferty wprowadzane ręcznie lub import CSV |

### 1.2 Kluczowe flow (user stories)

1. **Konsultant** tworzy nową ofertę → wypełnia dane klienta, wybiera program z katalogu, podaje wartość projektu i intensywność dofinansowania → system automatycznie wylicza segment cenowy i 3 warianty (SF%, kwota, miesięczna opłata) → konsultant zapisuje szkic.
2. Konsultant wysyła ofertę klientowi → system generuje unikalny token dostępu → klient dostaje link `https://app.k2biznes.pl/o/<token>` → status oferty `sent`.
3. **Klient** otwiera link (bez logowania, auth przez token) → frontend rejestruje event `viewed` → status `viewed` → klient przegląda ofertę, porównuje warianty → wybiera wariant → akceptuje (imię, email, komentarz).
4. Przy akceptacji: status `accepted`, email do konsultanta, webhook do CRM, log eventu, opcjonalnie PDF w załączniku.
5. **Admin** w dashboardzie widzi pipeline (wartość SF oczekiwana), konwersję, szkice, ofertę zaakceptowane, ma dostęp do symulatora EV×P i prognozy 12-mies.
6. **Super admin** zarządza katalogiem programów, case studies, osobami kontaktowymi, użytkownikami (rolami).

---

## 2. Stack techniczny

| Warstwa | Technologia | Uzasadnienie |
|---|---|---|
| Frontend | Next.js 14+ App Router, React 18, TypeScript strict | SSR dla SEO ofert, RSC dla admina |
| Styling | Zachowujemy istniejące CSS (`styles-v2.css`, `theme-motion.css`) | Front jest gotowy, nie przepisujemy |
| Backend API | Next.js Route Handlers (`app/api/**/route.ts`) | Prostota, bliskość frontu |
| Baza danych | Supabase Postgres 15 | RLS, realtime, pgvector (jeśli AI matching) |
| Auth | Supabase Auth (email+hasło, magic link, tokeny klienta) | Gotowe, integracja z RLS |
| Storage | Supabase Storage | Załączniki PDF, logo klientów, zdjęcia osób |
| ORM / query | Supabase JS client + typy generowane (`supabase gen types`) | Bez Prismy — mniej warstw |
| Walidacja | Zod na granicy API + formularzach | Single source of truth typów wejścia |
| Email | Resend + React Email | Wygodne templaty JSX |
| PDF | Edge Function + Puppeteer on @sparticuz/chromium (Vercel) | Renderuje `/o/<id>/pdf` → PDF |
| CRM webhook | Retry queue w Supabase (tabela `webhook_jobs` + cron) | Niezależne od dostępności CRM |
| AI matching | Claude API (Haiku 4.5) via server-side wrapper | Opcjonalne wzbogacenie |
| Analytics | Plausible (self-hosted lub cloud) | Bez ciasteczek third-party |
| Monitoring | Sentry | Frontend + backend |
| CI/CD | GitHub Actions → Vercel | Preview per PR |

### 2.1 Struktura katalogów monorepo

```
k2biznes-oferta/
├── apps/
│   └── web/                      # Next.js
│       ├── app/
│       │   ├── (marketing)/      # landing, ppoferta publiczna
│       │   ├── (app)/            # zalogowana część: /admin, /offers
│       │   │   ├── admin/        # dashboard, stats, simulator
│       │   │   └── offers/
│       │   │       ├── new/
│       │   │       └── [id]/
│       │   ├── o/[token]/        # widok klienta (bez logowania)
│       │   └── api/
│       │       ├── offers/
│       │       ├── events/
│       │       ├── pdf/
│       │       ├── match/
│       │       └── webhooks/
│       ├── components/
│       ├── lib/
│       │   ├── supabase/
│       │   ├── pricing.ts        # silnik pricing (sekcja 6 + Appendix C)
│       │   ├── programs.ts       # helpery do `programs` table
│       │   └── validation/       # schematy Zod
│       └── public/
├── packages/
│   ├── database/
│   │   ├── migrations/           # SQL
│   │   ├── seed/
│   │   └── types.ts              # supabase gen types
│   └── email-templates/          # React Email
├── supabase/
│   ├── config.toml
│   ├── functions/                # Edge Functions
│   │   ├── generate-pdf/
│   │   ├── send-offer-accepted/
│   │   └── webhook-crm/
│   └── migrations/
└── docs/
```

---

## 3. Schema bazy danych (PostgreSQL / Supabase)

### 3.1 Konwencje

- Wszystkie tabele: `created_at timestamptz default now()`, `updated_at timestamptz default now()` (trigger auto-update).
- PKI: `id uuid primary key default gen_random_uuid()` — wyjątek: `offers.offer_number text unique` (human-readable).
- Soft delete: `deleted_at timestamptz` zamiast hard delete (RODO + audyt).
- Snake_case w DB, camelCase w TS (mapowanie na granicy).
- Każda tabela ma RLS enabled + policies (sekcja 4).
- **Kolejność tworzenia w migracji `001_init.sql`** (uwaga, w sekcjach 3.2.X tabele opisane są w kolejności logicznej, nie wykonawczej):
  1. `programs`, `case_studies`, `contact_persons`, `pricing_segments`, `pricing_config`, `profiles` (lookups, brak zależności od `offers`).
  2. `offers` — z FK do powyższych.
  3. `offer_events`, `webhook_jobs`, `audit_log`, `data_deletion_requests`.
  Cykliczne FK (`contact_persons.profile_id` ↔ `profiles`) rozwiązuje `ALTER TABLE ADD CONSTRAINT` po wszystkich CREATE.

### 3.2 Tabele

#### 3.2.1 `profiles` (użytkownicy + role)

Rozszerzenie `auth.users` o dane biznesowe. Tworzone triggerem po `auth.users insert`.

```sql
create type user_role as enum ('super_admin', 'admin', 'consultant');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role user_role not null default 'consultant',
  phone text,
  photo_url text,
  job_title text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

**Uwaga:** Klienci, którzy akceptują oferty, NIE są userami w `auth.users` — ich dane (imię, email) są przechowywane bezpośrednio w `offers.accepted_by_name/email`. Dostęp klienta do oferty działa przez losowy `client_token` (sekcja 3.2.3).

#### 3.2.2 `programs` (katalog programów dotacyjnych)

Katalog programów dotacyjnych. Seed minimalny w migracji `seed.sql` (do uzupełnienia przez biznes).

```sql
create table programs (
  id text primary key,                        -- np. "feng-smart"
  group_name text not null,                   -- "FENG · Fundusze Europejskie..."
  label text not null,                        -- "Ścieżka SMART · FENG"
  description text,
  is_custom boolean not null default false,   -- czy to wpis "custom"
  display_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_programs_group on programs(group_name, display_order);
```

#### 3.2.3 `offers` (oferty — core)

Główna tabela ofert.

```sql
create type offer_status as enum ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired');
create type pricing_variant as enum ('I', 'II', 'III', 'IV');

create table offers (
  id uuid primary key default gen_random_uuid(),
  offer_number text not null unique,          -- "K2/2026/04/001"
  client_token text not null unique default translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_'),  -- url-safe base64 (Postgres encode nie ma 'base64url')
  status offer_status not null default 'draft',

  -- OWNERSHIP
  created_by uuid not null references profiles(id),
  assigned_consultant_id uuid references profiles(id),   -- może być inny niż twórca
  contact_person_id uuid references contact_persons(id),

  -- CLIENT DATA
  client_name text not null,
  client_nip text,
  client_industry text,
  client_company_size text,                    -- micro/small/medium/large
  client_voivodeship text,

  -- PROGRAM
  program_id text references programs(id),
  program_label text not null,                 -- denormalizacja — etykieta w momencie utworzenia oferty
  program_custom_name text,                    -- jeśli program=custom

  -- FINANCIALS (wejście do silnika pricing)
  project_value numeric(14,2) not null,        -- netto, w PLN
  funding_rate numeric(4,3) not null,          -- 0.700 = 70%
  returning_client boolean not null default false,
  project_count integer not null default 1 check (project_count between 1 and 5),

  -- PRICING (denormalizowane — snapshot w momencie utworzenia)
  -- Zawiera pełny rezultat calcPricing() dla audytu
  pricing_snapshot jsonb not null,             -- {funding, segment:{...}, base, variants:[...]}

  -- VARIANT SELECTION
  selected_variant pricing_variant not null default 'I',   -- wybrany przez konsultanta jako domyślny
  offered_variants pricing_variant[] not null default '{I,II,III}'::pricing_variant[],

  -- CASE STUDY & CONTENT
  case_study_id text references case_studies(id),
  content jsonb not null default '{}',         -- pola edytowalne w ofercie (intro.lead, itp.)

  -- CLIENT RESPONSE
  accepted_variant pricing_variant,
  accepted_fee numeric(12,2),
  accepted_by_name text,
  accepted_by_email text,
  client_comment text,
  accepted_at timestamptz,
  rejected_at timestamptz,

  -- TRACKING
  sent_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  expires_at timestamptz,                       -- opcjonalnie ważność linku

  -- TIMESTAMPS
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_offers_status on offers(status) where deleted_at is null;
create index idx_offers_created_by on offers(created_by);
create index idx_offers_client_token on offers(client_token);
create index idx_offers_offer_number on offers(offer_number);
create index idx_offers_created_at on offers(created_at desc);
```

**Uwaga o `pricing_snapshot`**: backend NIE oblicza pricingu w locie przy każdym odczycie — snapshot jest zamrażany w momencie utworzenia lub edycji przez konsultanta. Dzięki temu oferta wysłana klientowi zawsze pokazuje dokładnie to samo, nawet jeśli zmienimy model cenowy w przyszłości. Re-kalkulacja tylko na żądanie (endpoint `POST /api/offers/:id/recalculate`).

#### 3.2.4 `offer_events` (tracking aktywności)

Log eventów na ofertach (audit + analytics klienta).

```sql
create type event_type as enum (
  'created', 'updated', 'sent', 'viewed', 'scroll_depth',
  'variant_hovered', 'variant_selected', 'accepted', 'rejected',
  'pdf_downloaded', 'link_shared', 'email_sent'
);

create table offer_events (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  type event_type not null,
  payload jsonb not null default '{}',          -- {variant: 'II', scrollDepth: 0.75, userAgent: '...'}
  actor_id uuid references profiles(id),        -- null gdy aktor to klient
  actor_type text not null,                     -- 'consultant' | 'admin' | 'client' | 'system'
  ip_hash text,                                 -- SHA256(ip + salt) — RODO
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_offer_events_offer_id on offer_events(offer_id, created_at desc);
create index idx_offer_events_type on offer_events(type, created_at desc);
```

#### 3.2.5 `case_studies` (biblioteka referencji)

Biblioteka case studies (referencji). Seed minimalny w `seed.sql`.

```sql
create table case_studies (
  id text primary key,                         -- np. "zugil-smart"
  client text not null,
  logo_big text,
  logo_sm text,
  tag text,                                    -- "FENG · Ścieżka SMART"
  title text not null,
  paragraph_1 text,
  paragraph_2 text,
  stats jsonb not null default '[]',           -- [{n:"0 pkt", l:"..."}]
  industries text[] not null default '{}',
  program_tags text[] not null default '{}',
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### 3.2.6 `contact_persons` (osoby kontaktowe w ofertach)

Lista osób kontaktowych podpinanych pod ofertę. NIE są to `profiles` — to katalog osób, które klient widzi w ofercie. Zwykle 1:1 z `profiles` (`profile_id` unique), ale nie zawsze (np. konsultant zewnętrzny).

```sql
create table contact_persons (
  id text primary key,                         -- "tomasz-kalla"
  profile_id uuid references profiles(id),     -- opcjonalny link do konta
  name text not null,
  role text not null,
  phone text,
  email text,
  photo_url text,
  is_active boolean not null default true,
  display_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

#### 3.2.7 `pricing_segments` (konfigurowalny model cenowy)

Konfigurowalny model cenowy w bazie — super admin może edytować bez deploya. Pełna tabela seedów w Appendix C.

```sql
create table pricing_segments (
  id text primary key,                         -- "s500k"
  label text not null,
  funding_min numeric(14,2) not null,
  funding_max numeric(14,2),                   -- null = infinity
  base_fee numeric(12,2) not null,
  sf_variant_1 numeric(5,4) not null,          -- 0.0500 = 5%
  sf_variant_2 numeric(5,4) not null,
  sf_variant_3 numeric(5,4) not null,
  monthly_fee numeric(10,2) not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pricing_config (
  id text primary key default 'global',        -- zawsze jeden wiersz
  loyalty_discount numeric(5,4) not null default 0.20,
  multi_discount numeric(5,4) not null default 0.20,
  min_sf_amount numeric(10,2) not null default 35000,
  min_base_fee numeric(10,2) not null default 6000,
  updated_at timestamptz not null default now(),
  constraint pricing_config_single check (id = 'global')
);
```

#### 3.2.8 `webhook_jobs` (kolejka retry dla CRM)

```sql
create type webhook_status as enum ('pending', 'processing', 'sent', 'failed', 'dead');

create table webhook_jobs (
  id uuid primary key default gen_random_uuid(),
  target text not null,                        -- 'hubspot' | 'pipedrive' | 'custom'
  event text not null,                         -- 'offer.accepted', 'offer.sent', ...
  url text not null,
  payload jsonb not null,
  headers jsonb not null default '{}',
  status webhook_status not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  last_response_status integer,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
-- id służy jednocześnie jako idempotency_key (wysyłany w header X-K2-Idempotency-Key)

create index idx_webhook_jobs_pending on webhook_jobs(status, next_attempt_at)
  where status in ('pending', 'failed');
```

#### 3.2.9 `audit_log` (audyt dla RODO + compliance)

```sql
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  actor_email text,
  action text not null,                        -- 'offer.update', 'profile.delete'
  resource_type text not null,
  resource_id text not null,
  before jsonb,
  after jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index idx_audit_log_resource on audit_log(resource_type, resource_id, created_at desc);
```

#### 3.2.10 `data_deletion_requests` (RODO — prawo do usunięcia)

```sql
create type deletion_status as enum ('requested', 'approved', 'executed', 'rejected');

create table data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  reason text,
  status deletion_status not null default 'requested',
  requested_at timestamptz not null default now(),
  executed_at timestamptz,
  executed_by uuid references profiles(id),
  notes text
);
```

### 3.3 Diagram (tekstowy ERD)

```
auth.users ──1:1── profiles ──1:N── offers ──1:N── offer_events
                      │                 │
                      │                 ├── programs (N:1)
                      │                 ├── case_studies (N:1)
                      │                 └── contact_persons (N:1)
                      │
                      └── contact_persons (0:1 link)

pricing_segments + pricing_config ──(referenced by offer pricing_snapshot)

webhook_jobs (standalone queue)
audit_log (cross-cutting)
data_deletion_requests (RODO)
```

### 3.4 Seed data

Migracja `seed.sql` ładuje:
- `pricing_segments` — 5 segmentów (Appendix C, do uzupełnienia przez biznes).
- `pricing_config` — defaults (20%, 20%, 35k, 6k).
- `programs` — minimalny seed startowy (do rozbudowy z aplikacji); biznes dostarcza pełną listę.
- `case_studies` — minimalny seed (1 — `zugil-smart` z `OFERTA_INTERAKTYWNA/`); reszta przez admin UI.
- `contact_persons` — 1 wpis (`tomasz-kalla` z `OFERTA_INTERAKTYWNA/`); reszta przez admin UI.
- `profiles` — 1 super admin (email ze zmiennej środowiskowej).
- `offers` — 9 demo ofert (tylko w `dev` i `staging`, nie w `prod`).

---

## 4. Row Level Security (RLS)

Wszystkie tabele mają `alter table X enable row level security;`. Polityki:

### 4.1 Funkcje pomocnicze (omijają rekurencję RLS)

`SELECT` z `profiles` wewnątrz policy na samej tabeli `profiles` powoduje `42P17 infinite recursion detected`. Rozwiązanie: `security definer` wrappery, które omijają RLS.

> **Schema `public`, nie `auth`.** Schemat `auth` w Supabase jest własnością roli `supabase_auth_admin` — postgres nie ma uprawnień `CREATE` w nim, migracja by się wywaliła z `permission denied for schema auth (SQLSTATE 42501)`. Funkcje trzymamy w `public.*`. Zweryfikowane na realnym `supabase db reset`.

```sql
-- Czyta rolę użytkownika z bypass RLS
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

-- Uwaga: `public` w `revoke ... from public` to nazwa ROLE (każdy zalogowany),
-- a `public.user_role()` to schemat. Identyczna nazwa, różne znaczenia.
revoke all on function public.user_role(), public.is_admin(), public.is_super_admin() from public;
grant execute on function public.user_role(), public.is_admin(), public.is_super_admin() to authenticated;
```

**Alternatywa (preferowana w produkcji):** propaguj rolę do `auth.users.raw_app_meta_data` i czytaj `auth.jwt() ->> 'role'`. Zaleta: zero zapytań do DB w policy. Wada: claim stale po promocji roli (sekcja 7.5 — invalidacja sesji).

### 4.1.1 `profiles`

```sql
-- Każdy zalogowany może czytać swój profil
create policy "own profile read" on profiles
  for select using (auth.uid() = id);

-- Admin i super_admin widzą wszystkie profile (bez rekurencji — przez SECURITY DEFINER)
create policy "admin read all profiles" on profiles
  for select using (public.is_admin());

-- Tylko super_admin może zmieniać role
create policy "super_admin modify profiles" on profiles
  for update using (public.is_super_admin());

-- Własny profil — edycja pól niezwiązanych z rolą (rola sprawdzana w aplikacji + audit_log)
create policy "own profile update" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Trigger broniący samodzielnej eskalacji roli
create or replace function prevent_role_self_escalation()
returns trigger language plpgsql as $$
begin
  if new.role <> old.role and not public.is_super_admin() then
    raise exception 'role change forbidden — super_admin only';
  end if;
  return new;
end $$;

create trigger profiles_no_self_escalation
  before update on profiles
  for each row execute function prevent_role_self_escalation();
```

### 4.2 `offers`

```sql
-- Konsultant widzi swoje oferty
create policy "consultant reads own offers" on offers
  for select using (
    auth.uid() = created_by or auth.uid() = assigned_consultant_id
  );

-- Admin/super_admin widzą wszystkie
create policy "admin reads all offers" on offers
  for select using (public.is_admin());

-- Konsultant tworzy własne oferty
create policy "consultant creates offers" on offers
  for insert with check (auth.uid() = created_by);

-- Konsultant edytuje swoje, admin edytuje wszystkie
create policy "consultant updates own offers" on offers
  for update using (auth.uid() = created_by or public.is_admin());

-- Soft delete tylko admin (egzekwowane też w API: PATCH ustawia deleted_at)
create policy "admin soft deletes offers" on offers
  for update using (public.is_admin());
```

**Dostęp klienta do oferty** NIE idzie przez RLS — klient nie jest zalogowany. Endpoint `GET /api/public/offers/:token` używa **service role key** (po stronie serwera) i sam weryfikuje token. RLS pozostaje ścianą dla zwykłego klienta `anon`.

### 4.3 `offer_events`

**Decyzja architektoniczna (sekcja 5.1):** wszystkie endpointy `/api/public/*` używają **service role** w server-side handlerze. RLS dla anon = deny all. Insert eventów klienta przechodzi przez API, nie wprost z przeglądarki.

```sql
-- Insert: tylko authenticated, na ofertach do których ma dostęp + zgodny actor_id
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
-- Anon (klient) inserty idą przez service_role w API — RLS nie obowiązuje.

-- Select: konsultant widzi eventy swoich ofert, admin wszystkie
create policy "read events of own offers" on offer_events
  for select using (
    exists (
      select 1 from offers o
      where o.id = offer_events.offer_id
        and (o.created_by = auth.uid() or o.assigned_consultant_id = auth.uid())
    )
    or public.is_admin()
  );
```

### 4.4 Tabele słownikowe (`programs`, `case_studies`, `contact_persons`, `pricing_*`)

```sql
-- Read: każdy authenticated
create policy "read lookups" on programs for select using (auth.role() = 'authenticated');
-- Write: tylko super_admin
create policy "super_admin writes programs" on programs
  for all using (public.is_super_admin());
-- (analogicznie dla case_studies, contact_persons, pricing_segments, pricing_config)
```

### 4.5 `audit_log`, `webhook_jobs`, `data_deletion_requests`

Zapis tylko z service role (via Edge Functions). Odczyt: admin i super_admin.

---

## 5. API — kontrakty REST

### 5.1 Konwencje

- **Base URL:** `https://app.k2biznes.pl/api`
- **Auth:** Bearer token z Supabase Auth (cookie `sb-*` dla SSR, header `Authorization: Bearer <jwt>` dla klienta)
- **Content-Type:** `application/json; charset=utf-8`
- **Error format:**
  ```json
  {
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Nieprawidłowe dane wejściowe.",
      "details": {
        "issues": [
          { "path": ["projectValue"], "code": "too_small", "message": "Number must be greater than 0" },
          { "path": ["clientNip"],    "code": "invalid_string", "message": "NIP musi mieć 10 cyfr" }
        ]
      }
    }
  }
  ```
  Mapowanie `ZodError → details.issues`:
  ```typescript
  // apps/web/lib/validation/zodError.ts
  import { ZodError } from 'zod';
  export const toApiError = (e: ZodError) => ({
    code: 'VALIDATION_ERROR',
    message: 'Nieprawidłowe dane wejściowe.',
    details: { issues: e.issues.map(i => ({ path: i.path, code: i.code, message: i.message })) },
  });
  ```
  Inne kody błędów (sekcja 13) używają `details: { field, value }` lub `details: {}`.
- **Paginacja:** `?page=1&pageSize=50` → `{data: [...], pagination: {page, pageSize, total, hasMore}}`.
- **Sortowanie:** `?sort=createdAt:desc,clientName:asc`
- **Filtry listowe:** **CSV** w pojedynczym parametrze: `?status=draft,sent`. Parser Zod: `z.string().transform(s => s.split(',') as Status[])`. Multi-param (`?status=draft&status=sent`) NIE jest wspierany — upraszcza cache key i logging.
- **Rate limit:** sekcja 5.1.1.
- **Wersjonowanie:** na razie `v1` implicit (bez prefixu); przy breaking change → `/api/v2/`.

### 5.1.1 Rate limiting

Implementacja: [Upstash Redis](https://upstash.com/) + `@upstash/ratelimit` w Next.js Middleware.

```typescript
// apps/web/middleware.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();   // RATE_LIMIT_REDIS_URL + _TOKEN
const limiters = {
  public: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(100, '60 s'), prefix: 'rl:pub' }),
  auth:   new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(1000,'60 s'), prefix: 'rl:auth' }),
};

export async function middleware(req) {
  const isPublic = req.nextUrl.pathname.startsWith('/api/public/');
  const key = isPublic ? `ip:${req.ip}` : `user:${req.headers.get('x-user-id') ?? req.ip}`;
  const limiter = isPublic ? limiters.public : limiters.auth;
  const { success, remaining, reset } = await limiter.limit(key);
  if (!success) return NextResponse.json(
    { error: { code: 'RATE_LIMITED', message: 'Zbyt wiele żądań.' } },
    { status: 429, headers: { 'Retry-After': String(reset - Date.now()/1000 | 0) } }
  );
  // ... reszta middleware (auth)
}
```

Ścieżki z `__pdfBypass` (sekcja 9.1.1) omijają oba limity.

### 5.2 Mapa endpointów

```
PUBLIC (no auth, token-based)
  GET    /api/public/offers/:token           – oferta w trybie klienta
  POST   /api/public/offers/:token/events    – log event (viewed, scroll, hover)
  POST   /api/public/offers/:token/accept    – akceptacja wariantu
  POST   /api/public/offers/:token/reject    – odrzucenie
  GET    /api/public/offers/:token/pdf       – pobranie PDF

AUTH
  POST   /api/auth/signup                    – proxy do Supabase (ograniczone do zaproszonych)
  POST   /api/auth/signin
  POST   /api/auth/signout
  POST   /api/auth/magic-link
  POST   /api/auth/request-data-deletion     – RODO

OFFERS (consultant+)
  GET    /api/offers                          – lista z filtrami + paginacją
  POST   /api/offers                          – utwórz
  GET    /api/offers/:id                      – szczegóły
  PATCH  /api/offers/:id                      – edycja
  DELETE /api/offers/:id                      – soft delete (admin+)
  POST   /api/offers/:id/send                 – wyślij do klienta (mail)
  POST   /api/offers/:id/duplicate            – klon
  POST   /api/offers/:id/recalculate          – przelicz pricing_snapshot
  GET    /api/offers/:id/events               – historia eventów
  GET    /api/offers/:id/client-url           – wygeneruj/pokaż link dla klienta

DASHBOARD / STATS (admin+)
  GET    /api/stats/overview                  – Pipeline, konwersja, liczby
  GET    /api/stats/forecast                  – 12-mies. prognoza
  POST   /api/simulator/pricing               – kalkulacja EV/break-even

LOOKUPS (auth)
  GET    /api/programs
  GET    /api/case-studies
  GET    /api/contact-persons
  GET    /api/pricing/segments

MATCHING
  POST   /api/match                           – dopasuj oferty do profilu klienta

ADMIN
  POST   /api/admin/programs                  – CRUD dla programów (super_admin)
  POST   /api/admin/users/invite              – zaproś użytkownika
  PATCH  /api/admin/users/:id/role            – zmień rolę
  GET    /api/admin/audit-log

WEBHOOKS (wewnętrzne, wywoływane przez cron)
  POST   /api/internal/process-webhook-jobs
```

### 5.3 Szczegóły kluczowych endpointów

#### `POST /api/offers`

**Auth:** konsultant, admin, super_admin.

**Request body (Zod schema):**
```typescript
const CreateOfferInput = z.object({
  clientName: z.string().min(1).max(200),
  clientNip: z.string().regex(/^\d{10}$/).optional(),
  clientIndustry: z.string().optional(),
  clientCompanySize: z.enum(['micro','small','medium','large']).optional(),
  clientVoivodeship: z.string().optional(),

  programId: z.string().optional(),                 // z katalogu
  programLabel: z.string().min(1),                  // zawsze wymagane
  programCustomName: z.string().optional(),

  projectValue: z.number().positive().max(1_000_000_000),
  fundingRate: z.number().min(0.1).max(0.95),
  returningClient: z.boolean().default(false),
  projectCount: z.number().int().min(1).max(5).default(1),

  selectedVariant: z.enum(['I','II','III','IV']).default('I'),
  offeredVariants: z.array(z.enum(['I','II','III','IV'])).default(['I','II','III']),

  caseStudyId: z.string().optional(),
  contactPersonId: z.string().optional(),
  assignedConsultantId: z.string().uuid().optional(),

  content: z.record(z.any()).default({}),
});
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "offerNumber": "K2/2026/04/012",
    "clientToken": "base64url-24",
    "status": "draft",
    "clientUrl": "https://app.k2biznes.pl/o/base64url-24",
    "createdAt": "2026-04-24T12:34:56Z",
    "pricingSnapshot": {
      "funding": 2800000,
      "segment": {"id": "s5m", "label": "2M – 5M (SMART MŚP)"},
      "base": 15000,
      "variants": [
        {"id":"I","name":"Wariant I","tag":"Szybka płatność","sfPct":0.045,"sfAmount":126000,"base":15000,"monthly":4000,"total":141000,"payment":[...]},
        {"id":"II",...},
        {"id":"III",...}
      ]
    },
    ...
  }
}
```

**Server logic:**
1. Zod validate.
2. Generuj `offerNumber` (transakcyjnie — `select count(*) from offers where offer_number like 'K2/2026/04/%'`).
3. Wylicz `pricingSnapshot` przez `lib/pricing.ts` (sekcja 6).
4. Insert do `offers` z `created_by = auth.uid()`.
5. Insert do `offer_events` (`type = 'created'`, `actor_type = 'consultant'`).
6. Insert do `audit_log`.
7. Zwróć utworzoną ofertę + `clientUrl`.

#### `POST /api/offers/:id/send`

**Auth:** konsultant (tylko swoje), admin+.

**Request body:**
```typescript
{
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  subject: z.string().optional(),     // default: template
  message: z.string().optional(),     // custom wiadomość konsultanta
  expiresAt: z.string().datetime().optional(),
}
```

**Response 200:** zaktualizowana oferta (`status = 'sent'`, `sentAt`).

**Server logic:**
1. Verify RLS (konsultant tylko swoje).
2. Walidacja: `status in ('draft', 'sent')`.
3. Update offer (`status = 'sent'`, `sent_at = now()`, `expires_at` jeśli podane).
4. Resend: send email (template `OfferSentToClient`) z linkiem `https://app.k2biznes.pl/o/<client_token>`.
5. Event log `sent`.
6. (Opcjonalnie) CRM webhook job `offer.sent`.

#### `GET /api/public/offers/:token`

**Auth:** brak (publiczny).

**Server logic:**
1. `select * from offers where client_token = :token and deleted_at is null limit 1` (via service role).
2. Check `expires_at > now()` → jeśli przekroczone: 410 GONE.
3. Nagłówek `Cache-Control: no-store`.
4. Odrzuć pola wrażliwe (`createdBy` jako profile → tylko `displayName`, bez email wewnętrznego).
5. (Event `viewed` leci przez oddzielny endpoint — bo GET powinien być idempotentny).

**Response 200:**
```json
{
  "data": {
    "offerNumber": "K2/2026/04/012",
    "status": "sent",
    "clientName": "Aqustec Sp. z o.o.",
    "programLabel": "FEPW · Wzornictwo w MŚP",
    "projectValue": 600000,
    "fundingRate": 0.70,
    "pricingSnapshot": { ... },
    "offeredVariants": ["I","II","III"],
    "caseStudy": { ...embedded },
    "contactPerson": { ...embedded },
    "content": { "intro.lead": "...", ... },
    "expiresAt": "2026-05-24T00:00:00Z"
  }
}
```

#### `POST /api/public/offers/:token/events`

**Auth:** brak.

**Request body:**
```typescript
{
  type: z.enum(['viewed','scroll_depth','variant_hovered','pdf_downloaded']),
  payload: z.record(z.any()).default({}),
}
```

**Server logic:**
1. Znajdź ofertę po tokenie.
2. Dedup dla `viewed` (max 1 event `viewed` na sesję — `first_viewed_at` jeśli null, bump `view_count` + `last_viewed_at`).
3. `ip_hash = sha256(ip + salt)` — RODO.
4. Jeśli status `sent` + type `viewed` → update status `viewed` + event `email_sent` jeśli konfigurowane.

#### `POST /api/public/offers/:token/accept`

**Request body:**
```typescript
{
  selectedVariant: z.enum(['I','II','III','IV']),
  clientName: z.string().min(1),
  clientEmail: z.string().email(),
  comment: z.string().max(2000).optional(),
  acceptedGdpr: z.literal(true),         // wymagana zgoda
}
```

**Response 200:** `{ data: { success: true, offerNumber, variant, acceptedAt } }`.

**Server logic (transakcja):**
1. Verify offer token + status in (`sent`,`viewed`).
2. Verify `selectedVariant in offeredVariants`.
3. Compute `acceptedFee` z `pricing_snapshot.variants[selectedVariant].sfAmount`.
4. Update offer (`status = 'accepted'`, `accepted_*`).
5. Insert event `accepted`.
6. Enqueue email do `assigned_consultant_id` + `contact_person`.
7. Enqueue webhook CRM (`webhook_jobs`).
8. Opcjonalnie: enqueue PDF generation + email attachment.

#### `POST /api/match`

**Auth:** konsultant+.

**Request body:**
```typescript
{
  industry: z.string().optional(),
  companySize: z.enum(['micro','small','medium','large']).optional(),
  voivodeship: z.string().optional(),
  projectType: z.enum(['br','investment','digital','design','oze','goz']).optional(),
  projectValueMin: z.number().optional(),
  projectValueMax: z.number().optional(),
  freeText: z.string().optional(),      // dla Claude AI
  useAi: z.boolean().default(false),
}
```

**Response 200:**
```json
{
  "data": {
    "matches": [
      {
        "programId": "feng-smart",
        "programLabel": "Ścieżka SMART · FENG",
        "score": 92,
        "reasons": ["B+R", "MŚP", "Branża produkcyjna"],
        "caseStudyId": "zugil-smart"
      }
    ],
    "aiExplanation": "..."    // gdy useAi=true
  }
}
```

**Server logic:**
1. Filtr rule-based (kryteria twarde).
2. Scoring (waga branży, wielkości, regionu, wartości).
3. Jeśli `useAi`, wyślij do Claude Haiku z top-10 programów i `freeText` → LLM ranking + uzasadnienie.

---

## 6. Silnik pricing

Plik `apps/web/lib/pricing.ts`. Wzory bazują na docelowym modelu biznesowym K2 (segmenty + loyalty/multi discount + floor). Wartości segmentów: Appendix C.

```typescript
// lib/pricing.ts
import type { PricingSegment, PricingConfig } from '@/lib/types';

export type PricingInput = {
  projectValue: number;
  fundingRate: number;
  returningClient?: boolean;
  projectCount?: number;
};

export type PricingVariant = {
  id: 'I' | 'II' | 'III' | 'IV';
  name: string;
  tag: string;
  sfPct: number;
  sfAmount: number;
  base: number;
  monthly: number;
  total: number;
  payment: Array<{ pct: number; when: string }>;
};

export type PricingResult = {
  funding: number;
  segment: PricingSegment;
  base: number;
  variants: PricingVariant[];
};

export function calcPricing(
  input: PricingInput,
  segments: PricingSegment[],
  config: PricingConfig
): PricingResult {
  const { projectValue, fundingRate, returningClient = false, projectCount = 1 } = input;
  const funding = projectValue * fundingRate;
  const segment = pickSegment(funding, segments);

  let base = segment.baseFee;
  if (returningClient) base *= 1 - config.loyaltyDiscount;
  if (projectCount > 1) base *= 1 - config.multiDiscount * (projectCount - 1);
  base = Math.max(config.minBaseFee, Math.round(base / 100) * 100);

  const variants: PricingVariant[] = [
    { id: 'I', name: 'Wariant I', tag: 'Szybka płatność', sfPct: segment.sfVariant1, base, monthly: segment.monthlyFee,
      payment: [{ pct: 50, when: 'po ogłoszeniu wyników' }, { pct: 50, when: 'po podpisaniu umowy' }],
      sfAmount: 0, total: 0 },
    { id: 'II', name: 'Wariant II', tag: 'Rozłożony SF', sfPct: segment.sfVariant2, base, monthly: segment.monthlyFee,
      payment: [{ pct: 50, when: 'po ogłoszeniu wyników' }, { pct: 25, when: 'przy zaliczce / refundacji' }, { pct: 25, when: 'po podpisaniu umowy' }],
      sfAmount: 0, total: 0 },
    { id: 'III', name: 'Wariant III', tag: '12 rat', sfPct: segment.sfVariant3, base, monthly: segment.monthlyFee,
      payment: [{ pct: 25, when: 'po ogłoszeniu wyników' }, { pct: 25, when: 'po podpisaniu umowy' }, { pct: 50, when: 'w 12 ratach po umowie' }],
      sfAmount: 0, total: 0 },
  ].map((v) => {
    const sfAmount = Math.max(config.minSfAmount, funding * v.sfPct);
    return { ...v, sfAmount, total: v.base + sfAmount };
  });

  return { funding, segment, base, variants };
}

export function pickSegment(funding: number, segments: PricingSegment[]): PricingSegment {
  return segments.find((s) => funding >= s.fundingMin && (s.fundingMax == null || funding < s.fundingMax))
    ?? segments[segments.length - 1];
}

export function expectedValue(args: {
  variant: PricingVariant;
  probability: number;
  monthsExec?: number;
}): number {
  const { variant, probability, monthsExec = 18 } = args;
  return variant.base + variant.sfAmount * probability + (variant.monthly ?? 0) * monthsExec * probability;
}
```

### 6.1 Testy jednostkowe (Vitest)

```typescript
describe('calcPricing', () => {
  it('s5m · 4M @ 65% · klient niewracający', () => {
    const r = calcPricing({ projectValue: 4_000_000, fundingRate: 0.65 }, SEGMENTS, CFG);
    expect(r.funding).toBe(2_600_000);
    expect(r.segment.id).toBe('s5m');
    expect(r.base).toBe(15000);
    expect(r.variants[0].sfAmount).toBeCloseTo(117_000, 0);     // 2.6M × 4.5%
    expect(r.variants[0].total).toBe(132_000);
  });
  it('min_sf_amount floor', () => {
    const r = calcPricing({ projectValue: 300_000, fundingRate: 0.6 }, SEGMENTS, CFG);
    expect(r.variants[0].sfAmount).toBe(35000);                  // floor
  });
  it('loyalty discount', () => {
    const base = calcPricing({ projectValue: 2_000_000, fundingRate: 0.65 }, SEGMENTS, CFG).base;
    const loyal = calcPricing({ projectValue: 2_000_000, fundingRate: 0.65, returningClient: true }, SEGMENTS, CFG).base;
    expect(loyal).toBe(base * 0.8);
  });
});
```

---

## 7. Auth flow (Supabase)

### 7.1 Tożsamości

- **Konsultant / Admin / Super admin:** Supabase Auth (email+hasło lub magic link). Rejestracja tylko przez zaproszenie (super admin wysyła invite).
- **Klient końcowy:** NIE ma konta. Dostęp do oferty po `client_token` w URL. Akceptacja wymaga podania imienia + emaila + zgody RODO — dane zapisane bezpośrednio na ofercie, nie w `auth.users`.

### 7.2 Sign-in flow

1. `POST /api/auth/signin` → `supabase.auth.signInWithPassword`.
2. Supabase ustawia cookie `sb-access-token`, `sb-refresh-token` (HTTP-only, Secure, SameSite=Lax).
3. Middleware Next.js (`middleware.ts`) sprawdza JWT przy każdym request do `/app/*` i `/api/*` (poza `/api/public/*`).
4. Role JWT: claim `role` w `raw_app_meta_data` — trigger przy insert do `profiles` propaguje.

### 7.3 Invite flow (super admin → nowy konsultant)

```
1. Super admin: POST /api/admin/users/invite { email, role, fullName }
2. Backend: supabase.auth.admin.inviteUserByEmail(email)
3. Supabase wysyła email z magic link
4. Trigger po inserts do auth.users → tworzy wiersz w profiles z role='consultant'
5. Po pierwszym logowaniu user ustawia hasło
```

### 7.4 Client token flow

```
1. Konsultant: POST /api/offers/:id/send { recipientEmail }
2. Backend: generuje (lub zwraca istniejący) client_token, update offer, wysyła mail
3. Klient klika link → Next.js /o/[token]/page.tsx
4. Server component: fetch /api/public/offers/:token (z cookie? nie — używamy service role)
5. Render strony bez layoutu zalogowanego
6. Klient → akceptuje → POST /api/public/offers/:token/accept
```

**Uwaga bezpieczeństwa:** `client_token` to 24-byte random (192 bity entropii) → nieprzewidywalny. Nie loguj do Sentry w URL. Link wygasa wg `expires_at`.

### 7.5 Propagacja roli do JWT + invalidacja sesji

JWT w Supabase zawiera claim `role` z `auth.users.raw_app_meta_data`. Domyślnie claim jest stale po `UPDATE profiles.role` aż do refresh tokenu / relogin. Procedura zmiany roli:

```typescript
// apps/web/app/api/admin/users/[id]/role/route.ts
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(req, { params }) {
  // 1. RLS: tylko super_admin (sekcja 4.1)
  const admin = createAdminClient();
  const { role } = await req.json();

  // 2. Update profiles
  await admin.from('profiles').update({ role }).eq('id', params.id);

  // 3. Propaguj do auth.users.raw_app_meta_data — claim w nowym JWT
  await admin.auth.admin.updateUserById(params.id, { app_metadata: { role } });

  // 4. Invalidate active sessions
  await admin.auth.admin.signOut(params.id, 'global');

  // 5. Audit log
  await admin.from('audit_log').insert({ action: 'profile.role.update', resource_id: params.id, /* ... */ });

  return Response.json({ ok: true });
}
```

Trigger po `INSERT` do `auth.users` (sekcja 7.3) również wstawia `role` do `raw_app_meta_data`.

### 7.6 MFA + session policy

- **Wymagane MFA (TOTP):** dla ról `admin` i `super_admin`. Egzekwowane w middleware:
  ```typescript
  const aal = session?.user?.factors?.length ? 'aal2' : 'aal1';
  if (['admin','super_admin'].includes(role) && aal !== 'aal2') {
    return NextResponse.redirect('/auth/mfa-setup');
  }
  ```
  Konsultant: opcjonalne.
- **Session max age:** `admin`/`super_admin` 12h; `consultant` 30 dni. Konfiguracja w Supabase → Auth → JWT expiry + refresh token rotation.
- **Bruteforce protection:** Supabase ma wbudowaną ochronę logowania; dodatkowo rate-limit na `/api/auth/signin` (10 req/min per IP).

---

## 8. Email templates (React Email + Resend)

Plik `packages/email-templates/`.

### 8.1 `OfferSentToClient` (konsultant → klient)

- Subject: `Oferta K2Biznes dla {clientName} — {programLabel}`
- Body: Branding K2, krótki opis programu, kwoty, CTA "Zobacz ofertę" → `https://app.k2biznes.pl/o/{token}`, stopka z danymi osoby kontaktowej.

### 8.2 `OfferAcceptedConsultant` (system → konsultant)

- Subject: `✅ Oferta {offerNumber} zaakceptowana — {clientName}, wariant {variant}`
- Body: Tabela z danymi akceptacji, kwota SF, komentarz klienta, link do oferty w adminie.

### 8.3 `OfferRejected` (system → konsultant)

Analogicznie.

### 8.4 `WelcomeNewUser` (system → zaproszony konsultant)

Magic link + krótkie wprowadzenie.

### 8.5 `DataDeletionConfirmation` (RODO)

Po zatwierdzeniu prośby.

---

## 9. PDF generation

### 9.1 Architektura

- Endpoint `GET /api/public/offers/:token/pdf` → zwraca `application/pdf`.
- Implementacja: Supabase Edge Function `generate-pdf` uruchamia headless Chromium (`@sparticuz/chromium` + `playwright-core`).
- Funkcja otwiera `https://app.k2biznes.pl/o/<token>?print=true&__pdfBypass=<HMAC>`, czeka na `networkidle`, wywołuje `page.pdf({format:'A4', printBackground: true})`.
- Cache: gotowy PDF zapisywany w Storage bucket `offer-pdfs/` (private, RLS deny-all dla anon), klucz `{offerNumber}_{pricingSnapshotHash}.pdf`. Następne żądania serwują z Storage przez signed URL (TTL 5 min).
- Invalidacja: trigger po `update offers` jeśli `pricing_snapshot` lub `content` się zmieniły → usuwa stary PDF z bucketu.

### 9.1.1 Auth flow Edge → render route

Edge Function nie posiada cookie ani sesji użytkownika. Aby endpoint `/o/<token>?print=true` mógł:
1. **omijać rate-limit** (`/api/public/*` ma 100 req/min — generowanie PDF idzie poza tę pulę),
2. **rozpoznać request jako "internal trusted"** i serwować print-friendly markup,

stosujemy HMAC bypass:

```
__pdfBypass = base64url( hmac_sha256(PDF_BYPASS_SECRET, "<token>:<unix_ts>") )
+ &__pdfTs=<unix_ts>
```

- `PDF_BYPASS_SECRET` — env var (32 bajty, znana tylko Edge Function i Next.js middleware).
- Middleware `apps/web/middleware.ts`:
  - Jeśli URL ma `__pdfBypass` + `__pdfTs`, weryfikuje HMAC i `|now - ts| < 60s`. Sukces → ustawia `request.headers.set('x-internal-pdf','1')` i pomija rate-limit.
  - Niepowodzenie → `403 INVALID_PDF_BYPASS`.
- Endpoint `/o/[token]/page.tsx` ignoruje param `__pdfBypass` w renderze (nie loguje, nie wysyła w linkach klienckich).

### 9.1.2 `pricingSnapshotHash`

Stabilny SHA-256 hash z **kanonicznego** JSON (klucze posortowane, bez whitespace) z `pricing_snapshot || content`:

```typescript
import { createHash } from 'crypto';
import canonicalize from 'canonicalize'; // RFC 8785 JCS

export function pricingSnapshotHash(snapshot: object, content: object): string {
  const json = canonicalize({ s: snapshot, c: content });
  return createHash('sha256').update(json).digest('hex').slice(0, 16);
}
```

Klucz cache: `${offerNumber}_${pricingSnapshotHash}.pdf`.

### 9.2 Alternatywa (jeśli Chromium na Edge będzie problemem)

Klient-side print via `window.print()` z `@media print` CSS (już działa w obecnym froncie). Backend-side PDF tylko dla wysyłki emailem.

---

## 10. CRM webhooks (HubSpot / Pipedrive)

### 10.1 Config

`pricing_config` extension:
```sql
alter table pricing_config add column crm_hubspot_token text;
alter table pricing_config add column crm_pipedrive_token text;
alter table pricing_config add column crm_enabled_targets text[] default '{}';
```

### 10.2 Trigger events

Webhook enqueuje się w `webhook_jobs` przy:
- `offer.created`
- `offer.sent`
- `offer.viewed` (pierwszy raz)
- `offer.accepted` (main)
- `offer.rejected`

### 10.3 Payload

```json
{
  "idempotencyKey": "wj_01HS9...",
  "event": "offer.accepted",
  "timestamp": "2026-04-25T14:22:00Z",
  "offer": {
    "id": "...",
    "offerNumber": "K2/2026/04/012",
    "clientName": "...",
    "programLabel": "...",
    "projectValue": 4000000,
    "acceptedVariant": "II",
    "acceptedFee": 143000
  },
  "client": {
    "name": "Jan Kowalski",
    "email": "j.kowalski@example.com"
  },
  "consultant": {
    "id": "...",
    "email": "k.buhl@k2biznes.pl"
  }
}
```

Headery wysyłane z requestem:
```
Content-Type: application/json
X-K2-Event: offer.accepted
X-K2-Idempotency-Key: wj_01HS9...        ← = webhook_jobs.id; CRM dedupes po nim
X-K2-Signature: sha256=<hmac(secret, body)>
X-K2-Timestamp: 2026-04-25T14:22:00Z
```

### 10.4 Retry policy

- 5 prób z eksponencjalnym backoffem: **30s, 2min, 10min, 1h, 6h**.
- Po 5 nieudanych → `status = 'dead'`, alert do super admina (email + Sentry).
- `idempotencyKey` (= `webhook_jobs.id`, ULID) gwarantuje, że CRM-y obsługujące idempotency nie utworzą duplikatów przy retry.
- **Cron** `* * * * *` (co minutę) uruchamia `/api/internal/process-webhook-jobs`.

⚠️ **Środowisko:** Vercel Hobby nie wspiera cronu częstszego niż dziennie. Wymagane:
- **Vercel Pro** (cron co minutę), albo
- **Supabase `pg_cron`** + Edge Function (rekomendowane — niezależne od planu Vercela), albo
- **Zewnętrzny scheduler** (Upstash QStash, GitHub Actions cron co 5min jako fallback).

Zalecenie: pg_cron + Edge Function `process-webhook-jobs` w Supabase (i tak mamy SDK).

---

## 11. RODO / Privacy

### 11.1 Cookie consent

Biblioteka: `cookieconsent` lub własny banner (prosty, Accept/Reject).
- Kategorie: `necessary` (zawsze), `analytics` (Plausible — ale Plausible sam jest cookieless, więc w zasadzie zbędne).
- Przechowujemy consent w `localStorage` + audit event.

### 11.2 Privacy policy

Strona `/privacy-policy` — statyczna MDX.

### 11.3 Data retention

- Oferty: retention 7 lat (księgowość).
- `offer_events`: 2 lata, potem anonimizacja (`ip_hash` NULL, `user_agent` NULL).
- Klient który akceptuje: widoczny disclaimer + zgoda checkbox (`acceptedGdpr: true`).
- Cron codziennie: przenosi eventy > 2 lata do archiwum (S3 cold) lub usuwa.

### 11.4 Prawo do usunięcia

Endpoint `POST /api/auth/request-data-deletion` (bez logowania — po podaniu emaila):
1. Utwórz `data_deletion_requests` z `status = 'requested'`.
2. Email z potwierdzeniem + link z tokenem.
3. Super admin zatwierdza w `/admin/gdpr`.
4. Execute: anonimizuj `offers.accepted_by_name/email` → `[RODO usunięto]`, `offer_events.ip_hash/user_agent` → NULL, `profiles.email/full_name` → `deleted-{id}@tombstone`, `is_active = false`.

### 11.5 Export danych (prawo dostępu)

- **Konsultant/admin (`/api/me/export`)** — ZIP z JSON danych usera (profile, oferty utworzone).
- **Klient końcowy** — bez konta, `me` nie istnieje. Endpoint `POST /api/public/offers/:token/export` → wysyła ZIP na `accepted_by_email` (email weryfikowany przez magic link na ten adres).

### 11.6 Zgoda klienta — wersjonowanie klauzuli

Pole `accepted_gdpr` jako boolean nie spełnia art. 7 RODO (dowód zgody). Zapisujemy:

```sql
alter table offers add column gdpr_clause_version text;
alter table offers add column gdpr_text_hash text;        -- sha256 z treści klauzuli
alter table offers add column gdpr_accepted_at timestamptz;
```

W `POST /api/public/offers/:token/accept` (sekcja 5.3) walidacja:
- `acceptedGdpr: z.literal(true)` zostaje, plus
- `gdprClauseVersion: z.string()` (wersja, którą widział klient — wysyłana z frontu),
- backend weryfikuje `version` z aktualnym hashem klauzuli (table `gdpr_clauses(version, text, text_hash, valid_from)`).

### 11.7 Salt versioning dla `ip_hash`

`IP_HASH_SALT` rotujemy co 90 dni; rotacja łamie korelację między starymi a nowymi eventami, więc:

```sql
create table ip_hash_salts (
  version smallint primary key generated always as identity,
  salt text not null,
  rotated_at timestamptz not null default now()
);
alter table offer_events add column ip_salt_version smallint references ip_hash_salts(version);
```

Cron co 90 dni: insert nowego salta, eventy zaczynają używać nowej wersji. Stare eventy zachowują swój `ip_salt_version` — rule investigation działa dla wsadu eventów z tej samej wersji.

### 11.8 Storage life-cycle policy (`offer-pdfs/`)

- Bucket `offer-pdfs` (private). RLS deny all dla anon; access przez signed URL (TTL 5 min) z API.
- Cron codziennie:
  - Usuń obiekty starsze niż 7 lat (kongruencja z retencją ofert).
  - Usuń obiekty osierocone (oferta soft-deleted > 30 dni temu).
- Po `update offers` z zmianą `pricing_snapshot` lub `content` → trigger usuwa PDFy z innym `pricingSnapshotHash`.

### 11.9 Audit trail dla `data_deletion_requests`

```sql
alter table data_deletion_requests add column reviewed_by uuid references profiles(id);
alter table data_deletion_requests add column reviewed_at timestamptz;
alter table data_deletion_requests add column reject_reason text;
-- każde przejście status zapisywane do audit_log (action: 'gdpr.request.{approved|rejected|executed}')
```

---

## 12. Monitoring & observability

### 12.1 Sentry — PII scrubbing

Frontend i backend Sentry **bez `sendDefaultPii`** + `beforeSend` filter:

```typescript
// apps/web/sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

const PII_KEYS = /^(email|client_email|accepted_by_email|client_name|accepted_by_name|client_nip|phone|ip|user_agent)$/i;
const TOKEN_LIKE = /\/o\/[A-Za-z0-9_-]{20,}/g;

function scrub(obj: any, depth = 0): any {
  if (depth > 6 || obj == null) return obj;
  if (typeof obj === 'string') return obj.replace(TOKEN_LIKE, '/o/[REDACTED]');
  if (Array.isArray(obj)) return obj.map(v => scrub(v, depth + 1));
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = PII_KEYS.test(k) ? '[REDACTED]' : scrub(v, depth + 1);
    }
    return out;
  }
  return obj;
}

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.request) {
      delete event.request.cookies;
      event.request.headers = scrub(event.request.headers);
      event.request.data = scrub(event.request.data);
      if (event.request.url) event.request.url = event.request.url.replace(TOKEN_LIKE, '/o/[REDACTED]');
    }
    event.extra = scrub(event.extra);
    event.contexts = scrub(event.contexts);
    return event;
  },
});
```

Server-side identyczny `beforeSend` w `sentry.server.config.ts`.

### 12.2 Plausible / event analytics

Plausible jest cookieless — nie zbieramy IP/UA per-user. `offer_events` (sekcja 3.2.4) trzymamy oddzielnie z `ip_hash` (sekcja 11.7). Dashboardy admin łączą oba źródła read-only.

### 12.3 Healthcheck

`GET /api/health` — public, no auth, sprawdza:
- DB ping (`select 1`),
- Redis ping (rate-limit),
- Storage ping (head bucket).

---

## 13. Zmienne środowiskowe

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # tylko server-side!
SUPABASE_JWT_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://app.k2biznes.pl
IP_HASH_SALT=                       # losowy 32 bajty, do hashowania IP (rotowany; sekcja 11.6)
PDF_BYPASS_SECRET=                  # 32 bajty, HMAC dla Edge → render auth (sekcja 9.1.1)
RATE_LIMIT_REDIS_URL=               # Upstash Redis REST URL (sekcja 5.1.1)
RATE_LIMIT_REDIS_TOKEN=

# Email
RESEND_API_KEY=
EMAIL_FROM="K2Biznes <oferty@k2biznes.pl>"
EMAIL_REPLY_TO="kontakt@k2biznes.pl"

# AI (opcjonalne)
ANTHROPIC_API_KEY=

# CRM (opcjonalne)
HUBSPOT_ACCESS_TOKEN=
PIPEDRIVE_API_TOKEN=

# Monitoring
SENTRY_DSN=
SENTRY_AUTH_TOKEN=

# Super admin bootstrap
SUPER_ADMIN_EMAIL=tomasz.kalla@k2biznes.pl
```

---

## 14. Error codes (frontend reference)

| Code | HTTP | Kiedy |
|---|---|---|
| `UNAUTHORIZED` | 401 | Brak tokenu / wygaśnięty |
| `FORBIDDEN` | 403 | RLS blokuje |
| `OFFER_NOT_FOUND` | 404 | Nie istnieje lub soft-deleted |
| `OFFER_EXPIRED` | 410 | `expires_at` w przeszłości |
| `OFFER_INVALID_STATUS` | 409 | np. próba akceptacji draftu |
| `VARIANT_NOT_OFFERED` | 422 | Klient próbuje wybrać wariant spoza `offered_variants` |
| `VALIDATION_ERROR` | 422 | Zod |
| `RATE_LIMITED` | 429 | Sekcja 5.1.1 |
| `INVALID_PDF_BYPASS` | 403 | Sekcja 9.1.1 — HMAC niepoprawny lub timestamp poza oknem |
| `GDPR_CLAUSE_MISMATCH` | 422 | Wersja klauzuli przesłana przez klienta nie zgadza się z aktualną |
| `INTERNAL_ERROR` | 500 | |

---

## 15. Plan wdrożenia (Claude Code — kolejne kroki)

1. **Setup:** `npx create-next-app@latest` + Supabase CLI init + Vercel link.
2. **Migrations:** wpisać wszystkie DDL z sekcji 3, zmigrować lokalnie, `supabase gen types typescript --local > packages/database/types.ts`.
3. **Seed:** wpisać `pricing_segments` z Appendix C (po decyzji biznesowej), minimalny seed `programs`/`case_studies`/`contact_persons`, bootstrap super admina (sekcja 3.4).
4. **Auth:** `middleware.ts` + helpery `lib/supabase/server.ts` / `lib/supabase/client.ts`.
5. **Pricing:** port `lib/pricing.ts` + testy Vitest (przykładowe w sekcji 6.1).
6. **API routes:** endpointy w kolejności: `GET /api/offers`, `POST /api/offers`, `GET /api/public/offers/:token`, `POST /api/offers/:id/send`, reszta.
7. **Frontend migration:** port HTML/CSS z `OFERTA_INTERAKTYWNA/` do React komponentów (`/o/[token]` jako server component, edytor w `(app)/offers/[id]/edit`); logika kalkulatora zastąpiona wywołaniem `/api/offers` (Appendix A.2).
8. **Email:** templaty React Email + integracja Resend.
9. **PDF:** Edge Function (lub fallback `window.print`).
10. **RLS policies:** sekcja 4 — apply + testy RLS w Supabase.
11. **Webhook queue:** migracja + endpoint `process-webhook-jobs` + cron.
12. **RODO:** banner consent, `/privacy-policy`, deletion flow.
13. **Staging:** deploy na Vercel preview + Supabase staging project. Test E2E (Playwright).
14. **Go-live:** domena, Sentry, Plausible, bootstrap super admina.

---

## Appendix A — Stan startowy (`OFERTA_INTERAKTYWNA/`) → docelowa architektura

> **Ważne — sprostowanie wobec v1.0:** wcześniejsze wzmianki o `K2Biznes Oferta App.html`, `store.js`, `offer.jsx`, `admin.jsx`, `OfferStore`, `K2Pricing`, `K2Programs`, `K2Cases`, `K2Contacts`, `localStorage['k2_offers_v3']` itd. opisywały **hipotetyczny stan**. W rzeczywistości pre-istnieje tylko `OFERTA_INTERAKTYWNA/` — statyczny vanilla-JS template.

### A.1 Co dostajemy w `OFERTA_INTERAKTYWNA/`

| Plik | Linie | Opis |
|---|---:|---|
| `index.html` | 441 | Pojedyncza strona oferty z 8 sekcjami; `contenteditable` na placeholdery; nawigacja po dotach; CTA bottom bar |
| `js/app.js` | 549 | Kalkulator (3 warianty, hardcoded 10%/5%/7% + 10000 PLN base), variant picker, scroll-reveal, URL params parser, card-tilt, keyboard nav |
| `css/styles.css` | 1471 | Branding K2, motion, print styles |
| `serve.js` | — | Lokalny dev server |
| `oferta-k2biznes.pdf` | — | Statyczny PDF (artefakt) |

**Czego nie ma:** auth, persistence, CRUD, admin panel, programy/case studies/contact persons (poza jednym hardcoded), tracking eventów, segmentowy pricing, send-to-client flow, webhooki, generacja PDF z danymi.

### A.2 Strategia migracji

Spec opisuje **nowy projekt Next.js** w `apps/web/`. Vanilla JS z `OFERTA_INTERAKTYWNA/` **nie podlega migracji 1:1** — odzyskujemy z niego tylko:

1. **Layout i CSS** (`styles.css` 1471L) — port do Tailwind / CSS modules zachowując branding.
2. **HTML markup** sekcji oferty — port do React komponentów (server components dla ofert klienta, client components dla edycji).
3. **Logikę interakcji** (variant picker, scroll-reveal, card-tilt, keyboard nav) — port do React hooks.
4. **URL params pre-fill** (`?firma=`, `?data=`, `?projekt=`, `?dofinansowanie=`, `?wariant=`, `?opcjonalny=`) — utrzymane jako shortcut do tworzenia oferty (przekierowuje konsultanta do `/offers/new?...`).

**Logika pricingu w `app.js` (10%/5%/7% + 10000 PLN, brak segmentów) NIE jest portowana** — zastępujemy nową implementacją z sekcji 6 + Appendix C.

### A.3 Mapowanie pojęć vanilla → docelowy backend

| `OFERTA_INTERAKTYWNA/` | Docelowo (Next.js + Supabase) |
|---|---|
| Statyczna strona z `contenteditable` | Server component `/o/[token]/page.tsx` (read-only render z DB) + edycja w `/offers/[id]/edit` (admin/consultant) |
| URL params pre-fill (`?firma=…`) | Redirect do kreatora `/offers/new?clientName=…&projectValue=…` |
| `recalculate()` w `app.js` (variant fees) | `lib/pricing.ts` `calcPricing()` (sekcja 6) — segmenty + loyalty + multi |
| `selectVariant(card)` (state in-memory) | `POST /api/public/offers/:token/accept` (sekcja 5.3) |
| Card-tilt, scroll-reveal, keyboard nav | React hooks w `components/offer/*` (czysty UI, bez backendu) |
| Hardcoded contact `Tomasz Kalla` w HTML | `contact_persons` table + relacja `offers.contact_person_id` |
| `oferta-k2biznes.pdf` (statyczny) | Edge Function `generate-pdf` (sekcja 9) per oferta |
| Brak | `offers`, `offer_events`, programy, case studies, dashboard, auth, RLS, webhooks |

### A.4 Co budujemy od zera (poza UI)

Wszystko z sekcji 3-12 oraz: `apps/web/app/(app)/admin/*` (dashboard, simulator, forecast), `apps/web/app/(app)/offers/*` (CRUD), Supabase Auth flow, Resend templates (sekcja 8), Edge Functions (`generate-pdf`, `send-offer-accepted`, `webhook-crm`), `webhook_jobs` cron consumer.

---

## Appendix B — Matching AI prompt (Claude Haiku)

Dla `POST /api/match` z `useAi=true`:

**System prompt:**
```
Jesteś ekspertem od dotacji unijnych dla polskich firm (FENG, FEPW, KPO, FELU).
Na podstawie profilu firmy i krótkiego opisu projektu rekomendujesz programy z katalogu.
Zwracasz JSON: { picks: [{programId, score: 0-100, reasons: string[]}], explanation: string }.
Maks 5 pozycji. Score: 100 = idealne dopasowanie.
```

**User prompt (szablon):**
```
Profil firmy: {companySize} w branży {industry}, województwo {voivodeship}.
Planowana wartość projektu: {projectValueMin}–{projectValueMax} PLN.
Opis projektu: {freeText}

Katalog dostępnych programów:
{programs listed with labels + descriptions}

Zwróć top 3-5 dopasowań w formacie JSON.
```

---

## Appendix C — Pricing seed (SEGMENTS + pricing_config)

Wartości to **single source of truth dla silnika pricingu** (`lib/pricing.ts`). Tabela `pricing_segments` musi zawierać dokładnie te wiersze, inaczej testy z sekcji 6.1 nie przejdą.

> ⚠️ **TODO biznes (Tomasz Kalla):** wartości oznaczone `???` muszą zostać uzupełnione przed merge do `main`. Wiersz `s5m` (oznaczony ✅) jest reprodukowany z testów jednostkowych w sekcji 6.1 i jest pewny. Pozostałe segmenty wymagają decyzji biznesowej.

### C.1 `pricing_segments`

| id | label | funding_min | funding_max | base_fee | sf_var1 | sf_var2 | sf_var3 | monthly_fee | order |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `s500k`   | do 500 tys. (mikro)              | 0          | 500_000     | ???    | ???    | ???    | ???    | ???   | 1 |
| `s1m`     | 500 tys. – 1M (małe)             | 500_000    | 1_000_000   | ???    | ???    | ???    | ???    | ???   | 2 |
| `s2m`     | 1M – 2M (małe/średnie)           | 1_000_000  | 2_000_000   | ???    | ???    | ???    | ???    | ???   | 3 |
| `s5m`  ✅ | 2M – 5M (SMART MŚP)              | 2_000_000  | 5_000_000   | 15_000 | 0.0450 | 0.0550 | 0.0700 | 4_000 | 4 |
| `s5mplus` | 5M+ (duże projekty)              | 5_000_000  | NULL        | ???    | ???    | ???    | ???    | ???   | 5 |

### C.2 `pricing_config` (singleton)

| field | value |
|---|---:|
| `loyalty_discount`    | 0.20  |
| `multi_discount`      | 0.20  |
| `min_sf_amount`       | 35_000 |
| `min_base_fee`        | 6_000 |

### C.3 Insert SQL (z TODO)

```sql
-- Po wypełnieniu '???' przez biznes:
insert into pricing_segments (id, label, funding_min, funding_max, base_fee, sf_variant_1, sf_variant_2, sf_variant_3, monthly_fee, display_order) values
  ('s500k',   'do 500 tys. (mikro)',    0,         500000,  /*TODO*/ 0,  0, 0, 0, 0, 1),
  ('s1m',     '500 tys. – 1M',          500000,   1000000,  /*TODO*/ 0,  0, 0, 0, 0, 2),
  ('s2m',     '1M – 2M',               1000000,   2000000,  /*TODO*/ 0,  0, 0, 0, 0, 3),
  ('s5m',     '2M – 5M (SMART MŚP)',   2000000,   5000000,         15000, 0.0450, 0.0550, 0.0700, 4000, 4),
  ('s5mplus', '5M+ (duże projekty)',   5000000,      NULL,  /*TODO*/ 0,  0, 0, 0, 0, 5);

insert into pricing_config (id, loyalty_discount, multi_discount, min_sf_amount, min_base_fee)
  values ('global', 0.20, 0.20, 35000, 6000);
```

### C.4 Multi-project discount — clamp

W `lib/pricing.ts` (sekcja 6) wyrażenie `base *= 1 - multi_discount * (projectCount - 1)` dla `projectCount = 5` daje `base * 0.2` (80% redukcji). Decyzja biznesowa:

- **Wariant A (rekomendowany):** clamp `min(projectCount - 1, 3)` → maks 60% redukcji.
- **Wariant B:** geometryczne `pow(1 - multi_discount, projectCount - 1)` → maks 41% redukcji dla 5 projektów.

Domyślnie implementujemy A. `min_base_fee` (6 000 PLN) jest hard-floor.

---

## Appendix D — Changelog

### v1.1.1 — 2026-04-26 — fix po pierwszym `supabase db reset`

- **Funkcje pomocnicze** (`user_role`, `is_admin`, `is_super_admin`): przeniesione z `auth.*` do `public.*`. Schema `auth` jest własnością `supabase_auth_admin` — `CREATE FUNCTION auth.X` rzuca `permission denied for schema auth (SQLSTATE 42501)`. Zweryfikowane: 13 tabel z RLS, 27 policies, 6 enumów; `select from profiles` jako authenticated nie wpada w infinite recursion (Blocker 8 zamknięty empirycznie).
- Dodano notę w sekcji 4.1 o tym dlaczego `public.*`, nie `auth.*`.

### v1.1 — 2026-04-25 — review/audyt techniczny przed wdrożeniem

**Blockery (4):**
- B1 (sekcja 3.1): rozwiązanie forward references w `offers` — dodano notę o kolejności CREATE TABLE w migracji.
- B2 (sekcja 3.2.3): `encode(..., 'base64url')` → `translate(encode(...,'base64'),'+/=','-_')`.
- B8 (sekcja 4.1): infinite recursion w policies `profiles` → wprowadzono `public.user_role()`, `public.is_admin()`, `public.is_super_admin()` jako `security definer` + trigger przeciw self-escalation roli.
- B20 (sekcja 9.1): Edge Function PDF auth — dodano HMAC bypass (`PDF_BYPASS_SECRET`, `__pdfBypass`) + zdefiniowano `pricingSnapshotHash` (RFC 8785 JCS).

**High/Medium/Low (rest):**
- B3, B4 (3.2.4, 11.6): `ip_hash` z `ip_salt_version`; `on delete cascade` zamienione na `set null`/`restrict` w newralgicznych miejscach.
- B5, B6 (3.2.1, 3.2.6): partial unique na `profiles.email`, unique na `contact_persons.profile_id`.
- B9 (4.3): `offer_events insert` z weryfikacją ownership + zgodności `actor_id`.
- B12 (5.3 / 14): generacja `offer_number` przez sekwencję per-miesiąc, nie `count(*)`.
- B14, B15 (5.1.2): konwencja CSV-list + mapowanie `ZodError` → `details.issues`.
- B16 (5.3): `VARIANT_NOT_OFFERED` podlinkowany w server logic `accept`.
- B18 (7.5): invalidacja sesji po promocji roli.
- B19 (7.6): MFA TOTP wymagane dla `admin`/`super_admin`, session max 12h.
- B21 (9.1.2): `pricingSnapshotHash` zdefiniowany.
- B22, B23, B24 (10.4): backoff `[30s,2min,10min,1h,6h]`, wymagany Vercel Pro / `pg_cron`, `idempotencyKey`.
- B26 (Appendix C.4): clamp dla multi-project discount.
- B28 (5.3, 11.4): zgoda RODO z `gdpr_clause_version`, `gdpr_accepted_at`, `gdpr_text_hash`.
- B30 (9.1): life-cycle policy bucket `offer-pdfs/`.
- B31 (3.2.10): audit_log dla `data_deletion_requests`.
- B32 (12.1): Sentry `beforeSend` PII filter.
- B33 (5.1.1): rate-limit przez Upstash.
- B34 (14): GH Action sprawdzająca `supabase gen types`.
- B37 (3.4): bootstrap super admina przez `00_bootstrap.sql`.
- B38 (5.3): kontrakt `POST /reject` dopisany.

**Pozostałe TODO (do biznesu):**
- Appendix C — uzupełnić wartości segmentów `s500k`, `s1m`, `s2m`, `s5mplus`.
- Appendix A — przepisany pod faktyczny stan `OFERTA_INTERAKTYWNA/`.

### v1.0 — 2026-04-24 — pierwsza wersja specyfikacji

---

**KONIEC DOKUMENTU**
