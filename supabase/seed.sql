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
--    s5m jest reprodukowany z testów Vitest z sekcji 6.1 i jest pewny (real).
--    Pozostałe 4 mają PLACEHOLDER values dobrane przez liniową ekstrapolację
--    z s5m. Biznes musi zweryfikować przed pierwszym wysłaniem oferty.
-- -----------------------------------------------------------------------------

insert into pricing_segments (id, label, funding_min, funding_max, base_fee,
                              sf_variant_1, sf_variant_2, sf_variant_3,
                              monthly_fee, display_order) values
  -- PLACEHOLDER (do weryfikacji przez biznes — niższe widełki, mniejsza marża)
  ('s500k',   'do 500 tys. (mikro)',     0,         500000,     8000, 0.0600, 0.0700, 0.0800, 2000,    1),
  ('s1m',     '500 tys. – 1M',           500000,   1000000,    10000, 0.0550, 0.0650, 0.0750, 2500,    2),
  ('s2m',     '1M – 2M',                1000000,   2000000,    12000, 0.0500, 0.0600, 0.0700, 3000,    3),
  -- REAL — s5m jest punktem odniesienia z BACKEND_SPEC sekcja 6.1
  ('s5m',     '2M – 5M (SMART MŚP)',    2000000,   5000000,    15000, 0.0450, 0.0550, 0.0700, 4000,    4),
  -- PLACEHOLDER (większe projekty, wyższy ryczałt, niższy success fee)
  ('s5mplus', '5M+ (duże projekty)',    5000000,      null,    20000, 0.0400, 0.0500, 0.0600, 5000,    5)
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
-- 5. case_studies (5 sztuk: 1 real + 4 PLACEHOLDER do uzupełnienia przez biznes)
-- -----------------------------------------------------------------------------

insert into case_studies (id, client, tag, title, paragraph_1, industries, program_tags, display_order) values
  -- REAL (z OFERTA_INTERAKTYWNA)
  (
    'zugil-smart',
    'ZUGIL S.A.',
    'FENG · Ścieżka SMART',
    'Wzrost konkurencyjności przez B+R',
    'ZUGIL S.A. uzyskał dofinansowanie z FENG na projekt B+R w obszarze rozwiązań przemysłowych. ' ||
    'K2Biznes prowadził pełen proces aplikacyjny — od koncepcji projektu po rozliczenie.',
    array['produkcja', 'metalurgia']::text[],
    array['feng-smart']::text[],
    1
  ),
  -- PLACEHOLDER #1 — IT/SaaS (zostawiamy bo realnie wykorzystywany jako Kocot Kids
  -- po edycji w panelu admin, mimo że id wciąż zaczyna się od 'placeholder-')
  (
    'placeholder-saas-eic',
    '[Klient SaaS — placeholder]',
    'Horyzont Europa · EIC Accelerator',
    'Skalowanie produktu SaaS na rynki UE',
    'PLACEHOLDER: opis projektu skalowania platformy SaaS. K2Biznes prowadził aplikację ' ||
    'do EIC Accelerator (grant + equity), wsparcie w due diligence i negocjacjach.',
    array['it', 'saas']::text[],
    array['horyzont-eic-accelerator']::text[],
    2
  )
  -- 3 placeholder'y (energy/agro/logistics) usunięte z seed po feedbacku biznesu
  -- (PR #26): biznes uzupełnia własnymi case studies przez panel admin.
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 6. contact_persons (4 sztuki: 1 real + 3 PLACEHOLDER)
-- -----------------------------------------------------------------------------
-- profile_id pozostaje null — bootstrap super admina jest poniżej (sekcja 3.4).
-- Po pierwszym logowaniu super_admina trzeba zlinkować ręcznie albo przez UI.

insert into contact_persons (id, name, role, email, display_order) values
  -- REAL
  ('tomasz-kalla',           'Tomasz Kalla',           'CEO, K2Biznes',                'tomasz.kalla@k2biznes.pl',     1),
  -- PLACEHOLDER (do podmiany na realnych konsultantów)
  ('placeholder-feng-lead',  '[Ekspert FENG — placeholder]',  'Senior Konsultant FENG',  'placeholder.feng@k2biznes.pl',  2),
  ('placeholder-fepw-lead',  '[Ekspert FEPW — placeholder]',  'Senior Konsultant FEPW',  'placeholder.fepw@k2biznes.pl',  3),
  ('placeholder-regional',   '[Koordynator regionalny — placeholder]', 'Koordynator regionalny', 'placeholder.regional@k2biznes.pl', 4)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 7. programs (25 sztuk — MVP seed; biznes weryfikuje opisy i terminy naborów)
--
-- Grupy (wg organu finansującego):
--   - FENG  (8) — Fundusze Europejskie dla Nowoczesnej Gospodarki
--   - FEPW  (4) — Fundusze Europejskie dla Polski Wschodniej
--   - KPO   (4) — Krajowy Plan Odbudowy
--   - REG   (5) — programy regionalne (FELu, FERS, FEM, FEDS)
--   - HORYZONT (4) — Horyzont Europa / EIC / NCBR / BGK
-- -----------------------------------------------------------------------------

insert into programs (id, group_name, label, description, display_order) values
  -- FENG (Fundusze Europejskie dla Nowoczesnej Gospodarki) — 8 programów
  ('feng-smart',              'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Ścieżka SMART',                         'Modułowe wsparcie B+R+I dla MŚP, midcap i dużych firm.', 10),
  ('feng-kreatywne',          'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Kreatywne MŚP',                         'Wsparcie sektorów kreatywnych.',                          11),
  ('feng-innowacje-cyfrowe',  'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Innowacje cyfrowe',                     'Cyfrowa transformacja MŚP — wdrożenia AI, IoT, chmury.',  12),
  ('feng-innowacje-eko',      'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Innowacje proekologiczne',              'Inwestycje redukujące ślad środowiskowy.',                13),
  ('feng-cyfryzacja-bony',    'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Bony na cyfryzację',                    'Granty na audyt cyfrowy + wdrożenie dla MŚP.',           14),
  ('feng-promocja-marki',     'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Promocja marki innowacyjnych MŚP',      'Eksport, targi, branding międzynarodowy.',                15),
  ('feng-eurogranty',         'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Granty na Eurogranty',                  'Wsparcie przygotowania wniosków do programów UE.',        16),
  ('feng-gielda',             'FENG · Fundusze Europejskie dla Nowoczesnej Gospodarki', 'Wsparcie wejścia na giełdę',            'Koszty IPO/SPO dla innowacyjnych MŚP.',                   17),

  -- FEPW (Fundusze Europejskie dla Polski Wschodniej) — 4 programy
  ('fepw-wzornictwo',         'FEPW · Fundusze Europejskie dla Polski Wschodniej',      'Wzornictwo w MŚP',                      'Design i wdrożenia w MŚP w Polsce Wschodniej.',           20),
  ('fepw-automatyzacja',      'FEPW · Fundusze Europejskie dla Polski Wschodniej',      'Automatyzacja i robotyzacja',           'Wdrożenia robotów + automatyki w MŚP.',                   21),
  ('fepw-goz',                'FEPW · Fundusze Europejskie dla Polski Wschodniej',      'Gospodarka o obiegu zamkniętym',        'Recykling, reuse, zero-waste w produkcji.',               22),
  ('fepw-platformy',          'FEPW · Fundusze Europejskie dla Polski Wschodniej',      'Platformy startowe',                    'Inkubacja i wsparcie pre-seed dla startupów.',            23),

  -- KPO (Krajowy Plan Odbudowy) — 4 programy
  ('kpo-ipcei',               'KPO · Krajowy Plan Odbudowy',                            'IPCEI',                                  'Important Projects of Common European Interest.',         30),
  ('kpo-inwestycje-msp',      'KPO · Krajowy Plan Odbudowy',                            'Inwestycje w MŚP',                       'Modernizacja parku maszynowego, transformacja energetyczna.', 31),
  ('kpo-goz',                 'KPO · Krajowy Plan Odbudowy',                            'Inwestycje w gospodarkę cyrkularną',     'Gospodarka o obiegu zamkniętym — projekty pilotażowe.',   32),
  ('kpo-rolnictwo',           'KPO · Krajowy Plan Odbudowy',                            'Modernizacja rolnictwa',                 'Robotyzacja, IoT i automatyzacja w sektorze rolno-spożywczym.', 33),

  -- Regionalne (FELu, FERS, FEM, FEDS) — 5 programów
  ('felu-rd',                 'REG · Programy regionalne',                              'FELu · Działalność B+R',                'Regionalne wsparcie B+R w woj. lubelskim.',               40),
  ('fers-cyfrowe',            'REG · Programy regionalne',                              'FERS · Cyfrowe usługi publiczne',       'Cyfryzacja procesów dla MŚP w regionie.',                 41),
  ('fem-innowacje',           'REG · Programy regionalne',                              'FEM · Innowacje regionalne',            'Wsparcie B+R w woj. mazowieckim.',                        42),
  ('feds-wzornictwo',         'REG · Programy regionalne',                              'FEDS · Wzornictwo',                     'Wsparcie wzornictwa w woj. dolnośląskim.',                43),
  ('feds-automatyzacja',      'REG · Programy regionalne',                              'FEDS · Automatyzacja',                  'Wdrożenia automatyki w woj. dolnośląskim.',               44),

  -- Horyzont Europa / EIC / NCBR / BGK — 4 programy
  ('horyzont-eic-accelerator', 'HORYZONT · Horyzont Europa i programy krajowe',         'EIC Accelerator',                       'Grant + equity dla deeptech (do 2,5M€ + 15M€).',          50),
  ('horyzont-eic-pathfinder', 'HORYZONT · Horyzont Europa i programy krajowe',          'EIC Pathfinder',                        'Wczesne badania o wysokim ryzyku/potencjale (do 4M€).',   51),
  ('ncbr-szybka-sciezka',     'HORYZONT · Horyzont Europa i programy krajowe',          'NCBR · Szybka Ścieżka',                 'Krajowy program B+R dla MŚP.',                            52),
  ('bgk-premia',              'HORYZONT · Horyzont Europa i programy krajowe',          'BGK · Premia Technologiczna',           'Częściowa spłata kredytu inwestycyjnego na nową technologię.', 53)
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
