-- =============================================================================
-- K2Biznes Oferta — seed (BACKEND_SPEC.md v1.1, sekcja 3.4 + Appendix C)
-- =============================================================================
-- Uruchamiane przez `supabase db reset` po migracjach.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. pricing_config (defaults — sekcja 3.2.7 / Appendix C.2)
-- -----------------------------------------------------------------------------

insert into pricing_config (id, loyalty_discount, multi_discount, min_sf_amount, min_base_fee)
values ('global', 0.20, 0.20, 35000, 6000)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. pricing_segments (Appendix C.1)
--    UWAGA: 4 segmenty mają placeholder 0/0/0/0/0 — biznes musi uzupełnić
--    przed produkcyjnym deployem. s5m jest reprodukowany z testów Vitest
--    z sekcji 6.1 i jest pewny.
-- -----------------------------------------------------------------------------

insert into pricing_segments (id, label, funding_min, funding_max, base_fee,
                              sf_variant_1, sf_variant_2, sf_variant_3,
                              monthly_fee, display_order) values
  ('s500k',   'do 500 tys. (mikro)',     0,         500000,        0,    0,      0,      0,      0,    1),
  ('s1m',     '500 tys. – 1M',           500000,   1000000,        0,    0,      0,      0,      0,    2),
  ('s2m',     '1M – 2M',                1000000,   2000000,        0,    0,      0,      0,      0,    3),
  ('s5m',     '2M – 5M (SMART MŚP)',    2000000,   5000000,    15000, 0.0450, 0.0550, 0.0700, 4000,    4),
  ('s5mplus', '5M+ (duże projekty)',    5000000,      null,        0,    0,      0,      0,      0,    5)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. ip_hash_salts (sekcja 11.7) — pierwszy salt
-- -----------------------------------------------------------------------------

insert into ip_hash_salts (salt)
select encode(gen_random_bytes(32), 'hex')
where not exists (select 1 from ip_hash_salts);

-- -----------------------------------------------------------------------------
-- 4. gdpr_clauses (sekcja 11.6) — pierwsza wersja klauzuli
-- -----------------------------------------------------------------------------

insert into gdpr_clauses (version, text, text_hash, is_current)
values (
  'v1-2026-04',
  'Akceptując ofertę wyrażam zgodę na przetwarzanie moich danych osobowych przez K2Biznes Sp. z o.o. ' ||
  'w celu realizacji procesu ofertowania i ewentualnego zawarcia umowy. Mam prawo do dostępu, ' ||
  'sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz do wniesienia ' ||
  'sprzeciwu. Pełna polityka prywatności: https://app.k2biznes.pl/privacy-policy',
  encode(digest(
    'Akceptując ofertę wyrażam zgodę na przetwarzanie moich danych osobowych przez K2Biznes Sp. z o.o. ' ||
    'w celu realizacji procesu ofertowania i ewentualnego zawarcia umowy. Mam prawo do dostępu, ' ||
    'sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia danych oraz do wniesienia ' ||
    'sprzeciwu. Pełna polityka prywatności: https://app.k2biznes.pl/privacy-policy',
    'sha256'
  ), 'hex'),
  true
)
on conflict (version) do nothing;

-- -----------------------------------------------------------------------------
-- 5. case_studies (1 startowy z OFERTA_INTERAKTYWNA — sekcja 3.4)
-- -----------------------------------------------------------------------------

insert into case_studies (id, client, tag, title, paragraph_1, industries, program_tags, display_order)
values (
  'zugil-smart',
  'ZUGIL S.A.',
  'FENG · Ścieżka SMART',
  'Wzrost konkurencyjności przez B+R',
  'ZUGIL S.A. uzyskał dofinansowanie z FENG na projekt B+R w obszarze rozwiązań przemysłowych. ' ||
  'K2Biznes prowadził pełen proces aplikacyjny — od koncepcji projektu po rozliczenie.',
  array['produkcja', 'metalurgia']::text[],
  array['feng-smart']::text[],
  1
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. contact_persons (1 startowy z OFERTA_INTERAKTYWNA — sekcja 3.4)
-- -----------------------------------------------------------------------------
-- profile_id pozostaje null — bootstrap super admina jest poniżej (sekcja 3.4).
-- Po pierwszym logowaniu super_admina trzeba zlinkować ręcznie albo przez UI.

insert into contact_persons (id, name, role, email, display_order)
values (
  'tomasz-kalla',
  'Tomasz Kalla',
  'CEO, K2Biznes',
  'tomasz.kalla@k2biznes.pl',
  1
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 7. programs (minimalne 5 do startu — biznes uzupełni do ~25 przez UI)
-- -----------------------------------------------------------------------------

insert into programs (id, group_name, label, description, display_order) values
  ('feng-smart',   'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Ścieżka SMART · FENG',  'Modułowe wsparcie B+R+I dla MŚP i dużych firm.', 10),
  ('feng-kreatywne', 'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Ścieżka SMART · Kreatywne MŚP', 'Wsparcie sektorów kreatywnych.', 20),
  ('fepw-wzornictwo', 'FEPW · Fundusze Europejskie dla Polski Wschodniej', 'Wzornictwo w MŚP · FEPW', 'Design i wdrożenia w MŚP w Polsce Wschodniej.', 30),
  ('kpo-ipcei',    'KPO · Krajowy Plan Odbudowy', 'IPCEI · KPO', 'Important Projects of Common European Interest.', 40),
  ('felu-rd',      'FELu · Fundusze Europejskie dla Lubelskiego', 'Działalność B+R · FELu', 'Regionalne wsparcie B+R.', 50)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 8. Bootstrap super admina (sekcja 3.4, B37)
-- -----------------------------------------------------------------------------
--
-- Wykonywane RĘCZNIE po pierwszym `supabase db reset` (lub przez Edge Function w prod):
--
--   1. W Supabase Studio (lub przez API):
--      - Auth → Users → Invite user (email: $SUPER_ADMIN_EMAIL)
--      - Po inserts do auth.users trigger handle_new_auth_user() utworzy profile
--        z domyślną rolą 'consultant'.
--   2. Promocja na super_admin (przez SQL z service role):
--
--        update profiles set role = 'super_admin'
--          where email = current_setting('app.super_admin_email', true);
--
--      lub jednorazowo:
--
--        update profiles set role = 'super_admin'
--          where email = 'tomasz.kalla@k2biznes.pl';
--
--   3. Propagacja claim do JWT (bash + supabase service role):
--
--        curl -X POST "$SUPABASE_URL/auth/v1/admin/users/<user_id>" \
--          -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
--          -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
--          -d '{"app_metadata":{"role":"super_admin"}}'
--
--      W produkcji opisujemy to w runbooku w docs/runbook-bootstrap.md.
-- -----------------------------------------------------------------------------

-- =============================================================================
-- KONIEC seed
-- =============================================================================
