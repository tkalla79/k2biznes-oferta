# Backup i recovery — K2Biznes Oferta

Procedury kopii zapasowych i odzyskiwania po katastrofie (utrata laptopa,
prod-DB lost, bucket storage usunięty, sekrety utracone).

**Aktualizacja:** 2026-05-28

---

## 1. Co backupujemy + częstotliwość

| Element | Częstotliwość | Sposób | Lokalizacja kopii |
|---|---|---|---|
| **Kod (repo)** | Automat. przy każdym commit | `git push origin main` | github.com/tkalla79/k2biznes-oferta |
| **Prod DB** | Tygodniowo (Pn rano) | `bash scripts/backup-db.sh` | `~/Backups/k2biznes-oferta/db/YYYY-MM-DD.sql.gz` |
| **Storage bucket** | Miesięcznie (1. każdego mies.) | `bash scripts/backup-storage.sh` | `~/Backups/k2biznes-oferta/storage/YYYY-MM-DD/` |
| **Sekrety (.env.production.local)** | Po każdej zmianie | Manualnie do 1Password | 1Password Secure Note "K2Biznes Oferta prod credentials" |
| **GDPR clauses + spec** | Wersjonowane w DB | Automat. (zachowane w `gdpr_clauses` per version) | Prod DB + GitHub (`docs/BACKEND_SPEC.md`) |

**Dodatkowo (automatycznie, bez naszej akcji):**
- Supabase Free **daily snapshot** z retencją 7 dni (NIE PITR — tylko snapshot z północy)
- GitHub przechowuje pełną historię repo + branches

---

## 2. Backup procedures

### 2.1. Kod — git push

```bash
cd ~/Code/k2biznes-oferta
git status                    # → "working tree clean"
git log origin/main..HEAD     # → empty (nic nie wisi unpushed)
```

Jeśli coś wisi:
```bash
git add -A
git commit -m "wip: backup checkpoint"
git push origin main
```

**Verify:** https://github.com/tkalla79/k2biznes-oferta — `pushedAt` w prawym górnym rogu = teraz.

### 2.2. DB dump — pg_dump przez pooler

**Co tydzień (Pn rano, ~30 sek roboty):**

```bash
cd ~/Code/k2biznes-oferta
bash scripts/backup-db.sh
```

Skrypt:
1. Czyta `SUPABASE_DB_PASSWORD` + `SUPABASE_PROJECT_REF` z `.env.production.local`
2. `pg_dump` przez pooler `aws-1-eu-central-1.pooler.supabase.com:5432`
3. Gzip → `~/Backups/k2biznes-oferta/db/YYYY-MM-DD-HHMM-db.sql.gz`
4. Output: ścieżka do utworzonego pliku + size

**Verify:**
```bash
ls -lah ~/Backups/k2biznes-oferta/db/ | tail -3
# Sprawdz że nowy plik jest > 50KB (prod ma 14 tabel z danymi)
```

Trzymaj ostatnie 4 tygodnie + 1 miesięczny (np. 1. dnia). Reszta do skasowania.

### 2.3. Storage bucket — wszystkie obrazy

**Co miesiąc (1. dzień miesiąca, ~1-3 min):**

```bash
cd ~/Code/k2biznes-oferta
bash scripts/backup-storage.sh
```

Skrypt:
1. Czyta `SUPABASE_SERVICE_ROLE_KEY` z `.env.production.local`
2. Lista wszystkich plików w bucket `public-uploads` (case-studies/, contact-persons/, programs/)
3. Pobiera każdy do `~/Backups/k2biznes-oferta/storage/YYYY-MM-DD/<folder>/<file>`
4. Output: count + total size

**Verify:**
```bash
ls -la ~/Backups/k2biznes-oferta/storage/ | tail -3
# Sprawdz że folder z dzisiejszą datą istnieje + ma > 0 plików
find ~/Backups/k2biznes-oferta/storage/$(date +%Y-%m-%d) -type f | wc -l
```

### 2.4. Sekrety — `.env.production.local` w 1Password

**Po każdej zmianie:**
1. Otwórz 1Password → znajdź item "K2Biznes Oferta prod credentials" (typ: Secure Note)
2. Zaktualizuj treść — wklej całą zawartość pliku `.env.production.local`
3. Zapisz

**Lista sekretów które MUSZĄ być w 1Password:**
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public, dla referencji)
- `SUPABASE_SERVICE_ROLE_KEY` (krytyczny — admin DB access)
- `SUPABASE_JWT_SECRET`
- `SUPABASE_DB_PASSWORD` (krytyczny — wymagany dla pg_dump + migracji)
- `SUPABASE_PROJECT_REF`
- `IP_HASH_SALT` (32 hex bytes, rotacja co 90 dni)
- `PDF_BYPASS_SECRET`
- `CRON_SECRET`
- `WEBHOOK_HMAC_SECRET`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_SENTRY_DSN`
- (jeśli używane) `RATE_LIMIT_REDIS_URL` + `RATE_LIMIT_REDIS_TOKEN` (Upstash)

**Wszystkie te sekrety są też w Vercel** (Production scope env vars) — drugie miejsce backup, ale 1Password jest twoim primary.

**Rotacja `IP_HASH_SALT` (co 90 dni):**
```bash
NEW_SALT=$(openssl rand -hex 32)
echo "Nowy salt: $NEW_SALT"
# 1. Wstaw do prod DB:
#    insert into ip_hash_salts (salt) values ('<NEW_SALT>');
# 2. Update Vercel env IP_HASH_SALT (Production scope)
# 3. Update 1Password
# 4. Redeploy Vercel
```

---

## 3. Recovery procedures (katastrofa)

### Scenariusz 1: Utrata laptopa / nowy komputer

Zakładamy: GitHub repo żyje, prod-DB żyje, 1Password żyje.

```bash
# 1. Setup nowego kompa (~10 min)
brew install node git supabase/tap/supabase
brew install libpq && echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
brew install gh && gh auth login

# 2. Clone repo
mkdir -p ~/Code && cd ~/Code
git clone https://github.com/tkalla79/k2biznes-oferta
cd k2biznes-oferta
npm install

# 3. Git config (Vercel wymaga valid email)
git config --global user.email "t.kalla@k2biznes.pl"
git config --global user.name "Tomek Kalla"

# 4. Sekrety — pobierz z 1Password
#    Otwórz 1Password → "K2Biznes Oferta prod credentials" → kopiuj zawartość
#    Wklej do .env.production.local (gitignored)

# 5. Skopiuj memory Claude Code z innego źródła (jeśli masz w iCloud)
#    Albo backup ~/.claude/projects/-Users-k2-tomek-Library-CloudStorage-...

# 6. Smoke test
curl https://oferta.k2biznes.pl/api/health
# → "ok":true, "db":{"ok":true}
```

### Scenariusz 2: Prod-DB padła / dane utracone

Trzy opcje, w kolejności preferencji:

**Opcja A — Restore z Supabase daily snapshot (najlepsza, ostatnie 7 dni):**
1. Supabase Dashboard → Database → Backups → wybierz snapshot z najbliższej daty
2. Klik **Restore** → tworzy się **NOWY projekt** (NIE nadpisuje)
3. Skopiuj nowy `project_ref` z URL
4. Update env vars w Vercel (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)
5. Update `.env.production.local` lokalnie
6. Redeploy Vercel
7. Zweryfikuj że aplikacja działa
8. Po 24h obserwacji — skasuj stary projekt

**Opcja B — Restore z naszego `pg_dump` (skrypt `restore-db.sh`):**
1. Załóż nowy Supabase project (eu-central-1, Free)
2. Apply migracje:
   ```bash
   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_DB_PASSWORD='...' \
     supabase link --project-ref <nowy_ref>
   supabase db push --linked
   ```
3. Restore danych:
   ```bash
   bash scripts/restore-db.sh ~/Backups/k2biznes-oferta/db/YYYY-MM-DD-db.sql.gz
   ```
4. Krok 4-7 jak w Opcji A

**Opcja C — Supabase support ticket (ostatnia szansa, ~24h):**
1. https://supabase.com/dashboard → Help → Submit ticket
2. Opisz: "Production DB corrupted/lost, project ref `yuyyejwnryuynbosqwwa`"
3. Czekaj 24h response (Free tier priority)

### Scenariusz 3: Storage bucket pusty / pliki utracone

```bash
# 1. Bucket powinien dalej istnieć w prod (RLS + config zachowane przez migracje)
#    Verify:
curl -s "https://yuyyejwnryuynbosqwwa.supabase.co/storage/v1/bucket/public-uploads" \
  -H "apikey: $PROD_SRK" -H "Authorization: Bearer $PROD_SRK"

# 2. Upload zaplikowanych plików z backupu
#    Skrypt restore-storage.sh (do napisania jeśli się przyda)
#    Albo manualnie przez Supabase Studio → Storage → Upload
```

Pliki w `~/Backups/k2biznes-oferta/storage/YYYY-MM-DD/`. Zachowana struktura folderów (case-studies/, contact-persons/, programs/).

### Scenariusz 4: Utrata 1Password / sekretów

**Sekrety które MOŻNA odtworzyć z Vercel:**
- Wszystkie env vars w Vercel Settings → Environment Variables → "..." → Reveal Value

**Sekrety które TRZEBA wygenerować od nowa (rotacja):**
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Settings → API → "Reset key"
- `SUPABASE_DB_PASSWORD` — Settings → Database → "Reset password"
- `IP_HASH_SALT` / `PDF_BYPASS_SECRET` / `CRON_SECRET` / `WEBHOOK_HMAC_SECRET` — `openssl rand -hex 32` + update env

Po każdej rotacji: update Vercel env vars + redeploy.

---

## 4. Backup verification (raz na kwartał)

Symulacja restore żeby upewnić się że backupy działają:

```bash
# 1. Restore latest dump na lokalny Supabase
supabase start
gunzip -c ~/Backups/k2biznes-oferta/db/$(ls ~/Backups/k2biznes-oferta/db/ | tail -1) | \
  psql "postgres://postgres:postgres@localhost:54322/postgres"

# 2. Smoke test lokalnie
npm run dev
curl http://localhost:3000/api/health
# Otwórz /admin → zaloguj się testowym kontem → sprawdz że dane są
```

Jeśli dane są — backup działa. Jeśli błędy — fix `backup-db.sh` zanim potrzebny będzie prawdziwy restore.

---

## 5. Cheatsheet — Komendy szybkie

```bash
# Codzienne: status repo
cd ~/Code/k2biznes-oferta && git status

# Tygodniowe: DB backup
bash scripts/backup-db.sh

# Miesięczne: storage backup
bash scripts/backup-storage.sh

# On-demand: pełny backup wszystkiego (przed ryzykowną zmianą)
bash scripts/backup-db.sh && bash scripts/backup-storage.sh && git push origin main

# Verify ostatni DB backup
ls -lah ~/Backups/k2biznes-oferta/db/ | tail -3

# Verify że Vercel env vars są aktualne
gh api repos/tkalla79/k2biznes-oferta/deployments --jq '.[0]'

# Rotacja IP_HASH_SALT (co 90 dni)
openssl rand -hex 32
```
