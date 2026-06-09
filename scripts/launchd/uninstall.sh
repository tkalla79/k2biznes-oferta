#!/usr/bin/env bash
# Deinstalacja LaunchAgentów backup. Uzycie: bash scripts/launchd/uninstall.sh
set -euo pipefail

TARGET_DIR="$HOME/Library/LaunchAgents"
PLISTS=("pl.k2biznes.backup-db" "pl.k2biznes.backup-storage")

for name in "${PLISTS[@]}"; do
  DEST="$TARGET_DIR/$name.plist"
  if [[ -f "$DEST" ]]; then
    launchctl unload "$DEST" 2>/dev/null || true
    rm -f "$DEST"
    echo "  ✓ $name → usunięty"
  else
    echo "  - $name → nie był zainstalowany"
  fi
done
echo "Gotowe."
