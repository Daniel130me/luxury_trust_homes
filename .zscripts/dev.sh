#!/bin/bash
# ELVICTORIA boot bootstrap — executed by the platform at every container
# boot: start.sh runs .zscripts/dev.sh as user z (in background) when the
# file exists, BEFORE the gateway health check on :81 (120s window).
#
# This replaces the original scaffold template, whose flow (bun install →
# bun run db:push → bun run dev) never survives a recycle: db:push targets
# the unreachable remote database and bun install re-fetches the whole
# project, so :3000 never comes up and the gateway serves the platform's
# "Z" placeholder page indefinitely.
#
# What this does instead (all detached, idempotent):
#   1. local PostgreSQL :5432   — scripts/pglocal.sh
#   2. backend :3030            — self-healing launcher (heals its own
#                                 .env / node_modules / prisma client)
#   3. frontend :3000           — Next dev, deps installed when wiped,
#                                 .next rebuilt clean each boot
#   4. watchdog                 — covers mid-session crashes afterwards
#
# Fast path: if :81 already answers 200 (manual recovery beat the boot,
# or a previous boot's stack is still healthy), touch nothing.

set -uo pipefail

PROJECT=/home/z/my-project
LOG=$PROJECT/scripts/out/boot-dev.log
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG"; }
up() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://localhost:$1/" 2>/dev/null; }

if [ "$(up 81)" = "200" ]; then
    log "site already up — nothing to do"
    exit 0
fi

log "boot bootstrap starting"

# 1. Database (idempotent: init on first boot, start when dead, no-op when up)
bash "$PROJECT/scripts/pglocal.sh" start >>"$LOG" 2>&1 || log "WARN: pglocal start rc=$?"

# 2. Backend in the background — its launcher heals deps/env and can take
#    minutes after a wipe; :3000 must not wait for it.
setsid nohup bash "$PROJECT/mini-services/elvictoria-api/start-backend.sh" \
    >"$PROJECT/scripts/out/backend-boot.log" 2>&1 < /dev/null &

# 3. Frontend on :3000 — the only service inside the 120s health window.
if [ ! -d "$PROJECT" ] || ! cd "$PROJECT"; then
    log "FATAL: project dir missing"
    exit 1
fi
if [ ! -x node_modules/.bin/next ]; then
    log "root node_modules missing — installing (bun, fallback npm)"
    (command -v bun >/dev/null && bun install || npm install) \
        >>"$PROJECT/dev-deps.log" 2>&1 || log "WARN: root dep install rc=$?"
fi
# Recycles corrupt the Next build cache (font-resolve 500s on every route):
# always rebuild clean at boot; a cold compile still fits the 120s window.
rm -rf "$PROJECT/.next"
setsid nohup npm run dev >"$PROJECT/dev.log" 2>&1 < /dev/null &

# 4. Watchdog (no-op when already running; restarts services mid-session)
pgrep -f dev-watchdog.sh >/dev/null || \
    setsid nohup bash "$PROJECT/scripts/dev-watchdog.sh" >/dev/null 2>&1 < /dev/null &

log "boot bootstrap issued all starts — exiting"
exit 0
