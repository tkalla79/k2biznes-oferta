# Biblioteka "Inne możliwości wsparcia" (alt_programs) — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax. Wzorzec: katalog `programs`
> (`/admin/programs` + `lib/validation/catalog.ts` + API routes). Każdy task → typecheck/test → commit.

**Goal:** Biblioteka gotowych alt-programów (tabela + admin CRUD) + multi-select w OfferForm z opcją ad-hoc.

**Architecture:** Tabela `alt_programs` (wzorzec `programs`). Admin CRUD kopiuje `/admin/programs`. OfferForm: zaznaczone z biblioteki + ad-hoc → snapshot do `content.altPrograms` (bez zmian w renderze `/o/[token]`).

**Tech Stack:** Next.js 14, Supabase Postgres, Zod, TypeScript strict. Migracja przez `supabase db push --linked` (RUNBOOK_MIGRATION_ROLLBACK).

---

## File Structure

| Plik | Akcja | Odpowiedzialność |
|---|---|---|
| `supabase/migrations/20260609000001_alt_programs.sql` | Create | tabela + RLS + seed 4 obecnych |
| `packages/database/types.ts` | Modify | regen po migracji (`alt_programs` typy) |
| `apps/web/lib/validation/catalog.ts` | Modify | `AltProgramInput` + `AltProgramUpdate` Zod |
| `apps/web/lib/audit.ts` | Modify | `alt_program.create/update/delete` + resourceType |
| `apps/web/app/api/admin/alt-programs/route.ts` | Create | GET (list) + POST (create) |
| `apps/web/app/api/admin/alt-programs/[id]/route.ts` | Create | PATCH + DELETE |
| `apps/web/app/(app)/admin/alt-programs/page.tsx` | Create | server component lista |
| `apps/web/app/(app)/admin/alt-programs/AltProgramsManager.tsx` | Create | client CRUD UI (kopia ProgramsManager) |
| `apps/web/app/(app)/admin/page.tsx` | Modify | link "Inne możliwości wsparcia" w dashboardzie |
| `apps/web/app/api/admin/alt-programs/route.test.ts` | Create | walidacja Zod (jeśli pattern testów API istnieje — inaczej unit na schema) |
| `apps/web/app/(app)/admin/offers/OfferForm.tsx` | Modify | sekcja altPrograms: multi-select biblioteki + ad-hoc |
| `apps/web/app/(app)/admin/offers/new/page.tsx` | Modify | fetch alt_programs → przekaż do OfferForm |
| `apps/web/app/(app)/admin/offers/[id]/edit/page.tsx` | Modify | jw. dla edycji |

---

## Chunk 1: Schema + dane

### Task 1: Migracja `alt_programs`

**Files:** Create `supabase/migrations/20260609000001_alt_programs.sql`

- [ ] **Step 1: Napisz migrację** (tabela + RLS + seed 4 z `staticContent.ts`)

```sql
-- Biblioteka "Inne możliwości wsparcia" (alt-programy do wyboru w ofercie).
create table alt_programs (
  id              text primary key,
  name            text not null,
  program         text not null,
  nabor           text,
  "desc"          text,
  url             text,
  display_order   integer not null default 100,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table alt_programs enable row level security;
create policy "read alt_programs" on alt_programs
  for select using (auth.role() = 'authenticated');
create policy "super_admin writes alt_programs" on alt_programs
  for all using (public.is_super_admin());

-- Seed: 4 programy z dotychczasowego staticContent.ts ALT_PROGRAMS
insert into alt_programs (id, name, program, nabor, "desc", url, display_order) values
  ('sciezka-smart', 'Ścieżka SMART', 'FENG 2021–2027', 'IV kw. 2026',
   'Kompleksowy rozwój firm poprzez projekty B+R, wdrożenie innowacji, infrastrukturę, kompetencje i internacjonalizację.',
   'https://www.k2biznes.pl/sciezka-smart/', 10),
  ('cyfryzacja-msp', 'FENG Działanie 2.32', 'Cyfryzacja MŚP', 'I kw. 2026',
   'Wsparcie transformacji cyfrowej: oprogramowanie, sprzęt IT, cyberbezpieczeństwo, szkolenia dla pracowników.',
   'https://www.k2biznes.pl/cyfryzacja-msp/', 20);
  -- (pozostałe 2 z ALT_PROGRAMS — uzupełnić przy implementacji odczytując staticContent.ts)
```

- [ ] **Step 2: Apply na prod** (per RUNBOOK_MIGRATION_ROLLBACK)

```bash
SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_DB_PASSWORD='...' supabase db push --linked
```
Expected: migracja zaaplikowana, `alt_programs` istnieje z 4 wierszami.

- [ ] **Step 3: Regen typów**

```bash
npm run db:types   # wymaga supabase local LUB --linked; commituje packages/database/types.ts
```
Expected: `alt_programs` w `Database['public']['Tables']`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260609000001_alt_programs.sql packages/database/types.ts
git commit -m "feat(alt-programs): migracja tabeli + RLS + seed"
```

---

## Chunk 2: Backend (validation + API + audit)

### Task 2: Zod schemas

**Files:** Modify `apps/web/lib/validation/catalog.ts`

- [ ] **Step 1: Dodaj `AltProgramInput` + `AltProgramUpdate`** (wzorzec `ProgramInput`)

```ts
export const AltProgramInput = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/).optional(),
  name: z.string().min(1).max(120),
  program: z.string().min(1).max(120),
  nabor: z.string().max(80).nullable().optional(),
  desc: z.string().max(2000).nullable().optional(),
  url: z.string().url().max(500).nullable().optional(),
  display_order: z.number().int().default(100),
  is_active: z.boolean().default(true),
});
export const AltProgramUpdate = AltProgramInput.partial().omit({ id: true });
```

- [ ] **Step 2: typecheck** — `cd apps/web && npx tsc --noEmit` → brak błędów
- [ ] **Step 3: Commit** — `git commit -m "feat(alt-programs): Zod schemas"`

### Task 3: Audit actions

**Files:** Modify `apps/web/lib/audit.ts`

- [ ] **Step 1:** dodaj do `AuditAction`: `alt_program.create/update/delete`; do `resourceType`: `'alt_program'`
- [ ] **Step 2:** typecheck → commit

### Task 4: API routes (kopia wzorca programs + audit z H12)

**Files:** Create `apps/web/app/api/admin/alt-programs/route.ts` + `[id]/route.ts`

- [ ] **Step 1:** skopiuj `app/api/admin/programs/route.ts` → alt-programs, podmień tabelę `programs`→`alt_programs`, schema `ProgramInput`→`AltProgramInput`, audit `program.create`→`alt_program.create`, slug z `name`
- [ ] **Step 2:** to samo dla `[id]/route.ts` (PATCH+DELETE, audit alt_program.update/delete)
- [ ] **Step 3:** typecheck + lint → commit

---

## Chunk 3: Admin UI

### Task 5: Admin lista + manager (kopia programs)

**Files:** Create `app/(app)/admin/alt-programs/page.tsx` + `AltProgramsManager.tsx`

- [ ] **Step 1:** skopiuj `app/(app)/admin/programs/{page,ProgramsManager}.tsx`, dostosuj pola (name/program/nabor/desc/url zamiast group_name/label/description), endpoint `/api/admin/alt-programs`
- [ ] **Step 2:** dodaj link w `app/(app)/admin/page.tsx` (dashboard) — "Inne możliwości wsparcia"
- [ ] **Step 3:** typecheck + lint → commit

---

## Chunk 4: OfferForm integracja

### Task 6: Multi-select biblioteki + zachowane ad-hoc

**Files:** Modify `OfferForm.tsx` + `new/page.tsx` + `[id]/edit/page.tsx`

- [ ] **Step 1:** `new/page.tsx` + `edit/page.tsx` — fetch `alt_programs` (is_active, order), przekaż prop `library: AltProgram[]` do OfferForm
- [ ] **Step 2:** OfferForm sekcja "Alternatywne programy":
  - checkbox-lista z `library` (zaznaczone → kopiowane do form.altPrograms)
  - zachowany przycisk "+ Dopisz ad-hoc" (obecne ręczne pola)
  - finalna `form.altPrograms` → `content.altPrograms` (bez zmian w zapisie/renderze)
- [ ] **Step 3:** typecheck + lint + test → commit

---

## Chunk 5: PR

### Task 7: PR przez CI

- [ ] push branch → `gh pr create` → czekaj `verify` zielone → preview test (`/admin/alt-programs` ładuje, OfferForm pokazuje multi-select) → merge

---

## Verification (akceptacja)

1. `/admin/alt-programs` — lista 4 seedowych, dodaj/edytuj/usuń działa
2. `/admin/offers/new` — sekcja "Inne możliwości" pokazuje checkbox-listę biblioteki
3. Zaznacz 2 z biblioteki + dopisz 1 ad-hoc → zapisz ofertę → `/o/[token]` pokazuje 3
4. Edytuj alt-program w bibliotece → istniejąca oferta NIEZMIENIONA (snapshot)
5. audit_log ma wpisy `alt_program.*` dla mutacji

---

## YAGNI / out of scope

- Storage/upload obrazka dla alt-programu (programs nie ma — alt też nie potrzebuje)
- Soft-delete (hard DELETE wystarczy, jak programs)
- Reordering drag&drop (display_order liczbą wystarczy)
