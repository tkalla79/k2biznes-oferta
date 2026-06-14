-- Globalne ustawienia aplikacji (feature etap 2, uwaga PDF #1).
-- Generic key/value — na start: company_stats (statystyki firmowe w hero +
-- sekcji "Dlaczego K2"). Edytowalne raz w /admin/ustawienia, propagują na
-- wszystkie oferty (dane firmowe, nie per-klient).

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table app_settings enable row level security;

-- Read: każdy zalogowany (render oferty potrzebuje statów; oferta publiczna
-- czyta przez service role w page.tsx, ale RLS dla spójności).
create policy "read app_settings" on app_settings
  for select using (auth.role() = 'authenticated');
-- Write: super_admin (ustawienia firmowe).
create policy "super_admin writes app_settings" on app_settings
  for all using (public.is_super_admin());

-- Seed: obecne wartości hero/case study (475 mln / 288 / od 2015).
insert into app_settings (key, value) values (
  'company_stats',
  '{"funding":"475 mln zł","projects":"288","since":"od 2015"}'::jsonb
);
