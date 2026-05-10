# Code review handoff — K2Biznes Oferta

Dokument dla zewnętrznego doradcy / code reviewera. Skraca onboarding do projektu z 1 dnia do 1 godziny.

---

## TL;DR — czym jest aplikacja

**K2Biznes Oferta** — SaaS do tworzenia i wysyłania ofert handlowych dla klientów dotacyjnych (FENG / FEPW / KPO / FELU). Konsultant tworzy ofertę w panelu admina, wysyła linkiem klientowi, klient akceptuje online.

**Stan na 2026-05-09:**
- Status: production-staging, działa na `https://oferta.k2biznes.pl`
- Build: `34c4895` na branch `main`
- Aktywni użytkownicy: 1 super_admin (właściciel), brak realnych klientów jeszcze
- Test offer w prod DB: 1 sztuka (Test K2 Sp. z o.o., status `draft`/`sent`)

## Stack

- **Frontend + backend:** Next.js 14 App Router, TypeScript strict, Zod, React 18
- **Baza danych:** Supabase Cloud Postgres 17, eu-central-1 region
- **Auth:** Supabase Auth (email+password+MFA TOTP), RLS na każdej tabeli
- **Email:** Resend (free tier, transactional)
- **Storage:** Supabase Storage (PDF cache)
- **PDF gen:** puppeteer-core + @sparticuz/chromium (currently disabled w UI — Vercel Hobby 10s timeout)
- **Hosting:** Vercel Hobby tier
- **Testy:** Vitest 201 testów, ESLint, tsc strict
- **Redis (rate-limit):** Upstash, opcjonalne

## Struktura repo

```
apps/web/                       # Next.js
  ├── app/
  │   ├── (app)/admin/         # Panel admina (server components + client managers)
  │   ├── api/                 # API routes (REST, force-dynamic, nodejs runtime)
  │   ├── auth/                # signin, callback, mfa-setup, mfa-challenge
  │   └── o/[token]/           # Publiczna oferta (server component + AcceptForm client)
  ├── components/              # Shared UI (RichTextEditor, CookieConsent)
  ├── lib/
  │   ├── api/error.ts         # ApiError + handleError
  │   ├── auth/session.ts      # requireSession / requireAdmin / requireSuperAdmin
  │   ├── pricing/             # calc engine (pure function, 26 testów), override logic
  │   ├── offers/              # mapper snake→camelCase, public loader
  │   ├── pdf/                 # render via puppeteer, storage cache, hash
  │   ├── validation/          # Zod schemas
  │   └── email/               # React Email templates
  ├── middleware.ts            # auth + rate-limit + PDF bypass
  └── package.json
packages/database/types.ts      # Generated Supabase types (manual edits for faq_items)
supabase/
  ├── migrations/              # 11 migracji (init, RLS, fixes, pricing_override, faq_items)
  ├── seed.sql                 # 5 segmentów pricingu, 25 programów, 2 case studies, 6 FAQ, GDPR clause
  └── config.toml
docs/
  ├── TESTER_HANDOFF.md        # User-facing testing guide
  ├── PROD_SETUP.md            # Production setup runbook
  ├── PLANY_ROZWOJU.md         # Backlog (Poziom 2 pricingu)
  └── CODE_REVIEW_HANDOFF.md   # ten plik
```

## Co prosi się zrecenzować

### 1. Security (priorytet ⭐⭐⭐)
- RLS policies — `supabase/migrations/20260425000002_rls.sql` + późniejsze fixy
- Auth flow — `lib/auth/session.ts`, `app/auth/callback/route.ts`, `app/api/auth/magic-link/route.ts`
- MFA enforcement dla admin/super_admin
- Anti-enum (signin nie zdradza istnienia emaila)
- IP hashing dla offer_events (`lib/ip-hash.ts`)
- HMAC bypass dla PDF Edge Function (`lib/pdf-bypass.ts`)
- Sanitizacja HTML w rich-text (`lib/richtext.ts` — sanitize-html)

### 2. Architektura danych
- Schema: `supabase/migrations/20260425000001_init.sql`
- Wzorzec snapshot+override dla pricingu: `offers.pricing_snapshot` (jsonb, immutable po wystawieniu) + `offers.pricing_override` (jsonb, edytowalne)
- Mapper snake→camelCase: `lib/offers/mapper.ts` — zwraca 2 różne DTO (admin pełny, public z stripped PII)
- FK ON DELETE SET NULL dla programs/case_studies/contact_persons → offers (historia zachowana)

### 3. Pricing engine
- Pure function: `lib/pricing/index.ts` (26 testów Vitest)
- Segmenty + variants + discounts: `lib/pricing/types.ts`
- Override logic: `lib/pricing/override.ts` (20 testów)
- Edge cases: floor (`min_sf_amount`, `min_base_fee`), loyalty discount, multi-project discount

### 4. API contracts
- REST endpoints w `app/api/**/route.ts`
- Zod walidacja per endpoint w `lib/validation/`
- Error shape: `lib/api/error.ts` — `{ error: { code, message, details } }`
- Status codes: 400/401/403/404/409/422/500/503
- Anti-enum dla magic-link (zawsze ok:true)

### 5. Audit/compliance
- `lib/audit.ts` — logAudit() per zmiana (offer.update, role.change, gdpr.accept)
- GDPR clause versioning: `gdpr_clauses` + `offers.gdpr_clause_version` + `gdpr_accepted_at` + `gdpr_text_hash`
- Data deletion requests: `/api/auth/request-data-deletion`, `/admin/gdpr`
- IP salt rotation: `ip_hash_salts` table + `ip_salt_version` na offer_events

### 6. Performance / cache
- PDF cache: `lib/pdf/storage.ts` — klucz `{offerNumber}_{pricingSnapshotHash}.pdf`, invalidacja po edycji
- 5-min memory cache dla pricingu: `lib/pricing/load.ts`
- Static generation gdzie możliwe (większość route'ów force-dynamic)

## Co reviewer może POMIJAĆ

- **OFERTA_INTERAKTYWNA/** — to stary static frontend, nieużywany w app
- **/api/internal/process-webhook-jobs** — webhook queue, opcjonalna (HUBSPOT/PIPEDRIVE wymaga konta)
- **PDF generation** — endpoint istnieje ale przycisk ukryty w UI (Hobby timeout)
- **Sentry/UptimeRobot** — w backlogu (Fala 3), jeszcze nie wdrożone

## Specyfikacja systemowa

Pełna spec: `BACKEND_SPEC.md` v1.1.1 (poza repo — w OneDrive-CLAUDE_CODE/OFERTA/ właściciela). Jeśli reviewer potrzebuje, właściciel udostępni.

## Pre-existing TODO

| Plik | Punkt | Status |
|------|-------|--------|
| README.md L189 | Pricing seeds w seed.sql — 4 z 5 segmentów ma extrapolated values (tylko s5m real per spec) | Akceptowane do MVP, edytowalne per oferta |
| docs/PLANY_ROZWOJU.md L1 | Globalna edycja pricing_segments + pricing_config przez UI | W backlogu, post-MVP |
| Backlog (Fala 3) | Sentry + PII scrubbing | Pending |
| Backlog (Fala 3) | UptimeRobot dla `/api/health` | Pending |
| Backlog (Fala 3) | Reset hasła z UI (Supabase ma builtin, brakuje strony) | Pending |
| Backlog (Fala 3) | Upload logo/photo dla case_study/contact_person (obecnie URL only) | Pending |
| Backlog (Fala 3) | Runbook rollback migracji | Pending |
| Backlog (Fala 3) | PDF re-enable po Vercel Pro upgrade | Pending |

## Historia rozwoju (krótko)

- **PR #1-#10**: Setup, schema, RLS, pricing engine, API CRUD, public offer + accept, email Resend, PDF, webhooks, admin dashboard, RODO UI
- **PR #11-#23**: Bug fixes z code review, redesign /o/[token] z nowym brandem, deploy infra (Vercel + Supabase Cloud), tester accounts
- **PR-A (#26)**: Katalogi DELETE + filtry + UX hints
- **PR-B (#28)**: Bugi i drobne UX (uwagi 11-22)
- **PR-C (#29)**: Pricing edytowalny per oferta + akcept reflecting variant
- **PR-D (#30)**: Edytowalne sekcje oferty (Tiptap rich-text, FAQ globalna, alt-programs)
- **Production launch** (2026-05-08): oferta.k2biznes.pl uruchomione
- **Bug fixes post-launch**: isomorphic-dompurify→sanitize-html (jsdom SSR break), @sparticuz/chromium added, headless config fix, PDF disabled w UI

## Środowisko testowe

Reviewer może:
- Czytać kod publicznie na GitHub (repo jest public/private — zależy od ustawień)
- Sprawdzić działanie na `https://oferta.k2biznes.pl` — strona publiczna `/` widoczna bez logowania
- Poprosić właściciela o invite do panelu admina (`tester@k2biznes.pl` z password) — staging environment

## Kontakt

Właściciel: Tomasz Kalla, `t.kalla@k2biznes.pl`
