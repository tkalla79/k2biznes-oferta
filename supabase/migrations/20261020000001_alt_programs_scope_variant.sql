-- Wariant zakresu prac deklarowany przy programie, zamiast zgadywany z nazwy.
--
-- Do tej pory oferta rozpoznawała Program „Kultura" (Fundusze Norweskie i EOG)
-- regexem po nazwie rekomendowanej pozycji: /\b(EOG|norwesk)/i. Działało,
-- dopóki nazwy się nie zmieniły — nowy nabór nazwany inaczej po cichu
-- dostawał krajowy zakres prac, a klient czytał w ofercie czynności, których
-- u niego nie wykonujemy. Zgadywanie z tekstu nie jest źródłem prawdy.
--
-- `text` + check, nie enum — dokładnie jak `offers.offer_kind`. Dojście
-- kolejnego wariantu to `alter table ... drop/add constraint`, które cofa się
-- w transakcji; `alter type ... add value` nie.
--
-- UWAGA przy dodawaniu wariantu: sam wpis w checku nie wystarczy. Każdy
-- wariant musi mieć swoje listy czynności w `staticContent.ts` i wpis w
-- `SCOPE_BY_VARIANT` — inaczej oferta pokaże zakres standardowy.

alter table alt_programs
  add column scope_variant text not null default 'standard'
  check (scope_variant in ('standard', 'culture'));

comment on column alt_programs.scope_variant is
  'Który zestaw czynności (sekcja 03) pokazuje oferta z tym programem jako rekomendowanym: standard | culture.';

-- Jednorazowy backfill tą samą regułą, którą dotąd stosował kod. Nie jest to
-- utrwalenie zgadywania: od teraz wartość jest jawna w panelu i człowiek może
-- ją poprawić. Chodzi o to, żeby biblioteka startowała poprawnie, a nie żeby
-- ktoś musiał przeklikać wszystkie pozycje.
update alt_programs
   set scope_variant = 'culture'
 where name ~* '\m(EOG|norwesk)'
    or program ~* '\m(EOG|norwesk)';
