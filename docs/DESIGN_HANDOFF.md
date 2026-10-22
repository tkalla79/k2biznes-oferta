# Przekazanie do sesji projektowej — wygląd oferty klienta

Stan repo: `main` @ `387247f` (2026-10-22). Dokument opisuje **to, co już jest**,
żeby redesign nie wywrócił rzeczy, które trzymają ofertę przy życiu.

---

## 1. Gdzie to leży

Cała oferta klienta to jedna trasa: **`/o/[token]`**.

| plik | rola |
|---|---|
| `apps/web/app/o/[token]/page.tsx` (~1100 linii) | cała strona, server component — składa dane i renderuje sekcje |
| `apps/web/app/o/[token]/styles.css` (~2190 linii) | **jedyny** arkusz oferty; zmienne w `:root` (kolory, cienie, `--max`, `--gutter`, fonty) |
| `apps/web/app/o/[token]/staticContent.ts` | treść doradcza zaszyta w kodzie (zakresy prac, proces, FAQ domyślne) |
| komponenty obok | `ScopeAccordion`, `PricingVariants`, `LoanPricing`, `ExecPricing`, `ProcessTimeline`, `FaqAccordion`, `AcceptForm`, `CountUp`, `RevealOnScroll`, `ViewTracker`, `EngagementTracker` |

Typografia: `--serif: Fraunces`, `--sans: Inter`. Paleta: czerwień `#D91E18`,
granat `#2a324b`, tła `#F7F6F4` / `#F2EEE9`.

---

## 2. Struktura strony

Górna nawigacja (`.topnav`, ukryta w druku) + `main.app` z sekcjami:

| kotwica | kicker w UI | uwagi |
|---|---|---|
| `#hero` | — | tło z „rings", logo widoczne tylko w druku, nazwa klienta, program, termin ważności |
| `#intro` | 01 · Wprowadzenie | zdiagnozowane potrzeby i podstawa rekomendacji (rich text per oferta) |
| `#program` | 02 · Proponowane rozwiązanie | rekomendowany program + alternatywy z biblioteki |
| `#zakres` | 03 · Zakres usługi | akordeon: etap 1 (przygotowanie) i etap 2 (rozliczanie) |
| `#cennik` | 04 · Model wynagrodzenia | **różny komponent per typ oferty** — patrz niżej |
| `#proces` | 05 · Schemat procesu | oś kroków |
| `#onas` | 06 · Dlaczego K2Biznes | statystyki firmowe + **case study jako pod-blok** (`#case` to kotwica wewnątrz `#onas`, nie osobna sekcja) |
| `#faq` | 07 · FAQ | akordeon |
| `#akcept` | 08 · Akceptacja | formularz wyboru wariantu + zgoda RODO; pomijany w druku |

---

## 3. Trzy typy oferty — ten sam szkielet, inna zawartość

`offer_kind` ∈ `grant` | `loan` | `exec` (`lib/offers/kind.ts`).

- **grant (dotacja)** — jedyny z **wariantami I–IV** (`PricingVariants`, karty do
  wyboru, kafelek wynagrodzenia za obsługę). Zakres 03 zależy od wariantu
  zakresu programu (patrz §4).
- **loan (pożyczka)** — bez wariantów: opłata wstępna + wynagrodzenie wynikowe
  (`LoanPricing`), do tego tabela parametrów produktu. Brak części miesięcznej.
- **exec (sam zakres 2)** — tylko stawka miesięczna × liczba miesięcy
  (`ExecPricing`). Sekcja 03 pokazuje zakres rozliczeniowy jako główny.

Redesign musi obsłużyć **wszystkie trzy** — makieta zrobiona tylko pod dotację
przeoczy dwa układy cennika i inne nagłówki hero.

---

## 4. Co jest dynamiczne, a co zaszyte w kodzie

**Z bazy / panelu (zmienne per oferta lub globalnie):**
- nazwa klienta, program, kwoty, warianty, termin ważności,
- treści sekcji 01–02 (rich text), opis programu, alternatywy, uwagi do wyceny,
- case study, osoba kontaktowa, statystyki firmowe (`app_settings`),
- FAQ — **osobny zestaw per typ oferty** (`faq_items.kind`); pusty zestaw =
  treść domyślna z `staticContent.ts`,
- `{{de_minimis}}` i inne tokeny podstawiane w treści (`lib/offers/tokens.ts`).

**Zaszyte w kodzie (`staticContent.ts`):**
- listy czynności etapu 1 i 2 (`SCOPE_PREP`, `SCOPE_EXEC`, warianty),
- kroki procesu, domyślne FAQ, domyślne potrzeby.

**Wariant zakresu prac** (`SCOPE_BY_VARIANT`): `standard` albo `culture`
(Fundusze Norweskie i EOG — inne czynności, brak kafelka wynagrodzenia za
obsługę). Wariant deklaruje się przy programie w `/admin/alt-programs`.

---

## 5. Twarde ograniczenia — ruszać świadomie

1. **PDF to ta sama strona.** `/api/public/offers/[token]/pdf` renderuje
   `/o/<token>?print=true` przez puppeteer. Każda zmiana layoutu ma drugie
   życie w druku: `@media print`, łamanie stron, brak nawigacji, logo w hero
   tylko w druku, sekcja akceptacji pomijana.
2. **Identyfikatory sekcji są API analityki.** `EngagementTracker` liczy
   doczytanie przez IntersectionObserver po `id` sekcji, a
   `/admin/offers/[id]/activity` ma tę listę zapisaną (`SECTIONS`).
   Zmiana `id` albo scalenie sekcji = ciche zerowanie statystyk doczytania.
   Jeśli sekcje mają się zmienić, trzeba zaktualizować obie listy.
3. **Karty wariantów wysyłają zdarzenia** `variant_hovered` / `variant_selected`
   (`PricingVariants`). Jeśli wybór wariantu przestanie być „kartami", te
   zdarzenia trzeba przenieść na nowy element.
4. **Formularz akceptacji jest prawnie wiążący.** Wysyła wersję i hash klauzuli
   RODO; checkbox zgody nie jest ozdobą i nie może zniknąć ani być domyślnie
   zaznaczony.
5. **Oferta ma stany.** Draft (404 publicznie, podgląd tylko dla zalogowanego),
   wysłana, obejrzana, zaakceptowana, odrzucona, wygasła — każdy z własnym
   banerem u góry. Makieta powinna je przewidzieć.
6. **Treść bywa pusta.** Brak case study, brak alternatyw, puste FAQ, brak
   parametrów produktu pożyczkowego — układ nie może się wtedy rozjechać ani
   zostawić pustego nagłówka. Kilka takich dziur już naprawialiśmy.

---

## 6. Co zmieniliśmy w tej sesji (kontekst, nie historia)

- **Opis wynagrodzenia wynikowego w pożyczce jest nadpisywalny**
  (`content.loan.sfNote`): trzy stany — brak pola (zdanie domyślne), pusty
  string (wiersz bez opisu), tekst (zastępuje). Powód: domyślne zdanie
  „% wartości przyznanej pożyczki" jest nieprawdziwe dla części produktów.
  **Dla designu:** ten wiersz czasem nie ma opisu — sama nazwa i kwota.
- **Spójność zdań o podstawie naliczenia**: gdy oferta podaje własny opis,
  nota pod cennikiem, lead sekcji 04 i FAQ przestają twierdzić swoje.
- **FAQ per typ oferty**, edytowalne z panelu; pusty zestaw = treść domyślna.
- **Limit de minimis jako token** `{{de_minimis}}` z `/admin/ustawienia`
  (domyślnie `300 000 EUR`) — w treści może pojawić się dowolnie długa wartość.
- **Wariant zakresu prac deklarowany przy programie**, nie zgadywany z nazwy.
- Panel: decyzja klienta zgłoszona mailem/telefonicznie, porządek w akcjach na
  liście ofert, modal zamiast `window.prompt` (`components/PromptDialog.tsx`) —
  to nie dotyczy widoku klienta, ale jeśli redesign obejmie panel, wzorzec
  modala już jest.

---

## 7. Otwarte, czeka na dane od K2

- opisy wynagrodzenia dla ofert **FRS** i **PAKCER** (wpisać w panelu),
- podmiana wpisanej na sztywno kwoty de minimis na `{{de_minimis}}` w szablonach,
- ewentualne kolejne **warianty zakresu** (każdy wymaga treści czynności etapu 1 i 2),
- `bledy-oferta-pozyczkowa.md` — zgłoszony brak harmonogramu płatności w ofercie
  pożyczkowej; treść zgłoszenia nigdy nie trafiła do tej sesji.

---

## 8. Jak zacząć redesign bez bólu

Wszystkie kolory, cienie, promienie, szerokość kolumny i fonty siedzą w `:root`
w `styles.css`. Zmiana tonacji to zmiana zmiennych, nie przepisywanie arkusza.
Większy redesign (inny układ sekcji) dotyka `page.tsx` i wtedy obowiązują
ograniczenia z §5 — zwłaszcza druk i identyfikatory sekcji.

Do oglądania: podgląd oferty działa dla zalogowanego z `?__preview=1`,
a `?print=true` pokazuje dokładnie to, co pójdzie do PDF.
