-- Szablony oferty (feature #1, spec 2026-06-09). Wzorzec rozpiski bez danych
-- klienta — pre-fill formularza przy tworzeniu nowej oferty. Globalne (zespół).
--
-- template_data jsonb = snapshot pól FormState minus klient (patrz
-- apps/web/lib/offers/template.ts TEMPLATE_FIELDS). Świadomie nie-relacyjne:
-- case_study_id/contact_person_id w jsonb (szablon to wzorzec roboczy, nie
-- dane wymagające integralności — graceful gdy katalog-pozycja usunięta).

create table offer_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  template_data jsonb not null,
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);

alter table offer_templates enable row level security;

-- Globalne: każdy zalogowany czyta i tworzy (ustalone w ankiecie #1).
create policy "read offer_templates" on offer_templates
  for select using (auth.role() = 'authenticated');
create policy "write offer_templates" on offer_templates
  for all using (auth.role() = 'authenticated');
