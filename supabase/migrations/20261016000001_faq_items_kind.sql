-- FAQ per typ oferty.
--
-- `faq_items` było jedną globalną listą, a publiczna oferta używała jej tylko
-- dla dotacji: pożyczka i sam zakres 2 dostawały zestawy zaszyte w kodzie
-- (`LOAN_FAQ_ITEMS`, `EXEC_FAQ_ITEMS`). Skutek: FAQ pożyczkowe było zamknięte
-- na edycję z panelu — a to właśnie tam stoi zdanie o podstawie naliczenia
-- wynagrodzenia wynikowego, które dla FRS i PAKCER jest nieprawdziwe.
--
-- Kolumna `kind` dzieli listę na trzy niezależne zestawy. Typ `text` + check,
-- a nie enum — dokładnie tak jak `offers.offer_kind`, żeby czwarty typ oferty
-- nie wymagał `alter type` (ten nie cofa się w transakcji).

alter table faq_items
  add column kind text not null default 'grant'
  check (kind in ('grant', 'loan', 'exec'));

comment on column faq_items.kind is
  'Dla jakiego typu oferty to pytanie: grant | loan | exec. Oferta pokazuje tylko swój zestaw.';

-- Istniejące wiersze zostają przy 'grant' (default) — to jedyny typ, który
-- dotąd czytał tę tabelę, więc zmiana jest dla klienta niewidoczna.

-- Panel filtruje po typie, publiczna oferta czyta aktywne wiersze swojego typu.
create index if not exists idx_faq_items_kind on faq_items (kind, display_order);
