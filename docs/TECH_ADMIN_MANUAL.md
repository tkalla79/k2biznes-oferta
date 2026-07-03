# Tech-admin manual — K2Biznes Oferta

Masterdoc dla osoby utrzymującej i rozwijającej aplikację (Tomek + przyszli devs).
Spina rozproszone runbooks w jedną nawigowalną dokumentację.

**Aktualizacja:** 2026-06-14 (etap 2: edytowalność — `/admin/ustawienia`, alt-programy, szablony, print-fix PDF)

---

## 1. TL;DR (5 minut)

**K2Biznes Oferta** to SaaS Next.js 14 + Supabase Cloud do tworzenia i wysyłania ofert handlowych klientom dotacyjnym (FENG/FEPW/KPO/FELU). Aplikacja działa na produkcji od ~3 tygodni.

**Architektura w jednym zdaniu:** konsultant K2 loguje się do `/admin/*` (MFA wymagane), tworzy ofertę, wysyła linkiem klientowi → klient otwiera `/o/[token]` anonimowo, akceptuje online → konsultant widzi `accepted` w panelu.

**Stack:**
- **Frontend + backend** w jednym: Next.js 14 App Router + TypeScript strict
- **DB + Auth + Storage:** Supabase Cloud (Postgres 17, eu-central-1, project `yuyyejwnryuynbosqwwa`)
- **Hosting:** Vercel Hobby (`oferta.k2biznes.pl`)
- **Email:** Resend (domena `k2biznes.pl` zweryfikowana)
- **Monitoring:** Sentry + UptimeRobot
- **Rate limit:** Upstash Redis

**Co warto wiedzieć od razu:**
- Supabase Free **pauzuje projekt po 7 dniach inactivity** — UptimeRobot pinguje `/api/health` co 5 min zapobiegawczo
- Vercel Hobby ma **10s timeout** na funkcje serverless → PDF generation wyłączone w UI (puppeteer cold start to ~15s)
- `BACKEND_SPEC.md` jest pełną specyfikacją techniczną (1664 linii) — referencja przy każdej zmianie schematu / RLS / API contract
- `profiles.role` jest źródłem prawdy dla auth (NIE JWT `app_metadata.role`) — zmieniając rolę aktualizuj OBA pola

---

## 2. Architektura

### Komponenty

```
┌─────────────────────────────────────────────────────────────┐
│  Internet (anonymous klient)                                │
│       │                                                     │
│       ▼                                                     │
│  /o/[token]  ──────────────────┐                            │
│  (Next.js Server Component)    │                            │
│                                │  read-only                 │
│                                ▼                            │
│                          Supabase DB (RLS)                  │
│                                ▲                            │
│                                │  read+write                │
│  /admin/*  ────────────────────┤                            │
│  (Next.js Server + Client)     │                            │
│       ▲                        │                            │
│       │ MFA                    │                            │
│  Konsultant K2 (Tomek+zespol)  │                            │
│                                │                            │
│  API routes /api/*  ───────────┘                            │
│   ├─ /api/offers/*       (CRUD)                             │
│   ├─ /api/admin/*        (katalogi, upload)                 │
│   ├─ /api/public/offers  (akceptacja, PDF)                  │
│   └─ /api/auth/*         (signin, magic-link, forgot-pwd)   │
│                                                             │
│  External services:                                         │
│   ├─ Resend (email)                                         │
│   ├─ Sentry (errors)                                        │
│   ├─ Upstash Redis (rate-limit)                             │
│   └─ UptimeRobot (uptime ping)                              │
└─────────────────────────────────────────────────────────────┘
```

### Kluczowe tabele DB (per BACKEND_SPEC sekcja 3)

- `profiles` — userzy + role (super_admin / admin / consultant)
- `offers` — wszystkie oferty (snapshot + override pricing, content jsonb)
- `pricing_segments` — 5 progów wartości projektu (s500k → s5mplus)
- `pricing_config` — discounty + floor values
- `programs` — katalog 8 programów dotacyjnych
- `case_studies` — 5 realnych studiów przypadku
- `contact_persons` — 4 osoby kontaktowe zespołu
- `faq_items` — 6 globalnych pytań FAQ
- `gdpr_clauses` — wersjonowane klauzule RODO (v1 deactivated, v2-2026-05 current)
- `offer_events` — audit log (sent/viewed/accepted/rejected/pdf_downloaded)
- `webhook_jobs` — kolejka outbound webhooks (CRM integration)
- `ip_hash_salts` — rotowane salty dla IP hashing
- `alt_programs` — biblioteka programów alternatywnych (etap 2, `/admin/alt-programs`)
- `offer_templates` — szablony startowe oferty (etap 2, `/admin/templates`)
- `app_settings` — globalne ustawienia firmowe; klucz `company_stats` (etap 2, `/admin/ustawienia`)

### Kluczowe routes

| Route | Co robi | Auth |
|---|---|---|
| `/` | Landing page | brak |
| `/auth/signin` | Login (password + magic link) | brak |
| `/auth/forgot-password` | Reset hasła | brak |
| `/auth/reset-password` | Nowe hasło po recovery link | recovery session |
| `/auth/mfa-setup` | QR code TOTP | session aal1 |
| `/auth/mfa-challenge` | 6-cyfrowy kod TOTP | session aal1 |
| `/admin` | Dashboard (KPI, forecast, simulator) | admin+ MFA |
| `/admin/offers/*` | CRUD ofert + editor | consultant+ |
| `/admin/programs` | Katalog programów | admin+ |
| `/admin/case-studies` | Katalog case studies | admin+ |
| `/admin/contact-persons` | Osoby kontaktowe | admin+ |
| `/admin/faq` | Globalne FAQ | admin+ |
| `/admin/alt-programs` | Biblioteka alt-programów (etap 2) | admin+ |
| `/admin/templates` | Szablony oferty (etap 2) | admin+ |
| `/admin/ustawienia` | Statystyki firmowe `company_stats` (etap 2) | super_admin |
| `/admin/users` | Lista userów + role | super_admin |
| `/admin/gdpr` | Wnioski o usunięcie danych | admin+ |
| `/o/[token]` | Publiczna oferta (klient) | brak (token = auth) |
| `/privacy-policy` | Polityka prywatności | brak |
| `/auth/request-data-deletion` | Form RODO | brak |

---

## 3. Setup nowego środowiska deweloperskiego

### Wymagania

- Node.js 20+ (testowane na 24)
- Docker Desktop (dla `supabase start` — lokalny Postgres + Studio)
- Supabase CLI (`brew install supabase/tap/supabase`)
- Git + gh CLI (`brew install gh && gh auth login`)
- Opcjonalnie: psql (`brew install libpq` + dodaj do PATH)
- Opcjonalnie: Chrome (dla lokalnego PDF gen — `LOCAL_CHROME_PATH`)

### Kroki

```bash
# 1. Clone repo
git clone https://github.com/tkalla79/k2biznes-oferta ~/Code/k2biznes-oferta
cd ~/Code/k2biznes-oferta

# 2. Git author config (Vercel wymaga valid email)
git config --global user.email "t.kalla@k2biznes.pl"
git config --global user.name "Tomek Kalla"

# 3. Install dependencies
npm install

# 4. Lokalna baza (Docker wymagany)
npm run db:start
# Output → wpisz wartości do .env.local
cp .env.example .env.local
# Edytuj .env.local — wartości z supabase output

# 5. Reset DB + apply migrations + seed
npm run db:reset

# 6. Wygeneruj typy TypeScript z lokalnego schema
npm run db:types

# 7. Uruchom Next.js
npm run dev
# http://localhost:3000

# 8. Healthcheck
curl http://localhost:3000/api/health
```

### Prod environment (do operacji on production-DB)

Sekrety masz w **`~/Code/k2biznes-oferta/.env.production.local`** (gitignored). Jeśli brak — odtwórz z Bitwarden Secure Note "env.production.local" (folder "K2Biznes Oferta prod") lub z Vercel env vars (Settings → Environment Variables → "..." → Reveal).

Zawartość: patrz `.env.example` — to lista wymaganych zmiennych.

---

## 4. Deploy + redeploy

### Auto-deploy (standard)

Każdy push do `main` na GitHub triggeruje Vercel auto-deploy. Build zajmuje ~1-2 min. Status sprawdz:

```bash
gh api repos/tkalla79/k2biznes-oferta/deployments --jq '.[0]'
```

Po zielonym statusie nowy kod jest na https://oferta.k2biznes.pl.

### Manual redeploy (gdy zmienisz env vars w Vercel)

Vercel **NIE redeploys** automatycznie po zmianie env vars. Musisz zrobić ręcznie:

1. https://vercel.com/tomeks-projects-544a4978/k2biznes-oferta-web/deployments
2. Najnowszy deployment → **... → Redeploy**
3. **Odznacz "Use existing Build Cache"** jeśli zmieniłeś `NEXT_PUBLIC_*` (są inlinowane przy build)
4. **Redeploy** → czekaj 1-2 min

### Trigger redeploy bez UI

```bash
cd ~/Code/k2biznes-oferta
git commit --allow-empty -m "chore: trigger redeploy"
git push origin main
```

---

## 5. Migracje DB

**Pełen runbook:** `docs/RUNBOOK_MIGRATION_ROLLBACK.md` (pre-flight + scenariusze rollback A/B/C + template nowych tabel z grantami).

### Podstawowy flow

```bash
# 1. Nowy plik migration
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_opis_zmiany.sql

# 2. Test lokalnie
npm run db:reset  # apply na lokalnym Postgres
npm run dev       # smoke test

# 3a. Apply do prod — wariant CLI (wymaga supabase access tokena + DB password)
SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_DB_PASSWORD='...' \
  supabase db push --linked

# 4. Verify w Supabase Studio SQL Editor
# https://supabase.com/dashboard/project/yuyyejwnryuynbosqwwa/sql/new
```

**Wariant psql w transakcji (używany przy etapie 2 — pełna kontrola + atomowość).**
Gdy chcesz wykonać migrację + wpis śledzenia w jednej transakcji (np. DDL +
seed + ręczny insert do `supabase_migrations.schema_migrations`):

```bash
# ZAWSZE backup PRZED migracją
bash scripts/backup-db.sh

# psql z libpq (Homebrew); pooler session (5432), URI-format omija problem SCRAM
PSQL=/opt/homebrew/opt/libpq/bin/psql
DB_PASS=$(grep '^SUPABASE_DB_PASSWORD=' .env.production.local | cut -d= -f2-)
REF=$(grep '^SUPABASE_PROJECT_REF=' .env.production.local | cut -d= -f2-)
CONN="postgresql://postgres.$REF:$DB_PASS@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require"

"$PSQL" "$CONN" -v ON_ERROR_STOP=1 <<'SQL'
begin;
  -- ... DDL z pliku migracji ...
  insert into supabase_migrations.schema_migrations (version, name, statements)
  values ('<YYYYMMDDHHMMSS>', '<opis>', array['-- applied via psql']);
commit;
SQL
```

> Auto-mode (Claude Code) blokuje DDL na prod bez wyraźnej zgody usera — to
> celowe zabezpieczenie. Przy ręcznej migracji potwierdź operację świadomie.

**Pamiętaj** (od 30.10.2026): nowe tabele wymagają explicit `GRANT` per role (anon/authenticated/service_role). Template w `RUNBOOK_MIGRATION_ROLLBACK.md`.

---

## 6. Codzienne operacje

### Dodanie nowego usera (konsultant)

**Option A — przez UI:** `/admin/users` → kliknij **"Zaproś użytkownika"** → wypełnij formularz. Supabase wysyła invite email.

**Option B — przez Auth Admin API (skrypt):**

```bash
PROD_SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.production.local | cut -d= -f2-)
curl -X POST "https://yuyyejwnryuynbosqwwa.supabase.co/auth/v1/admin/users" \
  -H "apikey: $PROD_SRK" -H "Authorization: Bearer $PROD_SRK" \
  -H "Content-Type: application/json" \
  -d '{"email":"new@k2biznes.pl","password":"TempStart!","email_confirm":true,"app_metadata":{"role":"admin","provider":"email","providers":["email"]},"user_metadata":{"full_name":"Jan Kowalski"}}'
```

**Po utworzeniu** — uruchom w Supabase Studio SQL Editor (bypass triggera dla profiles.role):

```sql
alter table profiles disable trigger profiles_no_self_escalation;
update profiles set role='admin', full_name='Jan Kowalski' where email='new@k2biznes.pl';
alter table profiles enable trigger profiles_no_self_escalation;
```

### Zmiana roli usera

Zawsze aktualizuj **OBA pola** — JWT `app_metadata.role` ORAZ `profiles.role`. Aplikacja czyta z `profiles.role` (fetchUserRole w `lib/auth/session.ts`), ale niektóre RLS sprawdzają JWT.

```bash
# 1. JWT app_metadata.role
PROD_SRK=$(...)
USER_ID="<uuid>"
curl -X PUT "https://yuyyejwnryuynbosqwwa.supabase.co/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $PROD_SRK" -H "Authorization: Bearer $PROD_SRK" \
  -H "Content-Type: application/json" \
  -d '{"app_metadata":{"role":"super_admin","provider":"email","providers":["email"]}}'
```

```sql
-- 2. profiles.role (Studio SQL Editor)
alter table profiles disable trigger profiles_no_self_escalation;
update profiles set role='super_admin' where id='<uuid>';
alter table profiles enable trigger profiles_no_self_escalation;
```

Po zmianie user musi **wylogować się i zalogować ponownie** (role cache TTL 30s).

### Reset hasła (user zapomniał)

User klika **`/auth/forgot-password`** → wpisuje email → dostaje link recovery → klik link → nowe hasło. Aplikacja sama obsługuje przepływ.

**Manualny reset (jeśli user nie ma dostępu do maila):**

```bash
PROD_SRK=$(...)
USER_ID="<uuid>"
curl -X PUT "https://yuyyejwnryuynbosqwwa.supabase.co/auth/v1/admin/users/$USER_ID" \
  -H "apikey: $PROD_SRK" -H "Authorization: Bearer $PROD_SRK" \
  -H "Content-Type: application/json" \
  -d '{"password":"NewTempPassword2026!","email_confirm":true}'
```

Przekaż tymczasowe hasło out-of-band (Signal/Telegram), user zmieni przez `/auth/forgot-password` po pierwszym zalogowaniu.

### Dodanie/edycja programu / case study / osoby kontaktowej

Przez UI: `/admin/programs`, `/admin/case-studies`, `/admin/contact-persons`. Każda strona ma CRUD z formularzem.

### Edycja statystyk firmowych (etap 2)

`/admin/ustawienia` (super_admin) — kwota pozyskanego dofinansowania, liczba
projektów, „od kiedy". Zapisywane do `app_settings.company_stats`, render w
hero każdej oferty + sekcji „Dlaczego K2Biznes". **Zmiana propaguje na WSZYSTKIE
oferty** (dane firmowe, nie per-klient) bez redeployu. Edycja loguje audit
`settings.update`. Treści per-oferta (potrzeby, „dlaczego ten nabór", uwagi,
alt-programy) edytujesz w formularzu oferty (`/admin/offers/*`, sekcja „Treść
w ofercie"), nie tutaj.

### Biblioteka alt-programów i szablony oferty (etap 2)

- `/admin/alt-programs` — wspólna lista „innych możliwości wsparcia"; oferta
  może ją nadpisać per-rekord (`content.altPrograms`).
- `/admin/templates` — zapisane zestawy treści/ustawień do szybkiego startu
  nowej oferty.

### Regeneracja sekretów (rotacja co 90 dni)

`IP_HASH_SALT` powinien być rotowany co 90 dni per BACKEND_SPEC sekcja 11.7. Procedura:

```bash
# 1. Wygeneruj nowy salt
NEW_SALT=$(openssl rand -hex 32)
echo "Nowy salt: $NEW_SALT"

# 2. Dodaj do ip_hash_salts table (Studio SQL):
#    insert into ip_hash_salts (salt) values ('<NEW_SALT>');
#    Aplikacja uzywa najnowszy automatycznie.

# 3. Update Vercel env var IP_HASH_SALT (Production scope)
# 4. Redeploy
```

`PDF_BYPASS_SECRET`, `CRON_SECRET`, `WEBHOOK_HMAC_SECRET` można rotować tym samym sposobem, ale wymaga koordynacji z zewnętrznymi systemami (CRM webhooks).

---

## 7. Monitoring

### Sentry — error monitoring

- **Dashboard:** https://sentry.io/organizations/k2biznes/issues/
- **Limit free tier:** 5000 events/miesiąc (z PII scrubbing per BACKEND_SPEC 12.1)
- **Co alertuje:** Wszystkie 5xx errors, unhandled promise rejections, React error boundaries
- **PII scrubbing:** automatyczny — emaile, tokeny `/o/[REDACTED]`, query strings `?*token=`, JWT, cookies, frame.vars
- **Co sprawdzać codziennie:** lista nowych issues + frequency. Powtarzający się error = bug do fixa.

### UptimeRobot — uptime + uptime ping

- **Dashboard:** https://uptimerobot.com/dashboard
- **Monitor:** `https://oferta.k2biznes.pl/api/health` co 5 min
- **Alert:** email do Tomka gdy padnie
- **Bonus:** ping co 5 min zapobiega pauzie Supabase Free (7-day inactivity timeout)

### Supabase Dashboard

- **Logs:** https://supabase.com/dashboard/project/yuyyejwnryuynbosqwwa/logs/explorer
- **Metrics:** dashboard pokazuje CPU/memory/storage usage
- **Backups:** Database → Backups → daily snapshots (7 dni retention na Free)

### Vercel logs

- **Real-time:** https://vercel.com/tomeks-projects-544a4978/k2biznes-oferta-web/logs
- **Filter po digest:** gdy w UI zobaczysz "Application error: Digest: XXXXX" → filter w logach po tym digest
- **Function logs** mają stack traces dla server-side errors

---

## 8. Backup i recovery

**Pełny runbook:** `docs/BACKUP_RECOVERY.md`.

**Szybko:**
- **Kod** — `git push` (auto przy commit, zawsze)
- **DB** — `bash scripts/backup-db.sh` (tygodniowo)
- **Storage** — `bash scripts/backup-storage.sh` (miesięcznie)
- **Sekrety** — Bitwarden Secure Note "env.production.local" (folder "K2Biznes Oferta prod")

---

## 9. Lista aplikacji external

**Pełen inwentarz:** `docs/APPLICATIONS_INVENTORY.md`.

Quick list (login + URL panel):
- GitHub: https://github.com/tkalla79/k2biznes-oferta
- Supabase: https://supabase.com/dashboard/project/yuyyejwnryuynbosqwwa
- Vercel: https://vercel.com/tomeks-projects-544a4978/k2biznes-oferta-web
- Sentry: https://sentry.io/organizations/k2biznes
- Resend: https://resend.com/domains
- UptimeRobot: https://uptimerobot.com/dashboard
- Upstash: https://console.upstash.com
- CreaTech DNS: panel zarządzania DNS dla k2biznes.pl (apex)

---

## 10. Troubleshooting (top 10 znanych issues)

### 1. `/api/health` zwraca `db: false`

**Przyczyna:** Supabase project paused (Free tier po 7 dniach).
**Fix:** Dashboard Supabase → **Restore project**. Czekaj ~2-3 min. UptimeRobot powinien zapobiegać — sprawdz czy monitor działa.

### 2. `Application error: Digest: XXXXX` na ekranie

**Przyczyna:** Server-side exception w Next.js.
**Fix:** Vercel logs → filter po digest → zobacz stack trace. Najczęstsze: 1) zmiana schema bez aktualizacji kodu, 2) missing env var, 3) Supabase paused.

### 3. Reset hasła nie działa — user wraca na signin

**Przyczyna:** Recovery link nie ma `?next=/auth/reset-password` (przeszło przez /auth/callback?) lub session cookies się nie zapisały.
**Fix:** Sprawdz `forgot-password/route.ts` linia z `redirectTo` — powinno być `${baseUrl}/auth/callback?next=${encodeURIComponent('/auth/reset-password')}`. Sprawdz Site URL w Supabase Auth settings.

### 4. Email z Resend nie dochodzi

**Przyczyny:** 1) Domena `k2biznes.pl` nie verified w Resend, 2) DKIM/SPF nie propagated, 3) Free tier limit 3000/mc wyczerpany.
**Fix:** https://resend.com/domains → verify domain. https://resend.com/emails → sprawdz log konkretnego maila + status delivery.

### 5. MFA verify zawsze fail (kod TOTP odrzucony)

**Przyczyny:** 1) Czas urządzenia desync (TOTP toleruje ±30s), 2) factor został unenrolled, 3) brute-force lockout z rate-limit `signin` bucket.
**Fix:** Sync czas (System Settings → Date & Time → Set automatically). Jeśli factor zgubiony — admin może unenroll przez `/auth/api/mfa/unenroll`, user setup-uje od nowa.

### 6. Vercel deploy fail: "GitHub could not associate the committer"

**Przyczyna:** git author email nie matchuje GitHub account (np. local `k2_tomek@Tomek.local`).
**Fix:** `git config --global user.email "t.kalla@k2biznes.pl"` + nowy commit + push. Auto-deploy zadziała.

### 7. Migracja `supabase db push` fail z password auth

**Przyczyna:** DB password w `.env.production.local` nieaktualny (zresetowany przez Tomka w Studio).
**Fix:** Supabase Dashboard → Settings → Database → Reset password → kopiuj → update `.env.production.local`.

### 8. PDF download zwraca 503 / "Application error"

**Przyczyna:** Vercel Hobby 10s function timeout — Chromium cold start (~15s) nie mieści się.
**Fix:** Przycisk PDF jest ukryty w UI od PR #28. Klient korzysta z browser print (Cmd+P → Zapisz jako PDF). Re-enable po upgrade Vercel Pro.

### 9. `requireAdmin()` zwraca 403 mimo poprawnego JWT

**Przyczyna:** `profiles.role` nie matchuje JWT `app_metadata.role`. Aplikacja czyta z profiles, nie z JWT.
**Fix:** Zaktualizuj OBA (patrz sekcja 6 — Codzienne operacje → Zmiana roli usera).

### 10. Rate limit 429 dla legit usera

**Przyczyny:** 1) User za NAT-em z innymi userami (office IP), 2) ten sam IP wyczerpał bucket dla innego endpointa (cross-endpoint share — fixed w PR #29).
**Fix:** Sprawdz `lib/rate-limit.ts` config bucketów. Dla legit lockout — manualnie wyzeruj key w Upstash console.

### 11. Email do klienta nie dochodzi — „You can only send testing emails to your own email address"

**Symptom (case 2026-07-03):** oferta ma status `sent`, na liście marker „⚠ email nie dotarł"; od tego czasu też czerwony komunikat od razu przy wysyłce. W `offer_events` (`type=email_sent`) payload zawiera błąd Resend jw.
**Przyczyna:** `RESEND_API_KEY` na Vercel pochodzi z konta Resend **bez zweryfikowanej domeny** (tryb sandbox — wysyłka tylko na adres właściciela konta). DNS domeny może być OK — liczy się konto, do którego należy klucz.
**Diagnoza:** `/admin/ustawienia` → „Test wysyłki email" na adres inny niż właściciel konta; pokaże surowy błąd Resend. DNS: `dig +short TXT resend._domainkey.k2biznes.pl` (musi zwrócić klucz DKIM).
**Fix:** Vercel → Settings → Environment Variables → `RESEND_API_KEY` (Production) → wklej klucz z konta ze zweryfikowaną domeną (`.env.production.local` trzyma właściwy) → Redeploy → test przyciskiem jw. → wyślij ofertę ponownie (marker zniknie po udanej wysyłce).
**Monitoring:** każda nieudana wysyłka trafia do Sentry (`[email] send failed: …`).

---

## 11. Eskalacja

| Problem | Kontakt |
|---|---|
| Supabase down / DB lost | Supabase Support (Free: 24h response) |
| Vercel deploy broken | Vercel Discord / dashboard support chat |
| Resend nie wysyła | Resend support@resend.com |
| Sentry blocked | https://sentry.io/contact/support/ |
| Wszystko inne | Tomek: `t.kalla@k2biznes.pl` |

---

## 12. Powiązane dokumenty

- **`docs/BACKEND_SPEC.md`** — pełna specyfikacja techniczna (1664 linie, v1.1.1)
- **`docs/BACKUP_RECOVERY.md`** — runbook backup + recovery + skrypty
- **`docs/APPLICATIONS_INVENTORY.md`** — pełen inwentarz external services
- **`docs/PROD_SETUP.md`** — runbook od-zera-setup produkcji (8 etapów)
- **`docs/RUNBOOK_MIGRATION_ROLLBACK.md`** — migracje DB + scenariusze rollback
- **`docs/CODE_REVIEW_HANDOFF.md`** — onboarding code reviewera
- **`docs/TESTER_HANDOFF.md`** — instrukcja testera
- **`docs/GDPR_REVIEW_BRIEF.md`** — historia review RODO
- **`docs/FRONTEND_POLISH_BACKLOG.md`** — backlog UX
- **`docs/PLANY_ROZWOJU.md`** — backlog post-MVP

**README.md** w root — quickstart + stack overview.
