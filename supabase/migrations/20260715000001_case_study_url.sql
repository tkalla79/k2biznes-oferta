-- Pilotaż 2026-07 (#7): link do pełnego opisu projektu na stronie K2.
-- Case study zyskuje opcjonalny URL — w ofercie renderowany jako przycisk
-- „Zobacz pełny opis projektu" (target _blank). Zarządzany w /admin/case-studies.
-- Bezpieczna, addytywna zmiana (nowa nullable kolumna) — bez wpływu na RLS.

alter table case_studies add column if not exists url text;
