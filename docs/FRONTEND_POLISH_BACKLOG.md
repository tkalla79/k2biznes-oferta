# Frontend polish backlog

Lista zmian wizualnych / UX do wprowadzenia w trakcie końcowej polish session (przed go-live z pierwszym realnym klientem).

**Format:** zbieraj zmiany jak je zauważasz w trakcie codziennego użytkowania. Pod koniec, gdy lista będzie kompletna, Claude przerobi je batch'em.

**Status:**
- 🔵 todo — zaobserwowane, do zrobienia
- 🟢 doing — w trakcie polish session
- ✅ done — naprawione
- ❌ skip — odrzucone (z uzasadnieniem)

---

## Jak dopisywać

Skopiuj template poniżej i wypełnij. Im więcej detali tym szybciej dla mnie. Ekran (`/o/[token]`, `/admin/offers/[id]/edit`, etc.) + opis + opcjonalnie screenshot path.

```md
### N. [Krótki tytuł]

**Status:** 🔵 todo
**Strona:** /o/[token] (publiczna oferta)
**Co widzę:** [opis aktualnego stanu]
**Co chcę:** [opis docelowego stanu]
**Screenshot:** docs/screenshots/N-tytul.png (opcjonalnie)
**Kategoria:** drobny CSS / średnia (layout) / duża (schema / nowa feature)
```

---

## Backlog

### 1. Zmniejszyć odstęp między hero a sekcją „01 · Wprowadzenie"

**Status:** 🔵 todo
**Strona:** `/o/[token]` (publiczna oferta)
**Co widzę:** Po sekcji hero (statystyki 475 mln zł / 288 / od 2015) jest duży vertical space przed sekcją „01 · Wprowadzenie". Odstęp wygląda za luźno, sugeruje „pusty obszar".
**Co chcę:** Mniejszy padding/margin — krótsza przerwa, kontynuacja czytania bardziej naturalna.
**Kategoria:** drobny CSS
**Screenshot:** chat 2026-05-25

---

### 2. Usunąć granatowe podświetlenie w sekcji „02 · Rekomendujemy", zachować bullety korzyści (z możliwością edycji)

**Status:** 🔵 todo
**Strona:** `/o/[token]` sekcja `02 · Proponowane rozwiązanie`
**Co widzę:** Box z ciemnym granatowym tłem, w środku: tekst „Nabór jest najbardziej odpowiedni..." + 4 bullety korzyści (Wysoka intensywność / Refundacja 80% / Komplementarność / Ścieżka BGK).
**Co chcę:**
- Usunąć ciemne tło (granatowy box)
- Zachować 4 wypunktowane korzyści
- Dodać MOŻLIWOŚĆ edycji bulletów per oferta (obecnie hardcoded `PROGRAM_BULLETS` w `staticContent.ts`)
**Kategoria:** średnia (CSS + dodanie pola edycji w editorze + schema content.programBullets w offers.content)
**Screenshot:** chat 2026-05-25
**Uwagi techniczne:** rozważ czy `programBullets: string[]` osobno od `programDescription` (Tiptap rich-text, już istnieje od PR-D #25), czy zmusić użytkownika do listy w Tiptap.

---

<!-- Dopisuj kolejne uwagi poniżej -->
