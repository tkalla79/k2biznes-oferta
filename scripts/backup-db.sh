#!/usr/bin/env bash
# Backup prod-DB Supabase do lokalnego gzip dump.
# Uzycie: bash scripts/backup-db.sh
# Output: ~/Backups/k2biznes-oferta/db/YYYY-MM-DD-HHMM-db.sql.gz
#
# Wymagania:
#   - pg_dump (brew install libpq + dodaj /opt/homebrew/opt/libpq/bin do PATH)
#   - .env.production.local z SUPABASE_DB_PASSWORD + SUPABASE_PROJECT_REF
#
# Per docs/BACKUP_RECOVERY.md sekcja 2.2

set -euo pipefail

# Locate repo root (script lives in scripts/, repo root jest parent)
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: brak $ENV_FILE — patrz docs/BACKUP_RECOVERY.md sekcja 2.4"
  exit 1
fi

# Read sekrety
DB_PASS=$(grep '^SUPABASE_DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
PROJECT_REF=$(grep '^SUPABASE_PROJECT_REF=' "$ENV_FILE" | cut -d= -f2-)

if [[ -z "$DB_PASS" || -z "$PROJECT_REF" ]]; then
  echo "ERROR: brak SUPABASE_DB_PASSWORD lub SUPABASE_PROJECT_REF w $ENV_FILE"
  exit 1
fi

# Find pg_dump (libpq, nie system Postgres jesli inna wersja)
PG_DUMP=""
for candidate in /opt/homebrew/opt/libpq/bin/pg_dump /usr/local/opt/libpq/bin/pg_dump $(command -v pg_dump 2>/dev/null); do
  if [[ -x "$candidate" ]]; then
    PG_DUMP="$candidate"
    break
  fi
done

if [[ -z "$PG_DUMP" ]]; then
  echo "ERROR: pg_dump nie znaleziony. Zainstaluj: brew install libpq"
  exit 1
fi

# Setup
BACKUP_DIR="$HOME/Backups/k2biznes-oferta/db"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y-%m-%d-%H%M)
OUTPUT_FILE="$BACKUP_DIR/$TIMESTAMP-db.sql.gz"

CONN_STR="host=aws-1-eu-central-1.pooler.supabase.com port=5432 user=postgres.$PROJECT_REF dbname=postgres sslmode=require"

echo "→ Backup prod-DB ($PROJECT_REF) → $OUTPUT_FILE"
echo "  Pooler: aws-1-eu-central-1.pooler.supabase.com:5432"

# pg_dump z hasłem przez env (bezpieczniej niz w URL)
PGPASSWORD="$DB_PASS" "$PG_DUMP" \
  "$CONN_STR" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  --verbose 2>/tmp/pg_dump_stderr.log | gzip > "$OUTPUT_FILE"

# Verify size > 0
SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE")
if [[ "$SIZE" -lt 1024 ]]; then
  echo "ERROR: backup file < 1KB ($SIZE bytes). Sprawdz /tmp/pg_dump_stderr.log"
  exit 1
fi

HUMAN_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "✓ Backup OK: $OUTPUT_FILE ($HUMAN_SIZE)"
echo ""
echo "Lista backupow w katalogu:"
ls -lah "$BACKUP_DIR" | tail -5
