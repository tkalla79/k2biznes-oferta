# K2Biznes Oferta

SaaS do ofert handlowych dla klientów dotacyjnych (FENG / FEPW / KPO / FELU).

> **Stan:** Produkcja https://oferta.k2biznes.pl (PR #1–#80 zmergowane). 3 rundy code review, 4 admin userzy, RODO/GDPR v2 + privacy policy live. **Etap 2 (edytowalność)** wdrożony: biblioteka alt-programów, szablony oferty, globalne statystyki firmowe (`/admin/ustawienia`), edytowalne treści per-oferta, fix rozwijania komponentów w PDF. **Etap 3 (pilotaż UX)** wdrożony — patrz [Model oferty i katalogów](#model-oferty-i-katalogów). Stack: Next.js 14 + Supabase Cloud + Vercel + Resend + Sentry + UptimeRobot.

## Lokalizacja

- **Kod:** `~/Code/k2biznes-oferta/` (lokalny dysk) + https://github.com/tkalla79/k2biznes-oferta (single source of truth)
- **Specyfikacja:** [docs/BACKEND_SPEC.md](docs/BACKEND_SPEC.md) w repo. OneDrive `CLAUDE_CODE/OFERTA/` jest kopią roboczą do edycji zespołowej — repo wygrywa.

## Dokumentacja (tech-admin)

Zacznij od **[docs/TECH_ADMIN_MANUAL.md](docs/TECH_ADMIN_MANUAL.md)** — masterdoc spinający wszystko.

Dla osób tworzących oferty: **[docs/K2Biznes_Oferta_-_instrukcja_i_architektura.docx](docs/K2Biznes_Oferta_-_instrukcja_i_architektura.docx)** — instrukcja obsługi panelu (Część I) + opis architektury (Część II), w standardzie dokumentów K2.

- **[docs/BACKEND_SPEC.md](docs/BACKEND_SPEC.md)** — pełna specyfikacja techniczna (v1.2.0, etap 2)
- **[docs/APPLICATIONS_INVENTORY.md](docs/APPLICATIONS_INVENTORY.md)** — inwentarz 10 external services
- **[docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md)** — procedury backup + recovery scenarios
- **[docs/PROD_SETUP.md](docs/PROD_SETUP.md)** — setup produkcji (1-time)
- **[docs/RUNBOOK_MIGRATION_ROLLBACK.md](docs/RUNBOOK_MIGRATION_ROLLBACK.md)** — rollback migracji DB
- **[docs/CODE_REVIEW_HANDOFF.md](docs/CODE_REVIEW_HANDOFF.md)** — onboarding code reviewera
- **[docs/PLANY_ROZWOJU.md](docs/PLANY_ROZWOJU.md)** — backlog post-MVP

## Stack

- **Next.js 14** (App Router, TypeScript strict, Zod)
- **Supabase Cloud** (Postgres 17 + Auth (PKCE) + Storage + Edge Functions; RLS na każdej tabeli)
- **Vercel** (Hobby, region cdg1)
- **Upstash Redis** (rate-limit, sekcja 5.1.1)
- **Resend** (email — `noreply@k2biznes.pl`, DKIM/SPF verified)
- **Sentry** (monitoring + PII scrubbing — sekcja 12.1, EU region)
- **UptimeRobot** (ping `/api/health` co 5 min)

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

## Model oferty i katalogów

Aktualna struktura treści oferty (po pilotażu UX, PR #75–#80). Widok klienta ma 8 sekcji;
formularz administratora układa pola w **tej samej kolejności co sekcje oferty**.

**Sekcja 01 — Wprowadzenie:** dwie kolumny — po lewej *zdiagnozowane potrzeby klienta*,
po prawej *merytoryczna podstawa rekomendacji* (pole `recommendationBasis`, limit 1500 znaków).
Usunięto dawny wstęp (`intro`) i 4 stałe punkty potrzeb.

**Sekcja 02 — Proponowane rozwiązanie:** program rekomendowany renderuje się jako wyróżniony
kafelek (badge „Rekomendowany”), pod nim jego opis, a niżej pozostałe programy wsparcia.

**Katalog programów — scalony.** Dawne osobne katalogi „Programy" i „Alternatywne programy"
połączono w jedną **bibliotekę programów wsparcia** (`/admin/alt-programs`, tabela `alt_programs`).
W formularzu oferty dodaje się je z listy rozwijanej; dokładnie jeden wpis oznacza się jako
**rekomendowany** (trafia do sekcji 02). Moduł `/admin/programs` został wygaszony (tabela
`programs` pozostaje w bazie, bez UI). Minimalne wymagane pola oferty: nazwa firmy, wartość
projektu i jeden rekomendowany program wsparcia.

**Case study** (`/admin/case-studies`) ma opcjonalne pole `url` — jeśli uzupełnione, w sekcji 06
oferty pojawia się odnośnik „Zobacz pełny opis projektu” (migracja `20260715000001_case_study_url`).

**Statystyki firmowe** (kwota dofinansowania, liczba projektów, lata doświadczenia) edytuje się
w `/admin/ustawienia` — wspólne dla wszystkich ofert.

**Wypełnianie z transkrypcji (AI).** W formularzu oferty przycisk „Wypełnij z transkrypcji"
przyjmuje wklejony tekst albo plik `.docx`/`.txt`; endpoint `POST /api/admin/offer-draft`
(Claude Haiku, tool-use) wyciąga dane klienta, wprowadzenie (sekcja 01), wartość projektu
(do ręcznego potwierdzenia) i podpowiada program z biblioteki. Uzupełnia **tylko puste pola**,
oznacza je do sprawdzenia, nic nie zapisuje ani nie wysyła; transkryptu nie przechowujemy.
Wymaga `ANTHROPIC_API_KEY` w środowisku (dev: `.env.local`, prod: Vercel). Bez klucza endpoint
zwraca `503`. Czysta normalizacja wyjścia modelu: [`lib/offers/draft.ts`](apps/web/lib/offers/draft.ts) (+ testy).

## Quickstart

### Wymagania

- **Node.js 20+** (testowane na 24)
- **Docker Desktop** (wymagany przez `supabase start` — uruchamia lokalny Postgres)
- **Supabase CLI** — `npm i -D supabase` (instalowane przez `npm install`) lub `brew install supabase/tap/supabase`
- **Chrome** (opcjonalny — tylko dla PDF generation lokalnie). Ustaw `LOCAL_CHROME_PATH` w `.env.local`. Bez tego GET `/api/public/offers/:token/pdf` zwraca `503` zamiast crash'u.

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

## Pricing — segmenty seedowane

Wszystkie 5 segmentów (`s500k` / `s1m` / `s2m` / `s5m` / `s5mplus`) mają realne wartości
w `supabase/migrations/` + prod-DB (post PR #29). Edycja przez Supabase Studio →
`pricing_config` tabela (admin-only przez RLS).

## Backlog

Patrz [docs/PLANY_ROZWOJU.md](docs/PLANY_ROZWOJU.md) (post-MVP roadmap)
i [docs/FRONTEND_POLISH_BACKLOG.md](docs/FRONTEND_POLISH_BACKLOG.md) (UX polish).
