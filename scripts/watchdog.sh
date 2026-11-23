#!/usr/bin/env bash
# Watchdog: keeps the three dev services alive. Runs as a detached daemon
# (survives the agent turn, dies only with a full sandbox recycle).
#
# For each service: if a PID file exists and that process is alive -> skip;
# otherwise if the port has no listener -> start it and record the PID.
# PID files are the source of truth so a still-booting server is never
# double-spawned.
#
# Launch: setsid nohup bash /home/z/my-project/scripts/watchdog.sh >/dev/null 2>&1 &
# Log:    /home/z/my-project/.pglocal/watchdog.log
set -u

ROOT=/home/z/my-project
RUNDIR=$ROOT/.pglocal
LOG=$RUNDIR/watchdog.log
INTERVAL=15

mkdir -p "$RUNDIR"

alive() { # pidfile -> 0 if the recorded process is running
  local f=$1
  [ -f "$f" ] || return 1
  local pid
  pid=$(cat "$f" 2>/dev/null) || return 1
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

listening() { # port -> 0 if something is bound
  ss -ltn "sport = :$1" 2>/dev/null | grep -q LISTEN
}

start_postgres() {
  echo "$(date +%T) postgres: down, starting" >> "$LOG"
  bash "$ROOT/scripts/pglocal.sh" start >> "$LOG" 2>&1
}

start_backend() {
  echo "$(date +%T) backend: starting" >> "$LOG"
  (cd "$ROOT/elvictoria/backend" && nohup npm run dev >> /tmp/backend.log 2>&1 & echo $! > "$RUNDIR/backend.pid")
}

start_frontend() {
  echo "$(date +%T) frontend: starting" >> "$LOG"
  (cd "$ROOT" && nohup npm run dev >> /tmp/frontend.log 2>&1 & echo $! > "$RUNDIR/frontend.pid")
}

while true; do
  # Postgres: pglocal.sh is fully idempotent (init once, start once).
  if ! listening 5432; then
    start_postgres
  fi

  if ! alive "$RUNDIR/backend.pid" && ! listening 3030; then
    start_backend
  fi

  if ! alive "$RUNDIR/frontend.pid" && ! listening 3000; then
    start_frontend
  fi

  sleep "$INTERVAL"
done
