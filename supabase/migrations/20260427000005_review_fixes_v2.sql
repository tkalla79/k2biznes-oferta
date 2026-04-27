-- =============================================================================
-- K2Biznes Oferta — migracja 005 — pozostałe code review fixes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PR #2 #3: oddzielne kolumny rejected_by_* zamiast reuse accepted_by_*
--    Wcześniej reject route pisał klienta odrzucającego do accepted_by_name/
--    accepted_by_email, co dawało false positive w analytics filtrującym
--    `accepted_by_email IS NOT NULL` jako "offer accepted".
-- -----------------------------------------------------------------------------

alter table offers
  add column if not exists rejected_by_name  text,
  add column if not exists rejected_by_email text,
  add column if not exists reject_reason     text;

-- Backfill: jeśli status='rejected' i są dane w accepted_by_*, przenieś
update offers
set
  rejected_by_name  = accepted_by_name,
  rejected_by_email = accepted_by_email,
  reject_reason     = client_comment,
  accepted_by_name  = null,
  accepted_by_email = null,
  client_comment    = null
where status = 'rejected'
  and (accepted_by_name is not null or accepted_by_email is not null or client_comment is not null);
