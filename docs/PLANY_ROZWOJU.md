# Plany rozwoju — K2Biznes Oferta

Backlog koncepcji do rozważenia po MVP/produkcji. Każdy wpis ma datę dodania,
status, motywację biznesową i szkic implementacji. Status:
- 💡 **pomysł** — do dyskusji, nie zaplanowane
- 🟡 **zaplanowane** — wybrane do realizacji, czeka na slot
- 🟢 **w trakcie** — implementowane teraz
- ✅ **zrealizowane** — przeniesione do CHANGELOG
- ❌ **odrzucone** — z uzasadnieniem

---

## 1. Globalna edycja pricing_segments + pricing_config (Poziom 2)

**Dodane:** 2026-05-06
**Status:** 💡 pomysł
**Priorytet:** średni (post-MVP)

### Kontekst

Obecnie pricing ma dwa źródła wartości:
1. **Defaulty globalne** — tabele `pricing_segments` (5 segmentów: s500k, s1m, s2m, s5m, s5mplus) + `pricing_config` (loyalty_discount, multi_discount, min_sf_amount, min_base_fee). Ustawiane przez seed.sql, edytowane tylko przez SQL w Supabase Studio.
2. **Override per oferta** — `offers.pricing_override` jsonb. UI w editorze (toggle Auto/Ręczne, PR-C #29). Konsultant może nadpisać każde pole na konkretnej ofercie.

Poziom 2 = wystawienie globalnych defaultów do edycji w aplikacji.

### Motywacja

- Po pierwszych ~10 ofertach Tomek może chcieć przesunąć wartości globalnie (np. "wszystkie nowe oferty s2m powinny mieć base 14k, nie 12k") bez chodzenia do Supabase Studio.
- Brak technicznej zależności od dewelopera dla zmiany pricingu.
- Audit log: kto/kiedy/co zmienił w defaultach.

### Szkic implementacji

**API:**
- `GET /api/admin/pricing/segments` → lista 5 segmentów
- `PATCH /api/admin/pricing/segments/[id]` → edycja base_fee, sf_variant_1/2/3, monthly_fee, label
- `GET /api/admin/pricing/config` → pricing_config (singleton 'global')
- `PATCH /api/admin/pricing/config` → edycja loyalty_discount, multi_discount, min_sf_amount, min_base_fee
- `super_admin` only (consultant nie powinien zmieniać globalnych defaultów)
- Audit log dla każdej zmiany (`logAudit` z action `pricing.segment.update`)

**UI:**
- `/admin/pricing` page (server component, super_admin gate)
- Tabela segmentów z inline edit (5 wierszy)
- Pod tabelą: 4 pola configu w grid 2×2
- Sekcja info: jaki wpływ ma zmiana (cytat z BACKEND_SPEC.md sekcja 6.5: "Zmiana defaultów wpływa tylko na NOWE oferty. Istniejące mają snapshot z momentu wystawienia.")
- Link z dashboardu admina + nawigacja

**Walidacja:**
- Zod schemas w `lib/validation/pricing.ts`
- `base_fee >= 0`, `sf_variant_1/2/3 ∈ [0, 1]`, `monthly_fee >= 0`, `min_sf_amount >= 0`, `min_base_fee >= 0`
- Sanity check: czy zmiana nie wywoła chaos w pricing snapshocie (snapshot jest niezmienny dla wystawionych ofert — bezpieczne)

**Estymacja:** 1-2h pracy (mały PR analogiczny do `/admin/programs`).

### Decyzja "kiedy"

Kandydat na PR-E lub późniejszy. Trigger:
- Tomek zauważa po 5-10 ofertach, że konsekwentnie zmienia te same defaulty.
- Lub: wymaganie biznesowe od konsultantów ("nie chcemy edytować każdej oferty z osobna, niech defaulty będą OK").

Do tego czasu — Supabase Studio SQL Editor wystarcza dla rzadkich edycji.

---

## 2. Edytowalne `programBullets` per oferta

**Dodane:** 2026-05-30
**Status:** 💡 pomysł
**Priorytet:** średni (UX polish, ale wymaga schema change)

### Kontekst

W sekcji `02 · Proponowane rozwiązanie` w `/o/[token]` renderowane są 4 bullety
korzyści programu. Obecnie:
- Jeśli konsultant wypełni `programDescription` (Tiptap rich-text — PR-D #25)
  → renderuje się jako HTML
- W przeciwnym razie → fallback do hardcoded `PROGRAM_BULLETS` w `staticContent.ts`
  ("Wysoka intensywność…", "Refundacja 80%", …)

User feedback (FRONTEND_POLISH_BACKLOG.md #2): chce dedykowane pole `programBullets`
(string[]) zamiast wymuszać rich-text dla zwykłej listy.

### Motywacja

- Tiptap UX dla zwykłej listy "1 linia per bullet" to overkill (user musi
  zaznaczać typ listy, formatowanie etc.)
- Hardcoded `PROGRAM_BULLETS` w `staticContent.ts` wymaga deploya przy zmianie
  treści dla nowego programu (np. inny program FENG = inne bullety)
- Per-oferta override pozwala na cherry-pick bulletów dla konkretnego klienta

### Szkic implementacji

**Schema:**
- Dodać `programBullets: string[]` (4 elementy) do `offers.content` jsonb
- Zod validation w `OfferContentSchema`
- Bez DB migration (content jest jsonb)

**Editor:**
- 4 pola tekstowe (lub 1 textarea z line-per-bullet) w `/admin/offers/[id]/edit`
- Domyślnie pre-fill z `PROGRAM_BULLETS` dla wstecznej kompatybilności
- Walidacja: max 80 znaków per bullet, min 1 max 6 bulletów

**Public view (`/o/[token]/page.tsx`):**
- Zamiast `PROGRAM_BULLETS` używaj `content.programBullets ?? PROGRAM_BULLETS`
- Reszta layoutu bez zmian (CSS już naprawiony 2026-05-30 — usunięto granatowy box)

**Estymacja:** 1-1.5h (schema + walidacja + UI + test).

### Decyzja "kiedy"

Trigger:
- Tomek pisze drugą ofertę z innym programem (np. NCBR zamiast FENG) i widzi że
  bullety nie pasują → bug-driven priority
- Lub: pierwsza realna kampania marketingowa dla różnych programów

Do tego czasu — `programDescription` (Tiptap) daje pełną elastyczność tylko
trochę droższym UX.

---

## (template — następne pomysły dopisuj poniżej)

<!--
## N. <Tytuł krótko>

**Dodane:** YYYY-MM-DD
**Status:** 💡 / 🟡 / 🟢 / ✅ / ❌
**Priorytet:** wysoki / średni / niski

### Kontekst

### Motywacja

### Szkic implementacji

### Decyzja "kiedy"
-->
