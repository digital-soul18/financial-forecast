#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# install-backup-cron.sh — one-shot installer for the weekly local backup job
#
# What it does:
#   1. Copies scripts/finance-backup.sh into your home (so launchd doesn't
#      run a script inside Dropbox, which can break if Dropbox is offline)
#   2. Renders scripts/com.voiceai.finance-backup.plist with absolute paths
#      and drops it into ~/Library/LaunchAgents/
#   3. Loads the agent so it fires next Monday at 06:00
#
# Re-running is safe: it stops + reloads the agent.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_SRC="$REPO_DIR/scripts/finance-backup.sh"
PLIST_SRC="$REPO_DIR/scripts/com.voiceai.finance-backup.plist"

# Live locations (outside Dropbox / outside the repo) so cron survives the
# Dropbox-corrupts-binaries pattern we've already been bitten by once.
SCRIPT_LIVE="$HOME/.local/bin/finance-backup.sh"
PLIST_LIVE="$HOME/Library/LaunchAgents/com.voiceai.finance-backup.plist"
LABEL="com.voiceai.finance-backup"

echo "Installing finance-backup cron…"

# (1) Copy script
mkdir -p "$(dirname "$SCRIPT_LIVE")"
cp "$SCRIPT_SRC" "$SCRIPT_LIVE"
chmod +x "$SCRIPT_LIVE"
echo "  · script   → $SCRIPT_LIVE"

# (2) Render plist with absolute paths
mkdir -p "$(dirname "$PLIST_LIVE")"
sed \
  -e "s|__SCRIPT_PATH__|$SCRIPT_LIVE|g" \
  -e "s|__HOME__|$HOME|g" \
  "$PLIST_SRC" > "$PLIST_LIVE"
echo "  · plist    → $PLIST_LIVE"

# (3) Reload the agent (unload first so re-runs work cleanly)
launchctl unload "$PLIST_LIVE" 2>/dev/null || true
launchctl load -w "$PLIST_LIVE"
echo "  · loaded   → $LABEL"

cat <<EOF

✅ Installed. The job will run every Monday at 06:00 local time.

Two things you still need to do:

  1. Edit $SCRIPT_LIVE and set:
       BACKUP_URL    = https://YOUR-APP.up.railway.app/api/admin/backup
       BACKUP_TOKEN  = <a long random string — same value set in Railway>

  2. On Railway, set the BACKUP_TOKEN env var on your finance-app service.
     A good token: $(openssl rand -hex 32)

Test it now without waiting for Monday:
    bash $SCRIPT_LIVE

Logs:
    ~/Library/Logs/finance-backup.{out,err}.log     (launchd output)
    \$DEST_DIR/last-run.log                          (script's own status line)

Uninstall:
    launchctl unload -w $PLIST_LIVE
    rm $PLIST_LIVE $SCRIPT_LIVE
EOF
