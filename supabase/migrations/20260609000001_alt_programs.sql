-- Biblioteka "Inne możliwości wsparcia" (alt-programy do wyboru w ofercie).
-- Feature #2 (docs/superpowers/specs/2026-06-09-templates-altprograms-design.md).
-- Wzorzec katalogu `programs`. Konsultant wybiera z biblioteki (multi-select)
-- + może dopisać ad-hoc per oferta. Snapshot trafia do offers.content.altPrograms.

create table alt_programs (
  id              text primary key,
  name            text not null,
  program         text not null,
  nabor           text,
  "desc"          text,
  url             text,
  display_order   integer not null default 100,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table alt_programs enable row level security;

-- Read: każdy zalogowany (konsultant wybiera w OfferForm).
create policy "read alt_programs" on alt_programs
  for select using (auth.role() = 'authenticated');

-- Write: super_admin (jak programs/case_studies — sekcja 4.4).
create policy "super_admin writes alt_programs" on alt_programs
  for all using (public.is_super_admin());

-- Seed: 4 programy z dotychczasowego staticContent.ts ALT_PROGRAMS.
insert into alt_programs (id, name, program, nabor, "desc", url, display_order) values
  ('sciezka-smart', 'Ścieżka SMART', 'FENG 2021–2027', 'IV kw. 2026',
   'Kompleksowy rozwój firm poprzez projekty B+R, wdrożenie innowacji, infrastrukturę, kompetencje i internacjonalizację.',
   'https://www.k2biznes.pl/sciezka-smart/', 10),
  ('cyfryzacja-msp', 'FENG Działanie 2.32', 'Cyfryzacja MŚP', 'I kw. 2026',
   'Wsparcie transformacji cyfrowej: oprogramowanie, sprzęt IT, cyberbezpieczeństwo, szkolenia dla pracowników.',
   'https://www.k2biznes.pl/cyfryzacja-msp/', 20),
  ('fundusze-regionalne', 'Fundusze regionalne', 'FE dla Opolskiego', 'nabór ciągły',
   'Dotacje na inwestycje produkcyjne i OZE dla firm z województwa opolskiego. Wyższa intensywność pomocy.',
   'https://www.k2biznes.pl/fundusze-regionalne/', 30),
  ('ncbr-bridge-alfa', 'NCBR BRIdge Alfa', 'Finansowanie B+R', 'konkursy kwartalne',
   'Finansowanie prac badawczo-rozwojowych dla projektów na wczesnym etapie rozwoju technologicznego.',
   'https://www.k2biznes.pl/ncbr-bridge-alfa/', 40);
