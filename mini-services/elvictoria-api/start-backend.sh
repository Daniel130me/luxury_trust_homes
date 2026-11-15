#!/bin/sh
# Launcher for the ELVICTORIA Express backend (source of truth:
# elvictoria/backend). Called by the sandbox boot via this directory's
# package.json "dev" script.
#
# The sandbox recycle keeps git-tracked files but drops gitignored ones
# (.env, node_modules), so verify both exist before starting; rebuild
# them if missing so a recycled workspace can still boot unattended.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../../elvictoria/backend"
cd "$BACKEND_DIR"

if [ ! -f .env ]; then
    echo "[elvictoria-api] .env missing (recycle?) — rebuilding from scripts/rebuild-env.py"
    python3 /home/z/my-project/scripts/rebuild-env.py
fi

if [ ! -x node_modules/.bin/tsx ]; then
    echo "[elvictoria-api] backend dependencies missing — running npm install"
    npm install --no-audit --no-fund
    npx prisma generate
fi

exec npm run dev
