#!/usr/bin/env bash
# Initialise (once) and start the sandbox-local PostgreSQL that replaces the
# unreachable remote database after the environment was recycled.
#
# Data lives under /home/z/my-project/.pglocal/data so it survives recycles.
# Binaries come from the embedded-postgres npm package (already installed at
# /home/z/my-project/node_modules/@embedded-postgres/linux-x64).
#
# Usage: pglocal.sh start   (idempotent: init only on first run)
set -euo pipefail

BIN=/home/z/my-project/node_modules/@embedded-postgres/linux-x64/native/bin
DATA=/home/z/my-project/.pglocal/data
LOG=/home/z/my-project/.pglocal/postgres.log
PORT=5432
USER_NAME=elvictoria
DB_NAME=elvictoria

if [ ! -f "$DATA/PG_VERSION" ]; then
  echo "[pglocal] initialising cluster at $DATA"
  "$BIN/initdb" -D "$DATA" -U "$USER_NAME" -A trust --encoding=UTF8 --no-locale >> "$LOG" 2>&1
fi

if "$BIN/pg_ctl" -D "$DATA" status > /dev/null 2>&1; then
  echo "[pglocal] already running"
else
  echo "[pglocal] starting on 127.0.0.1:$PORT"
  "$BIN/pg_ctl" -D "$DATA" -l "$LOG" \
    -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp" start
fi

# Create the application database once (idempotent).
if "$BIN/psql" -h 127.0.0.1 -p "$PORT" -U "$USER_NAME" -d postgres -tAc \
     "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1; then
  echo "[pglocal] database '$DB_NAME' exists"
else
  "$BIN/createdb" -h 127.0.0.1 -p "$PORT" -U "$USER_NAME" "$DB_NAME"
  echo "[pglocal] created database '$DB_NAME'"
fi
