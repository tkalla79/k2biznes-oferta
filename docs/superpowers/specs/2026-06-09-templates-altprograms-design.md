# Szablony oferty + Biblioteka "Inne możliwości wsparcia" — design

**Data:** 2026-06-09
**Status:** zatwierdzony (Tomek)
**Zakres:** 2 features + 1 data update (RODO osobno)

---

## Kontekst

Konsultanci (Tomek + Michał, Kasia, Karolina) tworzą oferty dotacyjne w `OfferForm`.
Dwa bottlenecki:
1. Każdą ofertę budują od zera — te same programy, treści, warianty wpisywane ręcznie.
2. Pole "Inne możliwości wsparcia" (alt-programy) wpisywane ręcznie przy każdej ofercie,
   mimo że to wciąż te same ~5-10 programów.

Rozwiązanie: (#2) biblioteka alt-programów + (#1) szablony całej oferty.

---

## #2 — Biblioteka "Inne możliwości wsparcia"

### Decyzje (z ankiety)
- Wybór z biblioteki (multi-select) **+ opcja ad-hoc** (jednorazowy program ręcznie).

### Architektura — wzorzec katalogu (jak `programs`/`case_studies`)

**Tabela `alt_programs`:**
| kolumna | typ | uwaga |
|---|---|---|
| id | text PK | slug (jak programs) |
| name | text | "Ścieżka SMART" |
| program | text | "FENG 2021–2027" |
| nabor | text | "IV kw. 2026" |
| desc | text | opis |
| url | text nullable | link |
| display_order | int | sortowanie |
| is_active | bool | soft-disable |
| created_at | timestamptz | |

RLS: read dla authenticated, write dla admin/super_admin (jak programs).

**Admin CRUD `/admin/alt-programs`:**
- Kopia wzorca `/admin/programs` (page + AltProgramsManager + API routes GET/POST/PATCH/DELETE)
- audit_log dla mutacji (akcje `alt_program.create/update/delete` — rozszerzenie AuditAction, wzorzec H12)

**OfferForm — sekcja "Alternatywne programy":**
- Multi-select (checkbox lista z biblioteki, sortowana display_order, tylko is_active)
- "+ Dopisz ad-hoc" — zachowane obecne pola ręczne dla jednorazowych
- Finalna lista (zaznaczone z biblioteki SKOPIOWANE + ad-hoc) → `content.altPrograms` jako
  **snapshot** (oferta niezmienna gdy biblioteka się zmieni — jak obecnie)

**Migracja danych:** 4 hardcoded `ALT_PROGRAMS` ze `staticContent.ts` → seed do `alt_programs`.

---

## #1 — Szablony oferty

### Decyzje (z ankiety)
- Szablon = wszystko OPRÓCZ danych klienta.
- Globalne (cały zespół tworzy i używa).

### Architektura — nowa tabela + reuse `OfferForm`

**Tabela `offer_templates`:**
| kolumna | typ | uwaga |
|---|---|---|
| id | uuid PK | |
| name | text | "FENG SMART — produkcja" |
| created_by | uuid → profiles | kto utworzył |
| program_id | text nullable | |
| program_label | text | |
| program_custom_name | text nullable | |
| selected_variant | pricing_variant | |
| offered_variants | pricing_variant[] | |
| case_study_id | text nullable | |
| contact_person_id | text nullable | |
| content | jsonb | intro, opis, zakres, footer, altPrograms |
| pricing_override | jsonb | jeśli używany |
| created_at | timestamptz | |

**Świadomie BEZ:** `offer_number, client_name, client_nip, client_*, project_value,
funding_rate, pricing_snapshot`. To dane per-klient. Pricing liczy się przy ofercie
gdy konsultant poda wartość projektu.

RLS: read + write dla authenticated (globalne).

**Zapis szablonu (2 wejścia):**
1. Przycisk "Zapisz jako szablon" w `OfferForm` — bierze obecny stan, pyta o nazwę,
   strip danych klienta, INSERT do offer_templates.
2. `/admin/templates` — lista (podgląd, rename, delete).

**Użycie:**
- `/admin/offers/new` — dropdown "Zacznij od szablonu (opcjonalnie)" na górze.
- Wybór → `OfferForm` pre-fill polami z szablonu → konsultant dodaje klienta +
  project_value → pricing przelicza → zapis jako normalna oferta (osobny byt,
  szablon nietknięty).

**Reuse:** zero nowego formularza — `OfferForm` istnieje. Dodajemy (a) przycisk zapisu,
(b) dropdown na new-offer + logikę pre-fill (mapowanie template → initial form state).

---

## Kolejność implementacji

1. **#2 alt_programs** (biblioteka) — niezależne, mniejsze, wzorzec gotowy (H12 katalogi).
   Migracja + tabela + admin CRUD + OfferForm multi-select.
2. **#1 offer_templates** — większe, reuse OfferForm. Tabela + zapis + dropdown + pre-fill.
3. **#3 RODO** — osobno: nowa wersja klauzuli do `gdpr_clauses` (istniejący mechanizm
   wersjonowania + sha256 hash). Nie wymaga kodu, tylko INSERT + ustawienie is_current.

Każdy etap: migracja → API + audit → UI → typecheck/lint/test → PR przez CI.

---

## Out of scope (YAGNI)

- Szablony per-user / uprawnienia granularne (globalne wystarczy dla 4 osób).
- Wersjonowanie szablonów (rename/delete wystarczy).
- Edycja alt-programu "w locie" zmieniająca oryginał (snapshot do content wystarczy).
- Kategorie/tagi szablonów (przy kilku szablonach niepotrzebne).
