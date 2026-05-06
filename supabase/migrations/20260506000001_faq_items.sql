-- Globalna lista FAQ — pojawia się na każdej publicznej ofercie (sekcja 10).
-- CRUD przez /admin/faq (admin only). Sortowanie po display_order.
-- Public page: select where is_active=true order by display_order asc.

create table if not exists faq_items (
  id          uuid primary key default gen_random_uuid(),
  question    text not null check (length(question) between 1 and 500),
  answer      text not null check (length(answer) between 1 and 4000),
  display_order int not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index if not exists idx_faq_items_order on faq_items (display_order) where deleted_at is null;
create index if not exists idx_faq_items_active on faq_items (is_active, display_order) where deleted_at is null;

-- updated_at trigger
create or replace function trg_faq_items_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists faq_items_updated_at on faq_items;
create trigger faq_items_updated_at
  before update on faq_items
  for each row execute function trg_faq_items_set_updated_at();

-- RLS: tabela publiczna do odczytu (public ofeerta), CRUD przez service role w admin API.
alter table faq_items enable row level security;

drop policy if exists faq_items_select_public on faq_items;
create policy faq_items_select_public on faq_items
  for select
  using (deleted_at is null and is_active = true);

-- Seed: bieżące 6 pozycji z apps/web/app/o/[token]/staticContent.ts
insert into faq_items (question, answer, display_order) values
  ('Co jeśli nasz wniosek nie otrzyma dofinansowania?',
   'Success fee naliczane jest wyłącznie po pozytywnej ocenie. Opłata wstępna pokrywa koszty przygotowania dokumentacji. W przypadku odrzucenia wniosku — jeśli istnieją szanse — przygotujemy protest zgodnie z procedurą odwoławczą.',
   10),
  ('Czy mogę sam złożyć wniosek, a Wy tylko go zweryfikujecie?',
   'Tak. Możemy pracować w modelu pełnego prowadzenia projektu lub jako konsultant wspierający — w zależności od Państwa zasobów i potrzeb. W tym drugim przypadku wycena jest indywidualna.',
   20),
  ('Jak długo trwa przygotowanie dokumentacji?',
   'Standardowo 6–10 tygodni od startu współpracy do złożenia wniosku — zależy od złożoności projektu, dostępności audytu energetycznego oraz harmonogramu naboru.',
   30),
  ('Czy współpraca obejmuje również obsługę po przyznaniu dofinansowania?',
   'Tak — jest to etap opcjonalny, rozliczany w modelu miesięcznym. Klient decyduje, czy chce kontynuować współpracę przy obsłudze projektu.',
   40),
  ('Kto jest właścicielem dokumentacji po zakończeniu współpracy?',
   'Klient. Cała dokumentacja aplikacyjna oraz materiały powstałe w ramach usługi są własnością klienta — przekazujemy je w formie edytowalnej.',
   50),
  ('Jak wygląda ochrona danych i informacji poufnych?',
   'Każda współpraca rozpoczyna się od podpisania NDA. Dane przechowujemy w zaszyfrowanej formie na serwerach zlokalizowanych w UE.',
   60)
on conflict do nothing;
