-- Tryb pożyczkowy ofert (etap: integracja pożyczek).
-- Dodaje typ oferty `offer_kind` ('grant' | 'loan') i luzuje `funding_rate`
-- (wymagany tylko dla dotacji). Dane pożyczki (produkt + stawki) trzymane są
-- w `offers.content.loan` (jsonb) — bez nowych kolumn i bez katalogu produktów.
-- Zmiana addytywna: istniejące oferty dostają offer_kind='grant'.

-- 1. Typ oferty
alter table offers
  add column offer_kind text not null default 'grant'
  check (offer_kind in ('grant', 'loan'));

-- 2. funding_rate wymagany tylko dla dotacji (pożyczka: NULL).
alter table offers alter column funding_rate drop not null;

alter table offers add constraint offers_funding_rate_grant_ck
  check (offer_kind <> 'grant' or funding_rate is not null);

-- 3. Indeks pod filtry listy po typie oferty.
create index if not exists idx_offers_kind on offers (offer_kind);

comment on column offers.offer_kind is
  'Typ oferty: grant (dotacja, silnik segmentowy) lub loan (pożyczka, opłata wstępna + % od kwoty pożyczki). Dane pożyczki w content.loan.';
