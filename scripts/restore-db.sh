#!/usr/bin/env bash
# Restore prod-DB z lokalnego gzip dump'a.
# Uzycie: bash scripts/restore-db.sh <ścieżka do .sql.gz>
#
# UWAGA: NADPISUJE wszystko w prod-DB (DROP IF EXISTS + CREATE).
# Wymaga confirmacji "YES" zeby uniknąć przypadkowego uruchomienia.
#
# Per docs/BACKUP_RECOVERY.md sekcja 3.2 Opcja B

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Uzycie: bash scripts/restore-db.sh <plik.sql.gz>"
  echo ""
  echo "Dostepne backupy:"
  ls -lah "$HOME/Backups/k2biznes-oferta/db/" 2>/dev/null | tail -5
  exit 1
fi

DUMP_FILE="$1"
if [[ ! -f "$DUMP_FILE" ]]; then
  echo "ERROR: plik nie istnieje: $DUMP_FILE"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: brak $ENV_FILE"
  exit 1
fi

DB_PASS=$(grep '^SUPABASE_DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
PROJECT_REF=$(grep '^SUPABASE_PROJECT_REF=' "$ENV_FILE" | cut -d= -f2-)

if [[ -z "$DB_PASS" || -z "$PROJECT_REF" ]]; then
  echo "ERROR: brak SUPABASE_DB_PASSWORD lub SUPABASE_PROJECT_REF w $ENV_FILE"
  exit 1
fi

# Find psql
PSQL=""
for candidate in /opt/homebrew/opt/libpq/bin/psql /usr/local/opt/libpq/bin/psql $(command -v psql 2>/dev/null); do
  if [[ -x "$candidate" ]]; then
    PSQL="$candidate"
    break
  fi
done

if [[ -z "$PSQL" ]]; then
  echo "ERROR: psql nie znaleziony. brew install libpq"
  exit 1
fi

# Safety prompt
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              ⚠  DESTRUCTIVE OPERATION  ⚠                     ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Restore NADPISZE prod-DB!                                   ║"
echo "║                                                              ║"
echo "║  Target project: $PROJECT_REF"
echo "║  Source dump:    $(basename "$DUMP_FILE")"
echo "║  Dump size:      $(du -h "$DUMP_FILE" | cut -f1)"
echo "║  Dump date:      $(stat -f%Sm -t '%Y-%m-%d %H:%M' "$DUMP_FILE" 2>/dev/null || stat -c%y "$DUMP_FILE" | cut -d. -f1)"
echo "║                                                              ║"
echo "║  Wszystkie dane prod-DB beda nadpisane danymi z dump'a.      ║"
echo "║  PRZED uruchomieniem zrob freshly nowy backup-db.sh!         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
read -p "Wpisz YES (wielkimi literami) aby kontynuowac: " CONFIRM

if [[ "$CONFIRM" != "YES" ]]; then
  echo "Anulowano."
  exit 0
fi

CONN_STR="host=aws-1-eu-central-1.pooler.supabase.com port=5432 user=postgres.$PROJECT_REF dbname=postgres sslmode=require"

echo ""
echo "→ Restore z $DUMP_FILE..."

gunzip -c "$DUMP_FILE" | PGPASSWORD="$DB_PASS" "$PSQL" "$CONN_STR" -v ON_ERROR_STOP=1

echo ""
echo "✓ Restore OK. Verify:"
echo "  curl https://oferta.k2biznes.pl/api/health"
