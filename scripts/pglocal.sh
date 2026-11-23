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

# Self-heal: the npm postinstall that creates the ICU version symlinks is
# blocked by install-script policy, and recycles can drop them. Recreate.
for lib in libicudata libicui18n libicuuc; do
  [ -e "$BIN/../lib/$lib.so.60" ] || ln -sf "$lib.so.60.2" "$BIN/../lib/$lib.so.60"
done

# Self-heal: recycles can prune EMPTY runtime directories inside the data dir
# and loosen permissions. Recreate the standard initdb empty dirs (safe: they
# are meant to be empty) and restore 0700.
for d in pg_notify pg_tblspc pg_replslot pg_commit_ts pg_dynshmem pg_snapshots \
         pg_serial pg_stat pg_stat_tmp pg_twophase pg_wal/archive_status \
         pg_logical/mappings pg_logical/snapshots pg_multixact/members \
         pg_multixact/offsets; do
  [ -d "$DATA/$d" ] || mkdir -p "$DATA/$d"
done
chmod 700 "$DATA"

if "$BIN/pg_ctl" -D "$DATA" status > /dev/null 2>&1; then
  echo "[pglocal] already running"
else
  echo "[pglocal] starting on 127.0.0.1:$PORT"
  "$BIN/pg_ctl" -D "$DATA" -l "$LOG" \
    -o "-p $PORT -c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp" start
fi

# Create the application database once (idempotent). The embedded package
# ships no psql/createdb, so use the node `pg` client instead.
node -e '
const { Client } = require("/home/z/my-project/node_modules/pg");
(async () => {
  const c = new Client({ host: "127.0.0.1", port: process.argv[1], user: process.argv[2], database: "postgres" });
  await c.connect();
  const r = await c.query("SELECT 1 FROM pg_database WHERE datname=$1", [process.argv[3]]);
  if (r.rowCount === 0) { await c.query("CREATE DATABASE " + process.argv[3]); console.log("[pglocal] created database"); }
  else console.log("[pglocal] database exists");
  await c.end();
})().catch(e => { console.error(e.message); process.exit(1); });' "$PORT" "$USER_NAME" "$DB_NAME"
