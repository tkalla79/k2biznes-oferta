# K2Biznes Oferta — instrukcja dla testera

System ofertowy K2Biznes. Konsultant tworzy oferty dotacyjne dla klientów,
wysyła linkiem, klient akceptuje online.

**Stan:** po PR #44 (2026-06-09). Produkcja live, 4 realne oferty, 1 zaakceptowana.
**Środowisko testowe:** produkcja `https://oferta.k2biznes.pl` (NIE staging — staging
URL w sekcji 1 jest historyczny). Testuj na koncie `tester@k2biznes.pl`, NIE twórz
realnych ofert do realnych klientów.

---

## 1. Dostęp

### Dane logowania (super_admin)

| Pole | Wartość |
|---|---|
| Email | `tester@k2biznes.pl` |
| Hasło | `TestK2Biznes2026!` |
| Rola | `super_admin` (pełny dostęp do wszystkich funkcji) |

> Hasło zmień przy pierwszym logowaniu (`/admin/users` → ikona profilu — *funkcja
> reset hasła w panelu jeszcze nie wystawiona; jeśli potrzebne, zgłoś autorowi*).

### URL aplikacji

**Staging**: **https://k2biznes-oferta-web.vercel.app**

Działa 24/7, bez konieczności trzymania niczego po stronie dewelopera.
Hosting: Vercel (Hobby tier) · DB: Supabase Cloud (eu-central-1, free tier) ·
Email: Resend (3000 maili / mc, free tier).

### Pierwsze logowanie

1. Otwórz URL aplikacji
2. `/auth/signin` — wprowadź email + hasło
3. **MFA setup** — zostaniesz przekierowany na `/auth/mfa-setup` (admin musi
   mieć MFA, sekcja 7.6 specyfikacji)
4. Kliknij "Włącz MFA" → zeskanuj QR aplikacją TOTP (Google Authenticator,
   1Password, Authy, Microsoft Authenticator)
5. Wpisz 6-cyfrowy kod → po sukcesie trafisz do dashboardu `/admin`

---

## 2. Co testować — happy path

### Scenariusz 1: Tworzenie oferty

1. **Dashboard** (`/admin`) — sprawdź czy się ładuje, KPI cards widoczne (Aktywne
   oferty / Zaakceptowane / Pipeline / Revenue 30d), tabele Konwersja /
   Konsultanci / Prognoza / Symulator
2. **Klik "→ Oferty"** w nawigacji → `/admin/offers`
3. **Klik "+ Nowa oferta"** → `/admin/offers/new`
4. Wypełnij formularz:
   - **Klient**: dowolna firma, NIP 10 cyfr (np. `1234567890`), branża,
     wielkość firmy, województwo (dropdown 16 PL)
   - **Programy wsparcia**: dodaj z rozwijanej listy (biblioteka programów wsparcia)
     co najmniej jedną pozycję i **zaznacz ją jako rekomendowaną** (trafia do sekcji 02)
   - **Finanse**: project value 3M, intensywność 70%, projekty 1, klient
     powracający = nie
   - **Pricing live preview** powinien pokazać 4 warianty (I/II/III/IV) — sprawdź
     czy debounce 400ms nie laguje
   - **Wariant**: zostaw `I` zaznaczone
   - **Załączniki**: wybierz osobę kontaktową + case study
5. **Klik "Stwórz ofertę"** → przekierowanie do `/admin/offers/[id]/edit`

### Scenariusz 2: Podgląd draftu

1. W `/admin/offers/[id]/edit` klik **"Podgląd (draft) ↗"** w prawym górnym rogu
2. Otwiera nowe okno z `/o/<token>?__preview=1`
3. Powinieneś zobaczyć:
   - Żółty banner "Podgląd wersji roboczej — klient nie widzi tej oferty…"
   - 9 sekcji: Wprowadzenie / Proponowane rozwiązanie / Zakres / Wycena /
     Schemat procesu / Dlaczego K2Biznes / Zaufali nam / FAQ / Akceptacja
   - Nagłówek: client name + program label + numer oferty
   - Pricing variants z poprawnymi liczbami
4. **FAQ accordion** — kliknij każde z 6 pytań (powinno się rozwijać/zwijać)
5. **Stopka** z adresem K2 + kontaktem

### Scenariusz 3: Wysyłka oferty

1. Wróć do `/admin/offers/[id]/edit`
2. **Klik "Wyślij ofertę"** w toolbar (czerwony przycisk)
3. Modal: wpisz email odbiorcy (np. swój prywatny), opcjonalnie wiadomość, klik
   "Wyślij"
4. Email powinien dojść (na staging — Resend; lokalnie — Mailpit
   `http://127.0.0.1:54324`)
5. Status oferty zmieni się na `sent`, link do `/o/<token>` (bez `?__preview=1`)
   działa już bez sesji
6. Kliknij link w mailu — powinieneś zobaczyć stronę bez bannerów (klient widzi
   normalny widok)

### Scenariusz 4: Akceptacja jako klient

1. Otwórz link z maila w **incognito** (żeby symulować klienta bez sesji)
2. Przejdź do sekcji "Akceptacja oferty" (sam scroll albo klik "Akceptuję ofertę
   →" w nav)
3. Wpisz dane: imię, email, opcjonalnie komentarz
4. Zaznacz checkbox RODO
5. Klik "Akceptuję ofertę · Wariant I"
6. Po sukcesie → komunikat "Oferta zaakceptowana — dziękujemy"
7. Wróć do `/admin/offers` jako tester — status oferty: `accepted`

### Scenariusz 5: Katalogi (admin only)

1. Z dashboardu kliknij **"Programy wsparcia"** → `/admin/alt-programs` (biblioteka
   scalona w etapie 3; dawny moduł `/admin/programs` został wygaszony)
2. Kliknij "+ Nowy" → wypełnij i zapisz
3. Kliknij "Edytuj" przy istniejącym → zmień nazwę → zapisz
4. Toggle checkbox `is_active` przy pozycji → odśwież stronę → status pozostał
5. Sprawdź, że dodana pozycja jest dostępna w formularzu oferty (dropdown Programy wsparcia)
6. Tak samo dla **"Case studies"** (w tym pole `url`) i **"Osoby kontaktowe"**

### Scenariusz 6: RODO + GDPR

1. Z dashboardu kliknij **"RODO"** → `/admin/gdpr`
2. Powinieneś zobaczyć listę zgłoszeń RODO (na razie pusta)
3. Otwórz w incognito stronę `/privacy-policy` → policy ładuje się
4. Otwórz `/auth/request-data-deletion` (publiczny endpoint) — sprawdź że istnieje

### Scenariusz 7: Stale data / cache

1. Stwórz ofertę
2. Wyślij ją (status → `sent`)
3. Otwórz `/o/<token>` w nowej karcie
4. Wróć do `/admin/offers/[id]/edit`
5. Kliknij **"Soft-delete"** (admin only)
6. Odśwież `/o/<token>` → powinno dać 404 (nie cachuje stale state)

### Scenariusz 8: MFA (TOTP) — PR #13

1. Przy pierwszym logowaniu system prosi o włączenie MFA
2. Zeskanuj QR aplikacją (Google Authenticator / Microsoft Authenticator / Authy / 1Password)
3. Wpisz 6-cyfrowy kod → MFA aktywne
4. Wyloguj się i zaloguj ponownie → po haśle system prosi o kod TOTP
5. **Brute-force test:** wpisz błędny kod 11× pod rząd → po 10. próbie HTTP 429 (rate-limit)
6. `/admin` → profil → "Wyłącz MFA" (wymaga ponownego kodu) → unenroll działa

### Scenariusz 9: Reset hasła + rate-limit — PR #28

1. Wyloguj się. Na `/auth/signin` kliknij **"Zapomniałem hasła"** → `/auth/forgot-password`
2. Wpisz `tester@k2biznes.pl` → "Wyślij link"
3. Sprawdź skrzynkę — mail z `oferty@k2biznes.pl` (NIE onboarding@resend.dev) z linkiem resetu
4. Kliknij link → `/auth/reset-password` → ustaw nowe hasło → zaloguj się nowym
5. **Rate-limit test:** 6× pod rząd "Wyślij link" dla tego samego emaila → po 5. próbie HTTP 429
   (bucket restrictive 5/24h — anti-spam)

### Scenariusz 10: RODO — pełny flow usunięcia danych — PR #9

1. **Klient (publiczny):** otwórz `/auth/request-data-deletion` w incognito
2. Wpisz email + opcjonalny powód → "Wyślij żądanie"
3. Powinieneś dostać email potwierdzający (z `oferty@k2biznes.pl`)
4. **Admin:** zaloguj się, `/admin/gdpr` → nowe żądanie na liście (status `requested`)
5. Kliknij "Wykonaj usunięcie" → dane zanonimizowane (offers/events/profile)
6. Klient dostaje email "Twoje dane zostały usunięte"
7. Sprawdź `/admin/gdpr` → żądanie status `executed` + liczby zanonimizowanych rekordów

### Scenariusz 11: expires_at — edge cases — PR #33

1. Stwórz ofertę, wyślij ją z polem **"Wygaśnie"** ustawionym na **za 2 tygodnie**
2. Sprawdź email klienta — powinien mówić "link aktywny do {data}" (NIE "30 dni")
3. Wyślij drugą ofertę **bez** ustawiania wygaśnięcia → email mówi "bez terminu ważności"
4. **Walidacja przeszłości:** w pickerze daty spróbuj wybrać wczoraj/dziś → przeglądarka
   blokuje (min = teraz + 1h). Link z mailem otwiera się poprawnie (nie 404).

### Scenariusz 12: Email-failed marker — PR #42 (H16)

1. Na liście `/admin/offers` — jeśli któraś oferta ma czerwony badge "⚠ email nie dotarł",
   to znaczy że Resend zwrócił błąd przy wysyłce. Wyślij ofertę ponownie.
2. (Trudne do wywołania w teście — wymaga awarii Resend. Sprawdź tylko że badge NIE
   pojawia się przy normalnie wysłanych ofertach.)

### Scenariusz 13: Wypełnianie z transkrypcji (AI) — PR #82

1. W formularzu nowej oferty (`/admin/offers/new`) kliknij **"Wypełnij z transkrypcji"**.
2. Wklej kilka zdań notatki ze spotkania (nazwa firmy, branża, potrzeby, ewentualnie kwota)
   albo wgraj plik `.docx`/`.txt`. Kliknij analizę.
3. Sprawdź, że **puste** pola (nazwa firmy, branża, wielkość, województwo, wprowadzenie)
   uzupełniły się i są **podświetlone na żółto** ("do sprawdzenia"); wypełnione wcześniej
   pola pozostały bez zmian.
4. Jeśli kwota padła w tekście — powinna trafić do wartości projektu z adnotacją do potwierdzenia;
   jeśli program z biblioteki pasuje — powinien być podpowiedziany.
5. Panel pokazuje podsumowanie + ostrzeżenia. Nic nie zapisuje się automatycznie — dopiero
   "Stwórz ofertę" utrwala dane.
6. Uwaga środowiskowa: bez `ANTHROPIC_API_KEY` przycisk zwraca komunikat o niedostępności (503) —
   to oczekiwane, nie bug.

---

## 3. Znane ograniczenia / out of scope

Te punkty są **świadomie pominięte** w MVP — nie zgłaszaj jako bug:

| # | Co | Status |
|---|---|---|
| 1 | Pricing override per-variant (klikalne kwoty cennika) | Backlog (PR #21+) |
| 2 | Szablony pricingu | Backlog (PR #21+) |
| 3 | Edit mode in-place na widoku oferty | Backlog (PR #22+) |
| 4 | Upload logo/photo dla case_study/contact_person | Backlog (URL only) |
| 5 | Drag & drop reorder w katalogach | Backlog (manualny `display_order`) |
| 6 | Generowanie PDF w przeglądarce | Backend gotowy (`/api/public/offers/[token]/pdf`) — UI test może działać lub nie zależnie od konfiguracji puppeteer |
| 7 | Reset hasła z UI | Backlog (Supabase ma builtin, brak strony) |
| 8 | Bulk actions (mass-send, mass-delete) | Backlog |
| 9 | Sentry / monitoring | Wymaga konta Sentry — opcjonalne |
| 10 | Webhook do CRM | Działa, ale wymaga konta CRM (HubSpot/Pipedrive) — w testach pomijaj |

---

## 4. Co zgłaszać jako bug

- **Crashy** (5xx, biały ekran, "Application error")
- **Niespójność danych** (np. po PATCH oferta pokazuje stare wartości w innym widoku)
- **Niedostępne sekcje** (link prowadzi do 404 mimo że logika sugeruje że
  powinno działać)
- **Wysłany email nie dotarł** (sprawdź spam najpierw)
- **Pricing wariantów nie zgadza się z formułą** (zobacz `BACKEND_SPEC.md` sekcja 6
  jeśli masz dostęp; lub po prostu intuicyjnie — variant III nigdy nie powinien być
  tańszy od I dla tego samego dofinansowania)
- **Permission denied** dla operacji którą powinieneś móc zrobić jako super_admin
- **MFA nie wpuszcza** mimo poprawnego kodu z aplikacji

---

## 5. Co NIE zgłaszać jako bug

- **Brak kont innych testerów** — tylko 1 super_admin został przygotowany. Jeśli
  chcesz wielu, daj znać autorowi.
- **Pusty dashboard / forecast** — wszystko zerowe gdy brak ofert. Stwórz kilka,
  niektóre wyślij i zaakceptuj — wtedy KPI ożyją.
- **Powolne emaile** — staging używa Resend free tier, może być lag do 30s.
- **Wygląd na mobilnej** — tylko desktop był testowany pixel-perfect; mobile ma
  responsive ale nie wylizany (sekcja `@media max-width: 960px`).
- **Brak polskich logo klientów** — w stopce K2 + na Hero ring jest jedyna
  grafika brandowa; reszta to placeholdery (czeka na biznes).
- **Placeholder w "Zaufali nam"** — to jest celowe miejsce na case study;
  wybierz przy edycji oferty żeby wypełnić.

---

## 6. Jak zgłaszać uwagi

**Preferowana ścieżka**:
- **GitHub Issues**: https://github.com/tkalla79/k2biznes-oferta/issues — kliknij
  "New issue", opisz krok-po-kroku reprodukcję + co oczekiwałeś
- **Albo**: email do `t.kalla@k2biznes.pl` z `[OFERTA-TEST]` w temacie

**Format zgłoszenia**:

```
Tytuł: krótki opis problemu
Co robiłem: 1. ... 2. ... 3. ...
Czego oczekiwałem: ...
Co się stało: ...
Dane oferty (jeśli dotyczy): numer K2/2026/MM/NNN
URL: ...
Przeglądarka: Chrome 142 / Safari 18 / Firefox 130
Screenshot: (jeśli wizualne)
```

---

## 7. Skróty klawiszowe i triki

| Akcja | Jak |
|---|---|
| Powrót do listy ofert | "← Lista" w prawym górnym rogu edytora |
| Skopiowanie linku klienta | "Skopiuj link" w toolbar oferty (draft → preview URL z `?__preview=1`, sent+ → publiczny URL) |
| Otwarcie wszystkich 5 case studies | `/admin/case-studies` — lista |
| Otwarcie biblioteki programów wsparcia | `/admin/alt-programs` — lista |

---

## 8. Architektura (skrócie — dla curiosity)

- **Frontend**: Next.js 14 App Router + TypeScript + React 18
- **Backend**: Next.js API routes + Supabase (Postgres 17 + Auth PKCE + Storage)
- **Pricing engine**: pure function w `apps/web/lib/pricing/index.ts` (sekcja 6 spec)
- **Auth**: email+password, MFA TOTP wymagane dla admin/super_admin
- **Email**: Resend (`oferty@k2biznes.pl` verified) / Mailpit (lokalny dev)
- **Rate-limit**: Upstash Redis (login/MFA/RODO/PDF buckets)
- **Hosting**: Vercel (frontend + API routes serverless)
- **Monitoring**: Sentry (EU) + UptimeRobot

Spec wraz z kontraktami API: `docs/BACKEND_SPEC.md`.

---

## 9. Wersja dokumentu vs PR-y

| Data | Stan | Pokryte funkcje |
|---|---|---|
| 2026-04-28 | MVP (PR #22) | Scenariusze 1-7 |
| 2026-06-09 | po PR #44 | + Scenariusze 8-12: MFA, reset hasła+rate-limit, RODO flow, expires_at, email-failed marker |
| 2026-07-22 | etap 3 (po PR #82) | Scalenie katalogów programów (Scenariusz 5), biblioteka programów wsparcia w tworzeniu oferty (Scenariusz 1), + Scenariusz 13: wypełnianie z transkrypcji (AI) |

Przy dodaniu nowej funkcji (nowy PR z user-facing zmianą) — dopisz scenariusz
w sekcji 2 i bumpnij tę tabelę.

---

**Wersja dokumentu**: 2026-07-22 · etap 3 (po PR #82)
