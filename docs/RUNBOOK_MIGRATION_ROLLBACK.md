# Runbook: rollback migracji Supabase

Co zrobić, gdy `supabase db push` wywali się w trakcie aplikowania migracji do prod-DB (`yuyyejwnryuynbosqwwa`).

---

## Scenariusze

### A. Migracja nie zaczela sie (sprawdzenie pre-flight failed)

Symptom: `supabase db push` zwraca błąd zanim dotrze do bazy (np. lint, parse, connection).

**Nie ma czego rollbackować** — baza nie zmieniona. Napraw migrację lokalnie, push ponownie.

### B. Migracja zacofana w trakcie (partial apply)

Symptom: `supabase db push` zaczął applyowac, polacial przez ileś `CREATE TABLE`/`ALTER TABLE`, ale jakieś polecenie po drodze padło. Niektóre obiekty utworzone, inne nie.

**Postgres działa w trybie transakcyjnym** dla większości DDL — partial apply zwykle ROLLBACK-uje się automatycznie. Sprawdz `supabase_migrations.schema_migrations` table:

```sql
select version, name, statements_count, executed_at
  from supabase_migrations.schema_migrations
  order by version desc limit 5;
```

Jeśli migracja jest w tabeli → applied (commit). Jeśli nie → ROLLBACK'ed.

### C. Migracja applyowana, ale ZŁA (np. usuwa kolumnę z danymi)

Symptom: `supabase db push` zwrócił success, ale prod się posypał (errors w aplikacji, missing column, broken FK).

**To jest najgorszy scenariusz.** Plan działania:

1. **Stop traffic** (opcjonalnie — zalezy jak krytyczne):
   - W Vercel project: Settings → Deployments → ostatni working deploy → "Promote to Production"
   - Frontend wraca do starszego kodu, który nie używa nowej kolumny

2. **Identyfikacja:**
   ```bash
   # ktora migracja zepsula?
   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_DB_PASSWORD='...' \
     supabase migration list --linked
   ```

3. **Rollback przez DOWN migration:**
   Supabase CLI nie obsluguje auto-down. Musisz napisac DOWN ręcznie i applynąć:
   ```sql
   -- supabase/migrations/<timestamp>_rollback_<original>.sql
   -- Odwroc to, co zrobila zla migracja:
   alter table offers drop column if exists nowa_kolumna;
   -- itd.
   ```
   Push:
   ```bash
   supabase db push --linked
   ```

4. **Restore z backup** (ostatecznosc, gdy DROP usuwa dane):
   - Supabase Free **NIE ma PITR** (point-in-time recovery)
   - Free ma **daily snapshot** (z ostatnich 24h, retencja 7 dni)
   - Restore: Supabase Dashboard → Database → Backups → wybierz snapshot → Restore
   - **UWAGA:** restore tworzy NOWY projekt, NIE nadpisuje starego. Musisz potem:
     a) Skopiowac nowy project_ref
     b) Update env vars w Vercel (NEXT_PUBLIC_SUPABASE_URL etc.)
     c) Redeploy
     d) Skasowac stary projekt (po weryfikacji)

   Pełna procedura: https://supabase.com/docs/guides/platform/backups

---

## Pre-flight checklist przed `supabase db push` do prod

Zawsze rób w tej kolejności:

1. **Test migracji na stagingu** (`oauucbhjkmuezytnqwuf`):
   ```bash
   supabase link --project-ref oauucbhjkmuezytnqwuf
   supabase db push --linked
   # Sprawdz aplikacje na staging URL — czy nic nie padło
   ```

2. **Sprawdz dane prod, ktore moga byc dotkniete:**
   ```sql
   -- Przyklad: ile rzedów w tabeli, ktorej kolumne usuwasz?
   select count(*) from offers where nowa_kolumna is not null;
   ```

3. **Backup ad-hoc** (manual snapshot przez Supabase Dashboard → Database → Backups → "Create snapshot")

4. **Push do prod:**
   ```bash
   supabase link --project-ref yuyyejwnryuynbosqwwa
   SUPABASE_DB_PASSWORD='...' supabase db push --linked
   ```

5. **Verify** — sprawdz health endpoint + 2-3 user flows.

---

## Najczestsze pulapki migracji

### 1. Dodawanie NOT NULL column do tabeli z danymi
```sql
-- WYWALI SIE bo NULL nie spelnia constraint:
alter table offers add column foo text not null;

-- Zrob to:
alter table offers add column foo text;
update offers set foo = 'default' where foo is null;
alter table offers alter column foo set not null;
```

### 2. Usuwanie kolumny uzywanej przez RLS policy
```sql
-- WYWALI SIE jak policy odwoluje sie do tej kolumny:
alter table offers drop column status;

-- Zrob to:
drop policy if exists "policy_name" on offers;
alter table offers drop column status;
create policy "policy_name" on offers for select using (...);
```

### 3. ENUM type — nie da się dropować wartosci
```sql
-- NIE DZIALA w Postgres:
alter type offer_status drop value 'old_status';

-- Workaround: rename + recreate (skomplikowane, robic offline)
```

### 4. Index na duzej tabeli blokuje writes
```sql
-- NIE TAK na zywej tabeli:
create index idx_offers_status on offers(status);

-- TAK (concurrent, nie blokuje):
create index concurrently idx_offers_status on offers(status);
-- (uwaga: concurrently nie dziala w transakcji = nie da sie w migracji
--  bezposrednio. Trzeba przez supabase db remote commit lub psql --no-tx)
```

---

## Kontakt eskalacyjny

Gdy nic nie pomaga + prod jest down:

1. **Supabase Support** (Free plan: priority "low", ale ticket przychodzi w 24h)
2. **Tomek Kalla** — `t.kalla@k2biznes.pl`

Linki bezposrednie:
- Supabase Dashboard prod: https://supabase.com/dashboard/project/yuyyejwnryuynbosqwwa
- Vercel Dashboard prod: https://vercel.com/tomeks-projects-544a4978/k2biznes-oferta-web
- GitHub repo: https://github.com/tkalla79/k2biznes-oferta
