-- Wewnetrzna akceptacja oferty przed wyslaniem do klienta.
--
-- Do tej pory nic nie bronilo wyslania oferty, ktorej nikt poza autorem nie
-- widzial, ani nie zostawialo sladu, kto zatwierdzil tresc. Osobny problem:
-- `PATCH /api/offers/:id` blokuje po wysylce tylko pola finansowe, a
-- `pricing_override` i `content` przechodzily bez sprawdzenia statusu - czyli
-- pod tym samym linkiem dalo sie klientowi podmienic kwoty i tresc oferty,
-- omijajac zamrozony `pricing_snapshot`.
--
-- Stad dwie kolumny i jedna regula: wysylka wymaga akceptacji, a kazda edycja
-- tego, co klient widzi, akceptacje kasuje (regula biznesowa, T. Kalla 2026-09).

alter table offers
  add column approved_by uuid references profiles(id) on delete set null,
  add column approved_at timestamptz;

-- Oba pola albo zadne - inaczej "zatwierdzona, ale nie wiadomo przez kogo"
-- byloby poprawnym stanem, a caly sens tej zmiany to wskazanie osoby.
alter table offers add constraint offers_approval_ck
  check ((approved_by is null) = (approved_at is null));

comment on column offers.approved_by is
  'Kto zatwierdzil tresc oferty do wyslania (admin+). NULL = niezatwierdzona.';
comment on column offers.approved_at is
  'Kiedy zatwierdzono. Kasowane przy kazdej edycji tresci lub cennika oferty.';

-- Historia aktywnosci oferty dostaje dwa nowe zdarzenia.
alter type event_type add value if not exists 'approved';
alter type event_type add value if not exists 'approval_revoked';

-- Swiadomie BEZ backfillu: oferty wyslane przed ta zmiana zostaja
-- niezatwierdzone. Nie wiemy, kto je przeczytal, a wpisanie tam kogokolwiek
-- byloby falszywym sladem audytowym. Skutek: ponowna wysylka starej oferty
-- wymaga jednego klikniecia "Zatwierdz".
