# Production setup runbook — K2Biznes Oferta

> **STATUS (2026-05-29):** wszystkie etapy 1-8 done. Produkcja live na https://oferta.k2biznes.pl.
> Ten dokument zachowany jako historia (kroki initial setup). Do **on-going operations**
> używaj **[TECH_ADMIN_MANUAL.md](TECH_ADMIN_MANUAL.md)** + **[BACKUP_RECOVERY.md](BACKUP_RECOVERY.md)**.

---

Krok-po-kroku przygotowania produkcji. Decyzje (2026-05-06):

- **Domena prod:** `oferta.k2biznes.pl`
- **Supabase:** nowy projekt prod (Free tier), oddzielny od stagingu (`oauucbhjkmuezytnqwuf`)
- **Vercel:** Hobby tier
- **Resend:** custom domena `k2biznes.pl` z DKIM/SPF (sender `oferty@k2biznes.pl`)

Staging zostaje na `k2biznes-oferta-web.vercel.app` jako sandbox.

---

## Etap 1 — Tomek: nowy Supabase project

1. https://supabase.com/dashboard → **New project**
2. Nazwa: `k2biznes-oferta-prod`
3. Region: **eu-central-1** (Frankfurt — najblizej PL, ten sam co staging)
4. DB password: wygeneruj losowe ~32 znaki, **zapisz w Bitwarden** (Secure Note "env.production.local", folder "K2Biznes Oferta prod")
5. Plan: **Free** (decyzja: bez PITR)
6. Kliknij **Create**, czekaj 1-2 min az project bedzie ready
7. **Skopiuj do mnie:**
   - Project ref (z URL — `xxx` w `https://xxx.supabase.co`)
   - Anon key (Settings → API → `anon` `public`)
   - Service role key (Settings → API → `service_role` `secret`)
   - JWT secret (Settings → API → JWT Settings → JWT Secret)
   - DB password (z kroku 4 — moge ja przechowac w env `.env.production.local` ktory jest w .gitignore)

> ⚠️ **Free tier pauzuje baze po 7 dniach inactivity.** Z >0 ofertami/tydzien nie problem. Jak zauwazysz pause — login do dashboardu wystarczy zeby unpause.

---

## Etap 2 — Claude: migracje + seed do prod

Po otrzymaniu credentials z Etapu 1:

```bash
# 1. Link nowy projekt
SUPABASE_ACCESS_TOKEN=sbp_xxx supabase link --project-ref <NEW_REF>

# 2. Push wszystkich 10 migracji
SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_DB_PASSWORD=<DB_PASS> \
  supabase db push --linked

# 3. Seed (5 segmentow pricingu, GDPR clause v1, IP_HASH_SALT)
psql "postgresql://postgres:<DB_PASS>@aws-1-eu-central-1.pooler.supabase.com:6543/postgres" \
  -f supabase/seed.sql

# Albo (gdy psql nie ma): zaladuj seed.sql przez Supabase Studio SQL Editor
```

Verification: `curl https://<NEW_REF>.supabase.co/rest/v1/pricing_segments?select=id -H "apikey: <ANON_KEY>"` → powinno zwrocic 5 segmentow.

---

## Etap 3 — Tomek: Resend domain

1. https://resend.com/domains → **Add Domain**
2. Wpisz: `k2biznes.pl`
3. Region: `eu-west-1` (Resend nie ma eu-central, ale to OK)
4. Resend pokaze **3-5 rekordow DNS** do dodania:
   - SPF (TXT — `@` zazwyczaj)
   - DKIM (TXT — 3× `resend._domainkey...`)
   - MX (opcjonalnie, dla otrzymywania bounces)
5. Zaloguj sie do panelu DNS K2 (cf? OVH? cokolwiek macie) → dodaj rekordy
6. W panelu Resend kliknij **Verify DNS Records** (potrzeba ~5 min az DNS sie propaguje)
7. Po werifyikacji: zmiana env var `EMAIL_FROM=K2Biznes <oferty@k2biznes.pl>` (ja zaktualizuje w Vercel env w Etapie 6)

> Free tier Resend: 3000 emaili/mc, 100/dziennie. Dla 50 ofert/mc to OK. Jak rosnie — Pro $20/mc.

---

## Etap 4 — Tomek: DNS dla custom domain Vercel

W panelu DNS K2 dodaj:

```
Type:     CNAME
Name:     oferta
Target:   cname.vercel-dns.com
TTL:      300 (5 min, mozna potem podniesc do 3600)
```

**NIE** dodawaj `oferta.k2biznes.pl` jako A-record — Vercel chce CNAME.

> Jak `oferta.k2biznes.pl` juz gdzies wskazuje (np. stara aplikacja), trzeba najpierw usunac stare rekordy. Jak `k2biznes.pl` apex jest u kogos innego (nie Cloudflare/OVH/...), to trzeba miec dostep tam, gdzie sa NS rekordy.

---

## Etap 5 — Tomek: Vercel custom domain

1. https://vercel.com/<team>/k2biznes-oferta-web → **Settings → Domains**
2. **Add** → wpisz `oferta.k2biznes.pl` → **Add**
3. Vercel sam zweryfikuje CNAME (z Etapu 4) i wystawi SSL cert (~1-2 min)
4. Zostaw rowniez `k2biznes-oferta-web.vercel.app` jako alias staging (alternatywnie usun jak nie chcesz)

---

## Etap 6 — Tomek: Vercel production env vars

W panelu Vercel: **Settings → Environment Variables**.

Wszystkie poprzednie env vars sa juz dla `Preview + Development` (staging). Trzeba dodac **nowe wartosci dla `Production`**:

```
# Supabase prod (z Etapu 1)
NEXT_PUBLIC_SUPABASE_URL=https://<NEW_REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<NEW_ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<NEW_SERVICE_ROLE_KEY>
SUPABASE_JWT_SECRET=<NEW_JWT_SECRET>

# App URL — production
NEXT_PUBLIC_APP_URL=https://oferta.k2biznes.pl

# Prod secrets (wygenerowane 2026-05-06, nie te ze stagingu!)
IP_HASH_SALT=15a76e567a8da0d624fb51426fd9833a107d38da94100ed41c8d03ff0da112b7
PDF_BYPASS_SECRET=c6f15a66b2d2a296c29c095c77ef47d784bc0955b9842844a7e1451314626622
CRON_SECRET=bb91ed9da62a9fd34e6a8d56965b3827eaea9330c9d013f10e52503ceb5feafa
WEBHOOK_HMAC_SECRET=3ccdecbc325b8c10c4539ea3e0c642925fed9e0e74d2456274602c50cf505932

# Email (Resend, po Etapie 3)
RESEND_API_KEY=<existing — jest w stagingu, mozna reuse>
EMAIL_FROM=K2Biznes <oferty@k2biznes.pl>
EMAIL_REPLY_TO=kontakt@k2biznes.pl

# Bootstrap
SUPER_ADMIN_EMAIL=t.kalla@k2biznes.pl

# Opcjonalne (jak juz uzywane w stagingu)
RATE_LIMIT_REDIS_URL=<reuse staging Upstash>
RATE_LIMIT_REDIS_TOKEN=<reuse>

# Prod-only — NIE ustawione dla Preview/Development
```

Po dodaniu env vars: **Redeploy** main z Vercel dashboard zeby `Production` wzielo nowe zmienne.

---

## Etap 7 — Tomek: bootstrap super_admin w prod

Po pierwszym deploy z prod-DB:

1. Wejdz na https://oferta.k2biznes.pl/auth/signin
2. Kliknij "Wyslij magic link" → wpisz `t.kalla@k2biznes.pl`
3. Sprawdz mail → kliknij link → pierwsza sesja
4. Otworz Supabase Studio (nowy prod) → SQL Editor:
   ```sql
   update profiles set role = 'super_admin'
     where email = 't.kalla@k2biznes.pl';
   ```
5. Set JWT claim (zeby role byla w tokenie):
   ```bash
   USER_ID=$(curl -s "https://<NEW_REF>.supabase.co/auth/v1/admin/users" \
     -H "apikey: <SERVICE_ROLE_KEY>" \
     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
     | jq -r '.users[] | select(.email=="t.kalla@k2biznes.pl") | .id')

   curl -X PUT "https://<NEW_REF>.supabase.co/auth/v1/admin/users/$USER_ID" \
     -H "apikey: <SERVICE_ROLE_KEY>" \
     -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
     -H "Content-Type: application/json" \
     -d '{"app_metadata":{"role":"super_admin"}}'
   ```
6. Wyloguj sie z aplikacji → zaloguj ponownie (zeby JWT odswiezyl claim)
7. Powinienes widziec dashboard z menu admina (Programy/Case studies/Osoby kontaktowe/FAQ/Uzytkownicy/RODO)

---

## Etap 8 — Smoke test prod

Jak prod-domena dziala:

1. **Login flow:** `/auth/signin` → email → klik magic link → MFA setup → dashboard
2. **Stworz pierwsza oferte:** `/admin/offers/new` → wypelnij → save
3. **Wyslij oferte:** "Wyslij oferte" → twoj prywatny mail → sprawdz ze przyszlo z `oferty@k2biznes.pl`
4. **Akcept jako klient:** otworz link w incognito → akceptuj → status zmienia sie na `accepted`
5. **PDF download:** klik "PDF" w topnav `/o/[token]` → musi zwrocic plik (nie 503)

Jakikolwiek z nich pada → debugujemy.

---

## Sprawy do zalatwienia po prod-launch

(referencja do `PLANY_ROZWOJU.md` i pozostalych pkt z TodoWrite)

- Konta dla 3-5 konsultantow (admin invite)
- Dodanie realnych case studies
- Update osoby kontaktowe per konsultant
- Audyt katalogu programow 2026
- GDPR clause review przez radce prawnego
- Fala 3: Sentry, UptimeRobot, reset hasla UI, upload logo/photo
