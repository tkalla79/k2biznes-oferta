# K2Biznes Oferta

SaaS do ofert handlowych dla klientów dotacyjnych (FENG / FEPW / KPO / FELU).

> **Stan:** PR #1 (setup + DB + auth) + PR #2 (pricing engine + 26 testów) + PR #3 (API CRUD `/api/offers` + 24 testy walidacji). Public endpoint `/o/[token]`, email + Edge Functions w kolejnych iteracjach.

## Lokalizacja

- **Kod:** `~/Code/k2biznes-oferta/` (lokalny dysk).
- **Specyfikacja:** OneDrive → `CLAUDE_CODE/OFERTA/` (dokumenty trzymane w synchronizacji zespołowej).

## Dokumentacja

- Specyfikacja: `~/Library/CloudStorage/OneDrive-K2BiznesSp.zo.o/CLAUDE_CODE/OFERTA/BACKEND_SPEC.md` (v1.1.1)
- Render HTML: `…/OFERTA/backend-spec.html`

## Stack

- **Next.js 14** (App Router, TypeScript strict, Zod)
- **Supabase** (Postgres 15 + Auth + Storage + Edge Functions; RLS na każdej tabeli)
- **Upstash Redis** (rate-limit, sekcja 5.1.1)
- **Resend** (email — sekcja 8, nie wdrożone w PR #1)
- **Sentry** (monitoring + PII scrubbing — sekcja 12.1, nie wdrożone w PR #1)

## Struktura

```
OFERTA_APP/
├── apps/web/                  # Next.js
│   ├── app/                   # App Router
│   │   ├── api/
│   │   │   ├── health/        # GET /api/health
│   │   │   └── offers/        # CRUD (PR #3)
│   │   │       ├── route.ts             # GET (list+filters) + POST (create)
│   │   │       └── [id]/
│   │   │           ├── route.ts         # GET + PATCH + DELETE (soft)
│   │   │           └── recalculate/route.ts  # POST — force recalc snapshot
│   │   ├── (app)/             # zalogowana część (puste)
│   │   ├── (marketing)/       # marketing (puste)
│   │   └── o/                 # widok klienta po tokenie (puste)
│   ├── lib/
│   │   ├── api/error.ts       # ApiError, errorResponse, toApiError(ZodError)
│   │   ├── auth/session.ts    # requireSession / requireAdmin / requireSuperAdmin
│   │   ├── audit.ts           # logAudit() — sekcja 3.2.9
│   │   ├── offers/mapper.ts   # snake_case ↔ camelCase DTO
│   │   ├── supabase/          # server.ts / client.ts / admin.ts
│   │   ├── validation/
│   │   │   ├── offers.ts      # Zod: Create/Update/List + sort whitelist
│   │   │   └── offers.test.ts # 24 testy walidacji
│   │   ├── pricing/           # calcPricing engine (sekcja 6 + Appendix C.4)
│   │   │   ├── index.ts       # pure function, 26 testów Vitest
│   │   │   ├── types.ts       # PricingSegment, PricingConfig, PricingResult, ...
│   │   │   ├── load.ts        # loader z Supabase + 5-min memory cache
│   │   │   └── index.test.ts  # testy z sekcji 6.1 + edge cases
│   │   ├── pdf-bypass.ts      # HMAC dla Edge → /o/ render (sekcja 9.1.1)
│   │   └── rate-limit.ts      # Upstash (sekcja 5.1.1)
│   ├── vitest.config.ts
│   └── middleware.ts          # auth + rate-limit + PDF bypass
├── packages/
│   ├── database/types.ts      # supabase gen types (stub do pierwszego db:types)
│   └── email-templates/       # React Email (puste)
├── supabase/
│   ├── config.toml            # Supabase CLI config
│   ├── migrations/
│   │   ├── 20260425000001_init.sql   # schema (sekcja 3)
│   │   └── 20260425000002_rls.sql    # RLS policies (sekcja 4)
│   ├── seed.sql               # seed danych (sekcja 3.4 + Appendix C)
│   └── functions/             # Edge Functions (puste)
└── docs/
```

## Quickstart

### Wymagania

- **Node.js 20+** (testowane na 24)
- **Docker Desktop** (wymagany przez `supabase start` — uruchamia lokalny Postgres)
- **Supabase CLI** — `npm i -D supabase` (instalowane przez `npm install`) lub `brew install supabase/tap/supabase`

### Setup

```bash
# 1. Wejdź do projektu
cd ~/Code/k2biznes-oferta/

# 2. Zainstaluj zależności (workspaces — instaluje też apps/web)
npm install

# 3. Skopiuj env
cp .env.example .env.local

# 4. Uruchom lokalny Supabase (wymaga Docker)
npm run db:start
# wypisuje URL + anon/service keys → wpisz do .env.local

# 5. Reset DB (migracje + seed)
npm run db:reset

# 6. Wygeneruj typy TypeScript z DB
npm run db:types

# 7. Uruchom Next.js
npm run dev
# http://localhost:3000

# 8. Healthcheck
curl http://localhost:3000/api/health
```

### Bootstrap super admina

Po pierwszym `db:reset` (sekcja 3.4 spec'a):

```bash
# 1. W Supabase Studio (http://127.0.0.1:54323):
#    Auth → Users → Invite user (email: SUPER_ADMIN_EMAIL z .env.local)

# 2. Promocja na super_admin (przez SQL Editor):
update profiles set role = 'super_admin'
  where email = 'tomasz.kalla@k2biznes.pl';

# 3. Propagacja claim do JWT:
curl -X PUT "http://127.0.0.1:54321/auth/v1/admin/users/<user_id>" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"app_metadata":{"role":"super_admin"}}'
```

## Smoke test `/api/offers` (PR #3)

Wymaga: lokalny Supabase + zalogowany konsultant.

```bash
# 1. Uruchom stack
npm run db:start
npm run db:reset
npm run dev          # apps/web :3000

# 2. W Supabase Studio (http://127.0.0.1:54323):
#    Auth → Users → Invite user (np. test@k2biznes.pl)
#    Po pierwszym kliknięciu w magic link masz sesję.

# 3. Przykładowe wywołania (cookie-based auth — przez przeglądarkę):
curl -b "sb-localhost-auth-token=..." -X POST http://localhost:3000/api/offers \
  -H 'Content-Type: application/json' \
  -d '{
    "clientName":"Aqustec Sp. z o.o.",
    "programLabel":"FENG · Ścieżka SMART",
    "projectValue":4000000,
    "fundingRate":0.65
  }'
# → 201 + { data: { id, offerNumber, clientUrl, pricingSnapshot{ segment:"s5m", base:15000 ... } } }

curl -b "sb-localhost-auth-token=..." \
  "http://localhost:3000/api/offers?status=draft&sort=createdAt:desc&pageSize=10"
# → { data: [...], pagination: { page, pageSize, total, hasMore } }

curl -b "sb-localhost-auth-token=..." -X PATCH \
  http://localhost:3000/api/offers/<uuid> \
  -H 'Content-Type: application/json' \
  -d '{"projectValue":5000000}'
# → recalc snapshot (segment, base, sf*) + 200

curl -b "sb-localhost-auth-token=..." -X DELETE \
  http://localhost:3000/api/offers/<uuid>
# → admin only; 403 dla consultanta
```

## Verification

```bash
npm run db:reset       # migracje + seed muszą przejść bez błędu (PR #1)
npm run db:lint        # supabase lint
npm run typecheck      # tsc --noEmit (oczekuje types.ts po db:types)
npm run lint
npm test               # Vitest (PR #2 — 26 testów pricingu, < 200ms)
```

> **Uwaga o czasie tsc/vitest:** Projekt na OneDrive cierpi na ciężki sync I/O —
> `tsc --noEmit` zajmuje 5–10 minut zamiast sekund, `vitest` może wisieć.
> Workaround dla testów: skopiować `apps/web/lib/pricing/` do `/tmp/k2pricing/`,
> tam `npx vitest run` kończy się w ~150ms. Docelowo: przenieść projekt na
> lokalny dysk lub wykluczyć z OneDrive sync.

## Wartości pricing — TODO biznes

`supabase/seed.sql` zawiera 5 segmentów, ale 4 mają wartości `0` jako placeholder.
Tomasz musi uzupełnić **przed deployem produkcyjnym**:

- `s500k` (0 – 500 tys.)
- `s1m` (500 tys. – 1M)
- `s2m` (1M – 2M)
- `s5m` ✅ wartości z testów Vitest (sekcja 6.1) — base 15000, sf 4.5/5.5/7%, monthly 4000
- `s5mplus` (5M+)

Pełna tabela do uzupełnienia: [Appendix C](../OFERTA/BACKEND_SPEC.md#appendix-c--pricing-seed-segments--pricing_config).

## Następne PR-y

| PR | Zakres | Zależność |
|---|---|---|
| ~~#2~~ | ~~`lib/pricing/` + 26 testów Vitest~~ ✅ DONE (działa z `s5m`; pozostałe segmenty wpadają we floor) | — |
| ~~#3~~ | ~~API CRUD `/api/offers` + walidacja Zod~~ ✅ DONE (50 testów łącznie) | — |
| #4 | Public endpoint `/o/[token]` (render + accept) | #3 |
| #5 | Email templates (Resend) + `POST /offers/:id/send` | #4 |
| #6 | Edge Function `generate-pdf` | #5 |
| #7 | Webhook queue + cron consumer | #6 |
| #8 | Admin dashboard + simulator + forecast | #7 |
| #9 | RODO UI (consent, deletion request, export) | #8 |
