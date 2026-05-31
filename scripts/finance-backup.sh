#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# finance-backup.sh — pulls a fresh SQLite snapshot from the Railway-hosted
#                     finance app down to a local Dropbox folder.
#
# Run by:  ~/Library/LaunchAgents/com.voiceai.finance-backup.plist (weekly Mon)
# Setup:   scripts/install-backup-cron.sh
#
# Exits non-zero on failure so launchd records it in StandardErrorPath. The
# script also writes a one-line status to STDOUT for the log.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Config (edit BACKUP_URL + BACKUP_TOKEN for your Railway deployment) ─────
BACKUP_URL="${BACKUP_URL:-https://YOUR-APP.up.railway.app/api/admin/backup}"
BACKUP_TOKEN="${BACKUP_TOKEN:-PASTE_BACKUP_TOKEN_HERE}"
DEST_DIR="${DEST_DIR:-$HOME/Dropbox/Voice AI Solutions/finance-backups}"

# Logs go alongside backups so they're synced too — useful for debugging from
# another machine. Keep this small (overwritten each run).
LOG_FILE="$DEST_DIR/last-run.log"

# ── Pre-flight ──────────────────────────────────────────────────────────────
mkdir -p "$DEST_DIR"

if [[ "$BACKUP_TOKEN" == "PASTE_BACKUP_TOKEN_HERE" ]]; then
  echo "[$(date)] ERROR: BACKUP_TOKEN is unset. Edit this script and set it." | tee "$LOG_FILE" >&2
  exit 2
fi

STAMP="$(date +%Y-%m-%d)"
OUT="$DEST_DIR/finance-$STAMP.db"
TMP="$DEST_DIR/.finance-$STAMP.partial"

# ── Download ────────────────────────────────────────────────────────────────
# -f         fail on HTTP >= 400 (non-zero exit)
# -S         show error on failure
# -L         follow redirects (Railway sometimes 308s to its CDN)
# --max-time give it a minute for the snapshot + transfer
# -o "$TMP"  write to a .partial first; atomic rename only after success
echo "[$(date)] Downloading from $BACKUP_URL → $OUT"
if ! curl -fSL --max-time 60 \
       -H "Authorization: Bearer $BACKUP_TOKEN" \
       -o "$TMP" \
       "$BACKUP_URL"; then
  echo "[$(date)] ERROR: curl failed — see launchd error log for details" | tee "$LOG_FILE" >&2
  rm -f "$TMP"
  exit 1
fi

# Sanity check: the response should be a valid SQLite file (starts with the
# magic 16-byte header "SQLite format 3\0"). Catches the case where Railway
# returned an HTML error page that curl happily saved.
HEADER="$(head -c 15 "$TMP" 2>/dev/null || true)"
if [[ "$HEADER" != "SQLite format 3" ]]; then
  echo "[$(date)] ERROR: downloaded file is not a SQLite DB. First bytes: $HEADER" | tee "$LOG_FILE" >&2
  mv "$TMP" "$DEST_DIR/finance-$STAMP.FAILED"
  exit 3
fi

# Atomic rename
mv "$TMP" "$OUT"
SIZE="$(du -h "$OUT" | cut -f1)"

echo "[$(date)] OK · saved $OUT ($SIZE)" | tee "$LOG_FILE"
