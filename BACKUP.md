# Database backup

The finance app stores everything in a single SQLite file. Backups are a copy
of that file. There are two ways to make one:

| | Use it when |
|---|---|
| **A. Admin button** in Settings → "Download backup" | One-off, "I'm about to do something risky, give me a snapshot now" |
| **B. Weekly automated cron** to `~/Dropbox/Voice AI Solutions/finance-backups/` | Hands-off. Runs every Monday at 06:00 |

Both go through the same endpoint (`/api/admin/backup`) and both use SQLite's
online-backup API — they are **safe to run while the app is in use** (no torn
file, no read-lock contention).

---

## Setup (one time)

### 1. Generate a token and set it on Railway

The cron authenticates with a bearer token. Generate one:

```bash
openssl rand -hex 32
```

On Railway, open the finance-app service → Variables → add:

```
BACKUP_TOKEN=<the value you just generated>
```

Redeploy if Railway doesn't pick it up automatically.

### 2. Install the local cron

From the repo root:

```bash
bash scripts/install-backup-cron.sh
```

This:
1. Copies `scripts/finance-backup.sh` → `~/.local/bin/finance-backup.sh`
   (lives outside Dropbox/the repo, so cron survives Dropbox being offline)
2. Renders the launchd plist → `~/Library/LaunchAgents/com.voiceai.finance-backup.plist`
3. Loads the agent (`launchctl load -w …`) so it fires next Monday 06:00

### 3. Configure the script

Edit `~/.local/bin/finance-backup.sh` and set:

```bash
BACKUP_URL="https://YOUR-APP.up.railway.app/api/admin/backup"
BACKUP_TOKEN="<same value you set on Railway>"
```

(The installer prints these instructions on completion.)

### 4. Test it now without waiting for Monday

```bash
bash ~/.local/bin/finance-backup.sh
```

Expected output:

```
[<timestamp>] Downloading from https://… → /Users/you/Dropbox/Voice AI Solutions/finance-backups/finance-2026-05-31.db
[<timestamp>] OK · saved … (4.2M)
```

If you see the file in `~/Dropbox/Voice AI Solutions/finance-backups/`, you're done.

---

## Restoring a backup

The backup file IS the database. To restore:

- **Production (Railway):**
  1. Stop the service
  2. Replace `/data/finance.db` with the backup file (e.g. via Railway's
     volume shell or `railway run cp …`)
  3. Start the service
- **Local dev:**
  - Replace `prisma/finance.db` with the backup file
  - Restart `npm run dev`

> ⚠️ **Always copy the backup file out of Dropbox to a local temp folder before
> opening it in `sqlite3` or DB Browser.** Dropbox can race-write a file that
> SQLite has open and corrupt it.

---

## Retention

The cron writes one file per run: `finance-YYYY-MM-DD.db`. Weekly cadence means
~52 files/year. At a few MB each, that's well under 1 GB/year — no rotation
needed in practice. If it ever becomes a problem, delete the older files by
hand or add a cleanup step to `finance-backup.sh`.

---

## Logs

- **launchd output:**  `~/Library/Logs/finance-backup.{out,err}.log`
- **Script's own status:**  `~/Dropbox/Voice AI Solutions/finance-backups/last-run.log`
- **Server side:**  Railway service logs for the finance-app service

---

## Uninstall

```bash
launchctl unload -w ~/Library/LaunchAgents/com.voiceai.finance-backup.plist
rm ~/Library/LaunchAgents/com.voiceai.finance-backup.plist
rm ~/.local/bin/finance-backup.sh
```

The endpoint can stay live — it's gated by both the bearer token and the admin
cookie, so it's not abusable without one of them.

---

## Security model

- The route is in `PUBLIC_PREFIXES` in `src/proxy.ts` *only* so cron can hit
  it without a session cookie. The route itself enforces auth:
  - **Bearer token path** — checks `Authorization: Bearer <BACKUP_TOKEN>`
    against the `BACKUP_TOKEN` env var. Constant-time-ish compare.
  - **Cookie path** — verifies the existing `__auth_token` JWT and requires
    `role === 'admin'`. Used by the Settings button.
- The DB snapshot includes **everything** — users, sessions, OTP tokens.
  Treat the backup file the way you'd treat the live DB.
- The token should be rotated if it's ever leaked. Rotate by:
  1. Generate a new value
  2. Update on Railway → wait for redeploy
  3. Update in `~/.local/bin/finance-backup.sh`
