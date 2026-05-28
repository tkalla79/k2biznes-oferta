# Brief dla radcy prawnego — klauzula RODO

**Wysłano do radcy:** 2026-05-28 (zatwierdzone przez Tomka)
**Aktualna wersja klauzuli:** `v1-2026-04` (napisana przez programistę, do review prawnego)

---

## Kontekst

SaaS K2Biznes Oferta do tworzenia ofert handlowych. Klient otrzymuje link do oferty (`/o/[token]`), akceptuje online wpisując imię + email + zaznaczając checkbox zgody.

## Aktualny tekst zgody (v1)

> *"Akceptując ofertę wyrażam zgodę na przetwarzanie moich danych osobowych przez K2Biznes Sp. z o.o. w celu realizacji procesu ofertowania i ewentualnego zawarcia umowy. Mam prawo do dostępu, sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz do wniesienia sprzeciwu. Pełna polityka prywatności: https://oferta.k2biznes.pl/privacy-policy"*

## Co aplikacja zbiera od klienta

- Imię + nazwisko (osoba akceptująca)
- Email
- Opcjonalny komentarz
- IP klienta (hashowany z rotowanym saltem, retencja per polityka)
- User-agent (do audit log)

## Cel przetwarzania

Złożenie i akceptacja oferty handlowej, ewentualne zawarcie umowy o usługi doradcze (pozyskiwanie funduszy UE).

## Infrastruktura techniczna

- **Hosting bazy danych:** Supabase Cloud (eu-central-1 / Frankfurt)
- **Hosting aplikacji:** Vercel (Europa)
- **Email transactional:** Resend (US-based, podmiot przetwarzający)
- **Brak automatycznego decision-makingu** (no profiling, no algorithmic decisions)
- **Transfer danych poza EOG:** TYLKO dla wysyłki maila przez Resend (US). Hosting bazy + frontend w EU.

## Polityka prywatności

https://oferta.k2biznes.pl/privacy-policy

## Prośba do radcy

Przegląd klauzuli pod kątem zgodności z RODO:
- Art. 6 ust. 1 — podstawa prawna przetwarzania
- Art. 7 — warunki wyrażenia zgody (dobrowolność, konkretność, świadomość, jednoznaczność)
- Art. 13 — informacje przekazywane podmiotowi danych
- Art. 14 — informacje gdy dane nie są pozyskiwane bezpośrednio od osoby
- Wymóg DPA z Resend (podmiot przetwarzający w US)?
- Czy potrzebny IOD (Inspektor Ochrony Danych) dla skali działalności?

## Po review — proces wprowadzenia v2

Radca dostarcza nowy tekst → Claude wprowadza migracją SQL:

```sql
-- 1. Stary v1 dezaktywujemy (zachowujemy historycznie dla ofert już zaakceptowanych)
update gdpr_clauses set is_current=false where version='v1-2026-04';

-- 2. Nowy v2 jako aktualny
insert into gdpr_clauses (version, text, text_hash, is_current)
values (
  'v2-2026-XX',
  '<NOWY TEKST OD RADCY>',
  encode(digest('<NOWY TEKST OD RADCY>', 'sha256'), 'hex'),
  true
);
```

Stare oferty zachowują w `offers.gdpr_clause_version='v1-2026-04'` — dowód co klient zaakceptował w danym momencie. Nowe oferty automatycznie pobierają v2 z `gdpr_clauses where is_current=true`.

## Status

- [x] Brief zatwierdzony (2026-05-28)
- [x] Wysłany do radcy
- [x] Otrzymane v2 / poprawki — pełna polityka + krótka klauzula (wariant B)
- [x] v2 wdrożony przez REST API insert (2026-05-28 20:20 UTC)
  - `gdpr_clauses.v2-2026-05` is_current=true
  - `gdpr_clauses.v1-2026-04` is_current=false (zachowane dla starych ofert)
- [x] `/privacy-policy` page zaktualizowany (commit `6991a83`)
- [ ] Verify: nowa oferta używa v2 (smoke test — utworz testowa oferta i sprawdz checkbox text na `/o/[token]`)
