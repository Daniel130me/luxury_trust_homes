#!/usr/bin/env python3
"""Rebuild elvictoria/backend/.env after a sandbox recycle.

The recycle keeps git-tracked files but drops gitignored ones (.env,
node_modules), so the backend cannot boot without this. The project
owner's credentials are stored in scripts/check_infra.py (committed),
so the .env is reconstructed from there — no need to ask the user.

A fresh JWT_SECRET is generated on each rebuild; previously issued
browser sessions become invalid (users just sign in again).

Prints only key NAMES, never values.
"""
import ast
import secrets
from pathlib import Path

ROOT = Path("/home/z/my-project")
CHECK_INFRA = ROOT / "scripts" / "check_infra.py"
OUT = ROOT / "elvictoria" / "backend" / ".env"

# Extract only the ENV dict literal from check_infra.py (ast — no code runs).
tree = ast.parse(CHECK_INFRA.read_text())
env: dict[str, str] = {}
for node in tree.body:
    if isinstance(node, ast.Assign) and any(
        getattr(t, "id", None) == "ENV" for t in node.targets
    ):
        env = ast.literal_eval(node.value)
        break
if not env:
    raise SystemExit("ENV dict not found in check_infra.py — cannot rebuild .env")

# Keys that are not credentials / were never stored in check_infra.py.
lines = [
    "# Rebuilt by scripts/rebuild-env.py after a sandbox recycle.",
    "# Gitignored — never commit. Do not edit here; update check_infra.py or ask the owner.",
    "NODE_ENV=development",
    "PORT=3030",
    f"DATABASE_URL={env['DATABASE_URL']}",
    f"DATABASE_DIRECT_URL={env['DATABASE_DIRECT_URL']}",
    f"R2_BUCKET={env['R2_BUCKET']}",
    f"R2_ACCESS_KEY_ID={env['R2_ACCESS_KEY_ID']}",
    f"R2_SECRET_ACCESS_KEY={env['R2_SECRET_ACCESS_KEY']}",
    f"R2_S3_ENDPOINT={env['R2_S3_ENDPOINT']}",
    f"R2_PUBLIC_BASE_URL={env['R2_PUBLIC_BASE_URL']}",
    f"FLW_SECRET_KEY={env['FLW_SECRET_KEY']}",
    # Optional client-side key; not needed for hosted-link checkout.
    "FLW_PUBLIC_KEY=",
    # Webhook signature secret — stays empty until the webhook URL is
    # registered in the Flutterwave dashboard; the endpoint rejects
    # requests until then (documented in elvictoria/README.md).
    "FLW_WEBHOOK_SECRET=",
    "FLW_ENVIRONMENT=test",
    f"JWT_SECRET={secrets.token_hex(24)}",
]
OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
OUT.chmod(0o600)

print(f"Wrote {OUT} ({len(lines)} lines)")
print("Keys present:", ", ".join(k.split("=")[0] for k in lines if "=" in k and not k.startswith("#")))
