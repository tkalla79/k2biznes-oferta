# K2Biznes Oferta — instrukcja dla testera

System ofertowy K2Biznes (MVP). Konsultant tworzy oferty dotacyjne dla klientów,
wysyła linkiem, klient akceptuje online.

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

- **Staging**: `https://[do-uzupelnienia].vercel.app`
  *(URL otrzymasz emailem gdy staging zostanie wdrożony)*
- **Lokalnie u dewelopera (tunel cloudflared)**: link otrzymujesz emailem na
  czas testów *(nie zostawiaj otwartego — laptop musi być włączony)*

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
   - **Program**: wybierz z dropdown (25 programów — zacznij od `Ścieżka SMART`)
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

1. Z dashboardu kliknij **"Programy"** → `/admin/programs`
2. Powinno być 25 programów w 5 grupach (FENG/FEPW/KPO/REG/HORYZONT)
3. Kliknij "+ Nowy program" → wypełnij i zapisz
4. Kliknij "Edytuj" przy istniejącym → zmień nazwę → zapisz
5. Toggle checkbox `is_active` przy programie → odśwież stronę → status pozostał
6. Tak samo dla **"Case studies"** i **"Osoby kontaktowe"**

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
| Otwarcie 25 programów | `/admin/programs` — lista zgrupowana |

---

## 8. Architektura (skrócie — dla curiosity)

- **Frontend**: Next.js 14 App Router + TypeScript + React 18
- **Backend**: Next.js API routes + Supabase (Postgres 15 + Auth + Storage)
- **Pricing engine**: pure function w `apps/web/lib/pricing/index.ts` (sekcja 6 spec)
- **Auth**: email+password, MFA TOTP wymagane dla admin/super_admin
- **Email**: Resend (prod) / Mailpit (lokalny dev)
- **Hosting**: Vercel (frontend + API routes serverless)

Spec wraz z kontraktami API: `docs/BACKEND_SPEC.md` (jeśli udostępnione).

---

**Wersja dokumentu**: 2026-04-28 · MVP testing handoff
