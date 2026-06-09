#!/usr/bin/env bash
# Instalacja LaunchAgentów dla automatycznych backupów (macOS).
# Uzycie: bash scripts/launchd/install.sh
#
# Podmienia __REPO__/__HOME__ w template plistach, kopiuje do
# ~/Library/LaunchAgents/, ładuje przez launchctl.
#
# Idempotent: bezpieczne wielokrotne uruchomienie (unload przed reload).
# Per AUDIT_2026-06-01 C1 (backupy nieautomatyczne).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LAUNCHD_DIR="$REPO_ROOT/scripts/launchd"
TARGET_DIR="$HOME/Library/LaunchAgents"
PLISTS=("pl.k2biznes.backup-db" "pl.k2biznes.backup-storage")

mkdir -p "$TARGET_DIR"

echo "→ Instalacja LaunchAgentów K2Biznes backup"
echo "  Repo: $REPO_ROOT"
echo "  Target: $TARGET_DIR"
echo ""

for name in "${PLISTS[@]}"; do
  SRC="$LAUNCHD_DIR/$name.plist"
  DEST="$TARGET_DIR/$name.plist"

  if [[ ! -f "$SRC" ]]; then
    echo "ERROR: brak template $SRC"
    exit 1
  fi

  # Podmień placeholdery → realne ścieżki
  sed -e "s|__REPO__|$REPO_ROOT|g" -e "s|__HOME__|$HOME|g" "$SRC" > "$DEST"

  # Unload jeśli już załadowany (idempotent)
  launchctl unload "$DEST" 2>/dev/null || true
  launchctl load "$DEST"

  echo "  ✓ $name → załadowany"
done

echo ""
echo "Zainstalowane LaunchAgenty:"
launchctl list | grep -i k2biznes || echo "  (launchctl list nie pokazuje — sprawdz przez 'launchctl print gui/\$UID/pl.k2biznes.backup-db')"

echo ""
echo "Harmonogram:"
echo "  • backup-db:      Poniedziałek 09:00 (tygodniowo)"
echo "  • backup-storage: 1. dzień miesiąca 09:00"
echo ""
echo "Test ręczny (uruchom teraz bez czekania):"
echo "  launchctl start pl.k2biznes.backup-db"
echo "  tail -f /tmp/k2-backup-db.log"
echo ""
echo "Deinstalacja:"
echo "  bash scripts/launchd/uninstall.sh"
