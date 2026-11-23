#!/usr/bin/env bash
# One-shot full-stack recovery after a sandbox recycle.
#
# Idempotent and safe to run any time:
#   1. starts the local PostgreSQL (no-op when already running)
#   2. rebuilds backend .env / deps / prisma / migrations (no-op when intact)
#   3. wipes a possibly-corrupted Next build cache (cheap insurance)
#   4. starts backend :3030, frontend :3000 and the crash watchdog
#
# Designed to be run by the scheduled "keep-alive" task, by the user, or
# manually after a recycle. Exits 0 when the site answers on :81 at the end.
set -uo pipefail

PROJECT=/home/z/my-project
LOG=$PROJECT/scripts/out/recover_all.log
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }

site_up() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:81/ 2>/dev/null; }

# Fast path: already up, touch nothing.
if [ "$(site_up)" = "200" ]; then
    log "site already up — nothing to do"
    exit 0
fi

log "site down — starting recovery"

# 1. PostgreSQL
bash "$PROJECT/scripts/pglocal.sh" start >> "$LOG" 2>&1

# 2. Backend env/deps/migrations + settings heal (idempotent)
bash "$PROJECT/scripts/rebuild_env.sh" >> "$LOG" 2>&1

# 3. Fresh Next build cache (recycles corrupt it: font-resolve 500s)
rm -rf "$PROJECT/.next"

# 4. Stack + watchdog (each is a no-op if its port is already serving)
cd "$PROJECT"
setsid nohup bash mini-services/elvictoria-api/start-backend.sh \
    > scripts/out/backend-boot.log 2>&1 < /dev/null &
setsid nohup npm run dev > dev.log 2>&1 < /dev/null &
pgrep -f dev-watchdog.sh >/dev/null || \
    setsid nohup bash scripts/dev-watchdog.sh > /dev/null 2>&1 < /dev/null &

# Dev servers need a moment to compile; poll :81 for up to 3 minutes.
for i in $(seq 1 36); do
    sleep 5
    code=$(site_up)
    if [ "$code" = "200" ]; then
        log "recovery complete — site is up (after ~$((i * 5))s)"
        exit 0
    fi
done

log "recovery FAILED — site still down after 3 minutes (last code: $(site_up))"
exit 1
