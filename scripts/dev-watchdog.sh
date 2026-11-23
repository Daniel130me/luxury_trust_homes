#!/bin/bash
# Watchdog for the ELVICTORIA dev stack (frontend :3000, backend :3030).
#
# The sandbox recycle kills all processes between sessions and sometimes
# wipes backend .env/node_modules. The self-healing backend launcher
# (mini-services/elvictoria-api/start-backend.sh) already covers the
# wipe case at boot; this loop covers mid-session crashes so the user
# doesn't hit the platform's "Z" placeholder page while testing.
#
# It only restarts a service when its port is actually down, so it is
# safe to run alongside the platform's own boot.

LOG=/home/z/my-project/scripts/out/watchdog.log
PROJECT=/home/z/my-project
BACKEND_LAUNCHER="$PROJECT/mini-services/elvictoria-api/start-backend.sh"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"
}

while true; do
    # Frontend: Next dev server on :3000. Recycles can leave a corrupted
    # .next cache behind (known signature: "next/font/google queries have
    # exactly one entry" 500s on every route) — detect it and rebuild clean.
    if ! curl -s -o /dev/null --max-time 10 http://localhost:3000/; then
        if tail -40 "$PROJECT/dev.log" 2>/dev/null | grep -q "exactly one entry"; then
            log "corrupted .next cache detected — wiping before restart"
            rm -rf "$PROJECT/.next"
        fi
        log "frontend down — restarting"
        (cd "$PROJECT" && setsid nohup npm run dev > dev.log 2>&1 < /dev/null &)
        log "frontend restart issued"
    fi

    # Backend: Express API on :3030 (launcher also heals .env/deps if wiped)
    if ! curl -s -o /dev/null --max-time 10 "http://localhost:3030/api/properties?limit=1"; then
        log "backend down — restarting via self-healing launcher"
        setsid nohup bash "$BACKEND_LAUNCHER" > "$PROJECT/scripts/out/backend-boot.log" 2>&1 < /dev/null &
        log "backend restart issued"
    fi

    sleep 30
done
