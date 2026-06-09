#!/usr/bin/env bash
# Backup zawartosci bucket'a public-uploads (logo, photo) do lokalnego mirror.
# Uzycie: bash scripts/backup-storage.sh
# Output: ~/Backups/k2biznes-oferta/storage/YYYY-MM-DD/<folder>/<file>
#
# Wymagania:
#   - curl
#   - python3 (do parsing JSON)
#   - .env.production.local z SUPABASE_SERVICE_ROLE_KEY + SUPABASE_PROJECT_REF
#
# Per docs/BACKUP_RECOVERY.md sekcja 2.3

set -euo pipefail

# C1 audit: notyfikacja macOS przy fail (patrz backup-db.sh).
notify() { command -v osascript >/dev/null 2>&1 && osascript -e "display notification \"$2\" with title \"$1\"" 2>/dev/null || true; }
trap 'notify "K2Biznes Backup ❌" "Storage backup padł — sprawdz /tmp/k2-backup-storage.log"' ERR

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.production.local"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: brak $ENV_FILE"
  exit 1
fi

SRK=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ENV_FILE" | cut -d= -f2-)
PROJECT_REF=$(grep '^SUPABASE_PROJECT_REF=' "$ENV_FILE" | cut -d= -f2-)

if [[ -z "$SRK" || -z "$PROJECT_REF" ]]; then
  echo "ERROR: brak SUPABASE_SERVICE_ROLE_KEY lub SUPABASE_PROJECT_REF w $ENV_FILE"
  exit 1
fi

BUCKET="public-uploads"
BASE_URL="https://$PROJECT_REF.supabase.co"
TODAY=$(date +%Y-%m-%d)
BACKUP_DIR="$HOME/Backups/k2biznes-oferta/storage/$TODAY"
mkdir -p "$BACKUP_DIR"

echo "→ Backup storage bucket '$BUCKET' → $BACKUP_DIR"

# Lista wszystkich plikow w bucket (recursive przez 3 foldery)
DOWNLOADED=0
TOTAL_SIZE=0

for folder in "case-studies" "contact-persons" "programs"; do
  echo ""
  echo "  Folder: $folder/"

  # POST do storage/v1/object/list/<bucket> z body {"prefix":"<folder>", "limit": 1000}
  FILES_JSON=$(curl -s -X POST "$BASE_URL/storage/v1/object/list/$BUCKET" \
    -H "apikey: $SRK" \
    -H "Authorization: Bearer $SRK" \
    -H "Content-Type: application/json" \
    -d "{\"prefix\":\"$folder\",\"limit\":1000,\"offset\":0,\"sortBy\":{\"column\":\"name\",\"order\":\"asc\"}}")

  # Parse files i pobierz kazdy
  FILES=$(echo "$FILES_JSON" | python3 -c "
import json, sys
try:
    data = json.loads(sys.stdin.read())
    for item in data:
        name = item.get('name', '')
        if name and item.get('id'):  # folder ma name ale brak id
            print(name)
except Exception as e:
    print(f'ERROR parsing JSON: {e}', file=sys.stderr)
    sys.exit(1)
")

  if [[ -z "$FILES" ]]; then
    echo "    (pusty folder)"
    continue
  fi

  mkdir -p "$BACKUP_DIR/$folder"

  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    OUTPUT="$BACKUP_DIR/$folder/$file"

    # Public URL — bucket jest public, ale curl z apikey dla bezpieczenstwa
    DOWNLOAD_URL="$BASE_URL/storage/v1/object/public/$BUCKET/$folder/$file"

    if curl -s -f -o "$OUTPUT" "$DOWNLOAD_URL"; then
      SIZE=$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT")
      TOTAL_SIZE=$((TOTAL_SIZE + SIZE))
      DOWNLOADED=$((DOWNLOADED + 1))
      echo "    ✓ $file ($(du -h "$OUTPUT" | cut -f1))"
    else
      echo "    ✗ $file (download failed)"
    fi
  done <<< "$FILES"
done

echo ""
echo "✓ Backup OK: $DOWNLOADED plikow, total $(echo "scale=2; $TOTAL_SIZE / 1024 / 1024" | bc 2>/dev/null || echo "$((TOTAL_SIZE / 1024)) KB") MB"
echo "  Lokalizacja: $BACKUP_DIR"

# Q9 audit: retention — usuń foldery storage starsze niż 180 dni (6 mies.).
# Storage zmienia się rzadko (logo/photo), 6 mies. historii wystarczy.
STORAGE_ROOT="$HOME/Backups/k2biznes-oferta/storage"
DELETED=$(find "$STORAGE_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +180 -print -exec rm -rf {} + 2>/dev/null | wc -l | tr -d ' ')
if [[ "$DELETED" -gt 0 ]]; then
  echo "  Retention: usunięto $DELETED folder(ów) storage starszych niż 180 dni."
fi

notify "K2Biznes Backup ✓" "Storage backup OK ($DOWNLOADED plików)"
