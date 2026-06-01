# Inwentarz aplikacji — K2Biznes Oferta

Pełna lista zewnętrznych usług które tworzą produkcję `oferta.k2biznes.pl`.
Dla każdej: do czego służy, jak się zalogować, gdzie szukać w razie awarii,
co przestaje działać jak padnie, jak rotować klucze.

**Aktualizacja:** 2026-05-29
**Audience:** tech-admin (Tomek + przyszli devs)

---

## Spis treści

1. [GitHub](#1-github) — repo + backup kodu
2. [Supabase Cloud](#2-supabase-cloud) — DB + Auth + Storage
3. [Vercel](#3-vercel) — hosting + serverless functions
4. [Resend](#4-resend) — transactional email
5. [Sentry](#5-sentry) — error monitoring
6. [UptimeRobot](#6-uptimerobot) — uptime monitoring
7. [Upstash Redis](#7-upstash-redis) — rate-limit store
8. [CreaTech.pl DNS](#8-createchpl-dns) — DNS apex `k2biznes.pl`
9. [Vercel DNS / CNAME](#9-vercel-dns--cname) — subdomena `oferta.k2biznes.pl`
10. [Bitwarden](#10-bitwarden) — secrets vault

---

## 1. GitHub

| Pole | Wartość |
|---|---|
| **URL** | https://github.com/tkalla79/k2biznes-oferta |
| **Account** | tkalla79 (Tomek prywatny) |
| **Plan** | Free |
| **Limity** | 500MB storage, unlimited public repos |
| **Login** | przez SSO Google albo email + hasło + 2FA (passkey) |

**Do czego służy:**
- Backup kodu (jedyny remote — single source of truth)
- Code review przez PRs
- Issue tracking (nie używamy aktywnie — planowanie w `docs/PLANY_ROZWOJU.md`)
- Trigger Vercel auto-deploy z push do `main`

**Co przestaje działać jak padnie:**
- Brak push/pull — kod jest na lokalnym dysku, więc operacyjnie nic
- Vercel auto-deploy z `main` przestaje działać → manual deploy z CLI
- Brak collaboration z innymi devami

**Backup planu:** gdyby GitHub padł całkowicie — `git push` do drugiego remote (GitLab/Bitbucket). Setup w 5 min.

**Kontakt support:** https://support.github.com (response ~24h Free tier)

**Rotacja:** SSH key co 12 mies., personal access token tylko on-demand (nie używamy stałego).

---

## 2. Supabase Cloud

| Pole | Wartość |
|---|---|
| **URL** | https://supabase.com/dashboard/project/yuyyejwnryuynbosqwwa |
| **Project ref** | `yuyyejwnryuynbosqwwa` |
| **Region** | eu-central-1 (Frankfurt) |
| **Plan** | Free |
| **Limity** | 500MB DB, 1GB storage, 50k MAU, **pauses po 7 dniach bez ruchu** |
| **Login** | t.kalla@k2biznes.pl + Google SSO + MFA |

**Do czego służy:**
- **Postgres 17** — wszystkie tabele (offers, programs, case_studies, profiles, gdpr_clauses, audit_logs etc.)
- **Auth** — login users (PKCE flow), JWT z `app_metadata.role`
- **Storage** — bucket `public-uploads` (logo, photo do case-studies)
- **Edge Functions** (nie używane yet)
- **Realtime** (nie używane yet)

**Co przestaje działać jak padnie:**
- Cała aplikacja (API + frontend zależą od DB query)
- `/api/health` → 500
- Storage URLs → 404 dla logo/photo
- Login niemożliwy

**Free tier risk: pauza po 7 dniach inactivity.**
Jeśli przez tydzień nikt nie odwiedził `oferta.k2biznes.pl` → projekt zapauzuje się automatycznie.
Restore: Dashboard → Settings → "Restore project" (instant).
Mitygacja: UptimeRobot ping na `/api/health` co 5 min trzyma to aktywne.

**Backup planu:** patrz [docs/BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) sekcja 3.2 (3 opcje restore).

**Kontakt support:** Dashboard → Help → Submit ticket (Free tier ~24h response)

**Rotacja:**
- `SUPABASE_DB_PASSWORD` — Settings → Database → "Reset password" (co 6 mies. lub po wycieku)
- `SUPABASE_SERVICE_ROLE_KEY` — Settings → API → "Reset" (krytyczna; reset → upload do Vercel env + Bitwarden + redeploy)
- `SUPABASE_JWT_SECRET` — Settings → API → "Rotate JWT secret" (UWAGA: wyloguje wszystkich userów)

**Pooler vs direct connection:**
Backup-db.sh używa transaction pooler `aws-1-eu-central-1.pooler.supabase.com:5432`.
Direct connection `db.<ref>.supabase.co:5432` dostępny jak nie ma IPv6 (potrzebuje add-on $4/mc).

---

## 3. Vercel

| Pole | Wartość |
|---|---|
| **URL** | https://vercel.com/k2biznes/k2biznes-oferta-web |
| **Project** | `k2biznes-oferta-web` |
| **Team/scope** | `k2biznes` (Hobby — nie team plan) |
| **Plan** | Hobby |
| **Limity** | 100GB bandwidth/mc, **10s function timeout**, 1GB serverless function size, 1000 build minutes/mc |
| **Login** | t.kalla@k2biznes.pl + GitHub SSO |

**Do czego służy:**
- Hosting Next.js (SSR + ISR)
- Serverless API routes (`/api/*`)
- Static assets + image optimization
- Cron jobs (Hobby ma 2 dziennie, używamy 1 — pause-snapshot)
- Domain management dla `oferta.k2biznes.pl`

**Co przestaje działać jak padnie:**
- Cała strona unavailable
- API routes 503
- UptimeRobot pinguje 5xx → email alert

**Env vars (gdzie):**
Vercel Dashboard → Project → Settings → Environment Variables → Production scope.
Wszystkie sekrety z `.env.example` muszą tam być (jak w lokalnym `.env.production.local`).

**Limit 10s function timeout — istotne:**
- API routes które robią pg_dump albo długie sumaryzacje LLM nie mieszczą się
- Workaround: cron + background process albo upgrade Pro

**Kontakt support:** dashboard → "?" → Submit ticket (Hobby ~3 dni)

**Rotacja:** vercel tokens (nie używamy stałych). Jedyne stałe credentials → Personal Access Token w Bitwarden (jeśli istnieje).

---

## 4. Resend

| Pole | Wartość |
|---|---|
| **URL** | https://resend.com/domains |
| **Account** | t.kalla@k2biznes.pl |
| **Domain** | `k2biznes.pl` ✅ verified (2026-06-01, region EU) |
| **Plan** | Free |
| **Limity** | 3000 emails/mc, 100/dzień |
| **Sender** | `K2Biznes <oferty@k2biznes.pl>` (env `EMAIL_FROM`) |

**Do czego służy:**
- Transactional email z `oferty@k2biznes.pl`:
  - Oferta wysłana do klienta (`OfferSentToClient`)
  - Notyfikacja konsultanta po accept/reject (`OfferAcceptedConsultant`, `OfferRejectedConsultant`)
  - Reset password (Supabase Auth → Resend)
  - GDPR notification "Twoje dane zostały usunięte"
  - GDPR clause updates (kiedy zmienia się version)

**DNS rekordy ustawione w CreaTech panel DNS (2026-06-01):**
| Type | Name | Content | Priority |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDZm0...IDAQAB` (DKIM key) | — |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | — |

Wszystkie 3 records na subdomenie `send.k2biznes.pl` — nie kolidują z M365 SPF/MX na apex `k2biznes.pl`.

**Historia:** do 2026-06-01 wszystkie maile szły z `onboarding@resend.dev` (fallback Resend sandbox) bo domena była dodana ale nie verified. Naprawione przez dodanie 3 records DNS w CreaTech panel.

**Co przestaje działać jak padnie:**
- Reset password niemożliwy
- GDPR notifications nie chodzą
- Trzeba ręcznie informować userów

**Kontakt support:** Resend dashboard → chat (response ~kilka godzin)

**Rotacja:** `RESEND_API_KEY` — dashboard → API Keys → "Roll" (co 6 mies. + update Vercel env + Bitwarden + redeploy)

---

## 5. Sentry

| Pole | Wartość |
|---|---|
| **URL** | https://k2biznes.sentry.io |
| **Org** | `k2biznes` |
| **Project** | `javascript-nextjs` |
| **Region** | EU |
| **Plan** | Free (Developer) |
| **Limity** | 5000 events/mc, 7 dni retention |

**Do czego służy:**
- Error tracking (JS + Node + Edge functions)
- PII scrubbing (lib/sentry-scrub.ts) — usuwa email, IP, JWT, hash przed wysłaniem
- Performance traces (10% sample)

**Co przestaje działać jak padnie:**
- Nic operacyjnie — aplikacja działa dalej
- Tracimy widoczność błędów → nie wiemy że coś się dzieje na produkcji

**Alerty:** Sentry email do `t.kalla@k2biznes.pl` kiedy:
- Nowy issue
- Issue z > 100 events w 1h
- Spike detected

**Kontakt support:** dashboard → "?" → Help center

**Rotacja:** `NEXT_PUBLIC_SENTRY_DSN` — publiczny, więc rotacja nieistotna. `SENTRY_AUTH_TOKEN` (do source map upload przy build) — Settings → Auth Tokens → "Create new" + revoke old (co 12 mies.)

---

## 6. UptimeRobot

| Pole | Wartość |
|---|---|
| **URL** | https://uptimerobot.com |
| **Account** | t.kalla@k2biznes.pl |
| **Plan** | Free |
| **Limity** | 50 monitors, 5min check interval, SMS notifications płatne |

**Do czego służy:**
- HTTP ping co 5 min na https://oferta.k2biznes.pl/api/health
- Email alert do `t.kalla@k2biznes.pl` kiedy:
  - HTTP 5xx 2 razy z rzędu (downtime detected)
  - Response time > 10s (degraded)
- Trzymanie Supabase aktywnego (pseudo-keepalive, prevent 7-day pause)

**Co przestaje działać jak padnie:**
- Brak alertów uptime → możemy nie zauważyć downtime
- Brak keepalive → Supabase może się zapauzować

**Backup planu:** secondary monitor np. Better Uptime (free 10 monitors) jako overlay.

**Kontakt support:** uptimerobot.com → contact (Free tier email only)

**Rotacja:** N/A — read-only public endpoint.

---

## 7. Upstash Redis

| Pole | Wartość |
|---|---|
| **URL** | https://console.upstash.com |
| **Account** | t.kalla@k2biznes.pl |
| **Region** | eu-central-1 (Frankfurt) |
| **Plan** | Free |
| **Limity** | 10k commands/dzień, 256MB storage |

**Do czego służy:**
- Rate-limit store dla auth endpoints (login, forgot-password, request-data-deletion)
- Bucket per IP + endpoint (np. `rl:login:hash(ip)` → counter z TTL 60s)
- Per BACKEND_SPEC sekcja 9.3

**Co przestaje działać jak padnie:**
- Rate-limit przestaje działać → endpoints są podatne na brute-force
- Aplikacja DALEJ działa (fallback w `lib/rate-limit.ts` → in-memory Map, ale per-instance Vercel)
- Krótkoterminowo OK, ale na dłuższą metę security risk

**Kontakt support:** dashboard → chat (Free tier ~24h)

**Rotacja:** `RATE_LIMIT_REDIS_TOKEN` — dashboard → Details → "Reset Token" (co 12 mies.). Jeśli zmieniany — update Vercel env + Bitwarden + redeploy.

---

## 8. CreaTech.pl DNS

| Pole | Wartość |
|---|---|
| **URL** | https://panel.createch.pl |
| **Account** | t.kalla@k2biznes.pl + hasło + 2FA |
| **Domain** | `k2biznes.pl` apex (registar + DNS) |

**Do czego służy:**
- DNS rekordy apex `k2biznes.pl`:
  - `A` rekord do CMS (firmowa strona — NIE Oferta)
  - `MX` do Microsoft 365 (email)
  - `TXT` DKIM Resend (`resend._domainkey`) → patrz sekcja 4 Resend
  - `MX` `send` (Resend bounces → `feedback-smtp.eu-west-1.amazonses.com`)
  - `TXT` `send` (Resend SPF: `v=spf1 include:amazonses.com ~all`)
  - `CNAME` `oferta` → `cname.vercel-dns.com` (Vercel)
- Registar (renewal co 12 mies. — set auto-renew!)

**Co przestaje działać jak padnie:**
- Cała domena `k2biznes.pl` (firmowa strona + email + oferta)
- KRYTYCZNE — wszystko zatrzymane

**Backup planu:** secondary nameservers (Cloudflare jako overlay) — TODO, na razie nie ma.

**Kontakt support:** CreaTech BOK +48 (numeryw w panelu)

**Rotacja:** account password co 6 mies.

---

## 9. Vercel DNS / CNAME

Subdomena `oferta.k2biznes.pl` jest delegowana do Vercel przez CNAME w panelu CreaTech (patrz sekcja 8).

Vercel autom. zarządza SSL przez Let's Encrypt — bez akcji z naszej strony, certyfikat odnawia się sam.

**Verify SSL:**
```bash
openssl s_client -connect oferta.k2biznes.pl:443 -servername oferta.k2biznes.pl 2>/dev/null | openssl x509 -noout -dates
# notAfter powinno być w przyszłości
```

Jeśli cert wygasł albo CNAME zniknął:
1. Vercel dashboard → Project → Settings → Domains → sprawdz status `oferta.k2biznes.pl`
2. Jeśli "Invalid configuration" — sprawdz CNAME w CreaTech panel DNS
3. Po fix Vercel zrenewuje cert automat. w ~5 min

---

## 10. Bitwarden

| Pole | Wartość |
|---|---|
| **URL** | https://vault.bitwarden.com (web) + Edge extension + iOS app |
| **Account** | t.kalla@k2biznes.pl + master password + 2FA (TOTP) |
| **Folder** | "K2Biznes Oferta prod" |
| **Plan** | Free (unlimited items, sync cross-device, browser extension — wszystko czego potrzebujemy) |

**Do czego służy:**
- Vault dla wszystkich produkcyjnych sekretów (`.env.production.local` jako Secure Note)
- Backup login credentials do każdej usługi z tej listy (Supabase, Vercel, Resend, Sentry, UptimeRobot, Upstash, CreaTech DNS, GitHub)
- Recovery passphrases + 2FA backup codes
- Autofill loginów w Edge (przez Bitwarden extension)

**Co MUSI być w vault** (per [docs/BACKUP_RECOVERY.md](BACKUP_RECOVERY.md) sekcja 2.4):
- Secure Note "env.production.local" — pełna zawartość pliku
- Login items dla każdego z 9 zewnętrznych services (sekcje 1-9 wyżej) z polami: URL, username, password, TOTP secret, recovery codes
- Master password do samego Bitwarden — **NIE w pliku, tylko w głowie + na kartce w bezpiecznym miejscu fizycznym** (szuflada w domu / sejf)

**Co przestaje działać jak padnie:**
- Brak dostępu do sekretów → impossible recovery po katastrofie
- KRYTYCZNE — drugie miejsce backup sekretów = Vercel env vars (read-only po wpisaniu, ograniczone do env aplikacji — bez master passwords do services)

**Backup planu:**
- Bitwarden **Emergency Access** (Free): wskaż zaufaną osobę która po Twoim incydencie + grace period (np. 7 dni) dostanie read-only access do vaultu. Konfiguracja w Settings → Emergency Access.
- **Export vault** raz na pół roku: Web vault → Tools → Export vault → format JSON encrypted → upload do OneDrive lub szyfrowany zip na pendrive w szufladzie. Hasło do exportu = master password Bitwarden (więc bezpieczne nawet jak OneDrive zostanie skompromitowany).

**Kontakt support:** https://bitwarden.com/contact (Free tier — community + docs, response ~48h)

**Rotacja:** master password co 12 mies. + 2FA recovery codes wydrukowane offline.

**Dlaczego Bitwarden a nie 1Password:** free unlimited (1Password wymaga sub), open-source (audytowane), cross-platform, łatwy sharing jak dojdzie 2gi dev (Team plan $1/user/mc).

---

## Cheatsheet — szybki dostęp

| Co | Gdzie kliknąć |
|---|---|
| Zobaczyć błąd w prod | https://k2biznes.sentry.io/issues |
| Sprawdzić uptime | https://uptimerobot.com/dashboard |
| Zobaczyć logi Vercel | https://vercel.com/k2biznes/k2biznes-oferta-web/logs |
| Zobaczyć logi Supabase | https://supabase.com/dashboard/project/yuyyejwnryuynbosqwwa/logs |
| Dodać/zmienić env var | https://vercel.com/k2biznes/k2biznes-oferta-web/settings/environment-variables |
| Resztę | patrz tabela w odpowiedniej sekcji wyżej |

---

## Audyt — czy wszystko działa

Raz na kwartał odpalić checklistę:

```bash
# 1. Domain + SSL
curl -I https://oferta.k2biznes.pl  # HTTP 200
openssl s_client -connect oferta.k2biznes.pl:443 -servername oferta.k2biznes.pl 2>/dev/null | openssl x509 -noout -dates

# 2. /api/health
curl https://oferta.k2biznes.pl/api/health  # {"ok":true, "db":{"ok":true}}

# 3. Supabase active (nie paused)
#    Sprawdz Dashboard → Status: "Healthy"

# 4. UptimeRobot zielony
#    Sprawdz Dashboard → "oferta.k2biznes.pl" = green

# 5. DKIM/SPF Resend (3 records na subdomenie send.)
dig TXT resend._domainkey.k2biznes.pl  # DKIM (p=MIGf...)
dig MX  send.k2biznes.pl               # 10 feedback-smtp.eu-west-1.amazonses.com
dig TXT send.k2biznes.pl               # v=spf1 include:amazonses.com ~all

# 6. Sentry events ostatnie 7 dni
#    Sprawdz Dashboard → Issues — nie ma nowych ze score > medium

# 7. Vercel env vars zgodne z Bitwarden
#    Manual compare — sprawdz że secret hash w Bitwarden = secret hash w Vercel
```
