-- Oferta na sam zakres 2: realizacja i rozliczenie projektu (tryb `exec`).
--
-- Rzadki, ale powtarzalny przypadek: klient ma juz decyzje o dofinansowaniu
-- (wniosek pisal sam albo kto inny) i szuka wylacznie obslugi projektu.
-- Model wynagrodzenia: sama stawka miesieczna, bez oplaty wstepnej, bez
-- wariantow i bez success fee (regula biznesowa, T. Kalla 2026-09).
--
-- Dane trzymamy w `offers.content.exec` (stawka + liczba miesiecy), a kolumne
-- `project_value` reuzywamy jako KWOTE PRZYZNANEGO DOFINANSOWANIA - tak samo
-- jak tryb `loan` reuzywa ja na kwote pozyczki. Zmiana addytywna: istniejace
-- oferty zostaja przy swoim offer_kind.

-- 1. Trzeci typ oferty.
alter table offers drop constraint if exists offers_offer_kind_check;

alter table offers add constraint offers_offer_kind_check
  check (offer_kind in ('grant', 'loan', 'exec'));

-- 2. funding_rate pozostaje wymagany tylko dla dotacji - oferta `exec` operuje
--    kwota juz przyznana, wiec intensywnosc jest bez znaczenia (NULL).
--    Warunek `offers_funding_rate_grant_ck` obejmuje to bez zmian.

comment on column offers.offer_kind is
  'Typ oferty: grant (dotacja, silnik segmentowy), loan (pozyczka, oplata wstepna + % od kwoty pozyczki) lub exec (sam zakres 2: realizacja i rozliczenie, stawka miesieczna). Dane loan/exec w content.loan / content.exec.';

comment on column offers.project_value is
  'Dotacja: wartosc projektu netto. Pozyczka: wnioskowana kwota pozyczki. Exec: kwota przyznanego dofinansowania.';
