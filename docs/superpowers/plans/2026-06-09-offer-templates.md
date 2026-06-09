# Szablony oferty (offer_templates) — Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`). Wzorzec: `alt_programs` (PR #50)
> dla tabeli/API/admin; OfferForm dla zapisu/pre-fill. Każdy chunk → typecheck/test → commit.

**Goal:** Zapis "rozpiski" oferty jako szablon (bez danych klienta) + wybór szablonu przy tworzeniu oferty (pre-fill formularza).

**Architecture:** Tabela `offer_templates` z jednym `template_data` jsonb (snapshot pól FormState minus klient). Zapis: przycisk w OfferForm. Użycie: dropdown "Zacznij od szablonu" w OfferForm (tryb create) → merge template_data nad blankInitial. Admin `/admin/templates` (lista/rename/delete).

**Tech Stack:** Next.js 14, Supabase, Zod, TS strict. Migracja przez psql (jak #2).

---

## Odstępstwo od spec (świadome uproszczenie)

Spec proponował 15 osobnych kolumn (program_id, content, pricing_override...). **Zmiana: jeden `template_data jsonb`** = serializowany podzbiór FormState (pola nie-klienckie).

**Dlaczego:** (a) ~10× mniej kodu mapowania, (b) odporne na zmiany FormState bez migracji, (c) szablon to wzorzec roboczy, nie dane wymagające integralności relacyjnej. Trade-off: `case_study_id`/`contact_person_id` w jsonb nie są FK — jeśli katalog-pozycja usunięta, pre-fill ustawi nieistniejące id → pole puste (graceful, walidacja przy zapisie oferty łapie).

---

## File Structure

| Plik | Akcja | Odpowiedzialność |
|---|---|---|
| `supabase/migrations/20260609000002_offer_templates.sql` | Create | tabela + RLS (globalne) |
| `packages/database/types.ts` | Modify | typ `offer_templates` |
| `apps/web/lib/validation/templates.ts` | Create | Zod: `TemplateCreateInput` (name + template_data passthrough) |
| `apps/web/lib/audit.ts` | Modify | `offer_template.create/delete` + resourceType |
| `apps/web/lib/offers/template.ts` | Create | `TEMPLATE_FIELDS`, `extractTemplate(form)`, `applyTemplate(blank, data)` — jedno źródło które pola są szablonowe |
| `apps/web/app/api/admin/offer-templates/route.ts` | Create | GET (list) + POST (create) |
| `apps/web/app/api/admin/offer-templates/[id]/route.ts` | Create | PATCH (rename) + DELETE |
| `apps/web/app/(app)/admin/templates/page.tsx` | Create | lista szablonów (server) |
| `apps/web/app/(app)/admin/templates/TemplatesManager.tsx` | Create | rename/delete (client) |
| `apps/web/app/(app)/admin/page.tsx` | Modify | dashboard link |
| `apps/web/app/(app)/admin/offers/OfferForm.tsx` | Modify | (a) dropdown "Zacznij od szablonu" (create), (b) przycisk "Zapisz jako szablon" |
| `apps/web/app/(app)/admin/offers/new/page.tsx` | Modify | fetch offer_templates → prop |
| `apps/web/lib/offers/template.test.ts` | Create | unit: extract→apply round-trip nie gubi pól, nie zawiera klienta |

---

## Chunk 1: Schema

### Task 1: Migracja `offer_templates`

**Files:** Create `supabase/migrations/20260609000002_offer_templates.sql`

- [ ] **Step 1: SQL**

```sql
-- Szablony oferty (feature #1, spec 2026-06-09). Wzorzec rozpiski bez danych
-- klienta — pre-fill formularza przy tworzeniu nowej oferty. Globalne (zespół).
create table offer_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  template_data jsonb not null,           -- snapshot pól FormState minus klient
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table offer_templates enable row level security;

-- Globalne: każdy zalogowany czyta i tworzy (ustalone w ankiecie).
create policy "read offer_templates" on offer_templates
  for select using (auth.role() = 'authenticated');
create policy "write offer_templates" on offer_templates
  for all using (auth.role() = 'authenticated');
```

- [ ] **Step 2:** typy do `packages/database/types.ts` (Row/Insert/Update — id/name/template_data Json/created_by/created_at)
- [ ] **Step 3: Commit** (migracja NIE aplikowana jeszcze — prod push w chunk 5)

```bash
git commit -m "feat(templates): migracja offer_templates + typy"
```

---

## Chunk 2: Shared logika (extract/apply) + testy

### Task 2: `lib/offers/template.ts` — jedno źródło pól szablonowych

**Files:** Create `apps/web/lib/offers/template.ts` + `.test.ts`

Kluczowy moduł: definiuje KTÓRE pola FormState są szablonowe (nie-klienckie) i
funkcje extract (form→template_data) + apply (template_data→form patch).

- [ ] **Step 1: Test (TDD)** — round-trip nie gubi pól szablonowych, NIE zawiera klienta

```ts
import { extractTemplate, applyTemplate } from './template';
import { blankInitial } from ...; // lub mock FormState

test('extractTemplate pomija pola klienta', () => {
  const form = { ...blankInitial(), clientName: 'X', programLabel: 'FENG', contentIntro: 'abc' };
  const t = extractTemplate(form);
  expect(t).not.toHaveProperty('clientName');
  expect(t).not.toHaveProperty('projectValue');
  expect(t.programLabel).toBe('FENG');
  expect(t.contentIntro).toBe('abc');
});

test('applyTemplate nakłada szablon na blank, zachowuje puste pola klienta', () => {
  const t = { programLabel: 'FENG', offeredVariants: ['I','II'], contentIntro: 'x' };
  const form = applyTemplate(blankInitial(), t);
  expect(form.programLabel).toBe('FENG');
  expect(form.clientName).toBe(''); // klient zostaje pusty
});
```

- [ ] **Step 2:** Run → FAIL (moduł nie istnieje)
- [ ] **Step 3: Implementacja**

```ts
// Pola FormState które należą do szablonu (wszystko OPRÓCZ danych klienta).
export const TEMPLATE_FIELDS = [
  'programId', 'programLabel', 'programCustomName',
  'offeredVariants', 'selectedVariant',
  'caseStudyId', 'contactPersonId',
  'contentIntro', 'contentFooter', 'programDescription', 'altPrograms',
  'assignedConsultantId', 'pricingMode', 'overrides', 'execFee',
] as const;
// Pola klienta (świadomie pominięte): clientName, clientNip, clientIndustry,
// clientCompanySize, clientVoivodeship, projectValue, fundingRate,
// returningClient, projectCount.

export function extractTemplate(form: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of TEMPLATE_FIELDS) if (k in form) out[k] = form[k];
  return out;
}

export function applyTemplate<T extends Record<string, unknown>>(blank: T, data: Record<string, unknown>): T {
  const out = { ...blank };
  for (const k of TEMPLATE_FIELDS) if (k in data) (out as Record<string, unknown>)[k] = data[k];
  return out;
}
```

- [ ] **Step 4:** Run → PASS. typecheck. **Commit**

### Task 3: Zod + audit

**Files:** Create `lib/validation/templates.ts`; Modify `lib/audit.ts`

- [ ] `TemplateCreateInput = z.object({ name: z.string().min(1).max(120), template_data: z.record(z.unknown()) })`
- [ ] `TemplateRenameInput = z.object({ name: z.string().min(1).max(120) })`
- [ ] audit: `offer_template.create/delete` + resourceType `'offer_template'`
- [ ] typecheck → commit

---

## Chunk 3: API

### Task 4: API routes

**Files:** Create `app/api/admin/offer-templates/route.ts` + `[id]/route.ts`

- [ ] **route.ts GET:** lista (id, name, created_at, created_by) — bez template_data (lekko); requireSession (nie tylko admin — globalne, każdy konsultant)
- [ ] **route.ts POST:** TemplateCreateInput.parse → insert {name, template_data, created_by: session.userId} → audit offer_template.create
- [ ] **[id]/route.ts PATCH:** rename (TemplateRenameInput); **DELETE:** usuń + audit
- [ ] **GET [id]:** zwraca pełny template_data (do pre-fill przy wyborze)
- [ ] typecheck + lint → commit

---

## Chunk 4: OfferForm + admin UI

### Task 5: OfferForm — dropdown wyboru + przycisk zapisu

**Files:** Modify `OfferForm.tsx`, `new/page.tsx`

- [ ] **Step 1:** `new/page.tsx` fetch `offer_templates` (id, name) → prop `templates?: {id,name}[]`
- [ ] **Step 2:** OfferForm Props (oba warianty) + `templates?: TemplateOpt[]`
- [ ] **Step 3:** Tryb create — na górze formularza dropdown "Zacznij od szablonu (opcjonalnie)":
  - onChange → `GET /api/admin/offer-templates/[id]` → `setForm(applyTemplate(blankInitial(), data.template_data))`
  - (fetch pełnego template_data dopiero przy wyborze — lista GET jest lekka)
- [ ] **Step 4:** Przycisk "Zapisz jako szablon" (obok submit):
  - prompt o nazwę (window.prompt lub mały inline input) → `POST /api/admin/offer-templates` z `{ name, template_data: extractTemplate(form) }`
  - toast/success "Szablon zapisany"
- [ ] typecheck + lint + test → commit

### Task 6: Admin `/admin/templates`

**Files:** Create `app/(app)/admin/templates/{page,TemplatesManager}.tsx`; Modify dashboard

- [ ] page.tsx: lista (server, fetch id/name/created_at/created_by + join profiles dla autora)
- [ ] TemplatesManager.tsx: rename (PATCH) + delete (DELETE), podobny wzorzec jak AltProgramsManager
- [ ] dashboard link "Szablony ofert"
- [ ] typecheck + lint → commit

---

## Chunk 5: Migracja prod + PR

- [ ] **Backup prod** (`bash scripts/backup-db.sh`)
- [ ] **Migracja psql** w transakcji + wpis do supabase_migrations (jak #2)
- [ ] **Verify** tabela + RLS + 2 policies + tracking
- [ ] push branch → PR → `verify` zielone → preview test → merge

---

## Verification (akceptacja)

1. Stwórz ofertę z pełną treścią → "Zapisz jako szablon" → podaj nazwę
2. `/admin/templates` — szablon na liście (autor, data)
3. `/admin/offers/new` → dropdown "Zacznij od szablonu" → wybierz → formularz pre-filled (program, warianty, treści, alt-programy), pola klienta PUSTE
4. Dodaj klienta + wartość → pricing przelicza → zapisz → normalna oferta
5. Rename + delete szablonu działa; audit_log ma offer_template.*
6. Usuń case study użyte w szablonie → pre-fill graceful (pole puste, brak crash)

---

## YAGNI / out of scope

- Wersjonowanie szablonów, kategorie, współdzielenie granularne (globalne wystarczy)
- Edycja template_data w UI poza rename (chcesz inny szablon → stwórz nowy z oferty)
- Podgląd szablonu jako rendered oferta (lista nazw wystarczy)
