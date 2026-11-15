#!/usr/bin/env python3
"""Consolidate the three seeded lawyer accounts into one shared account.

Part of the business-model change: all ELVICTORIA lawyers work from a
single login ("ELVICTORIA Legal"), so external users never see which
individual lawyer handles their case. Every reference to the old lawyer
ids (cases.lawyer, timeline actors, payment requesters, notifications)
is rewritten to the new shared id, and the seed users list keeps only
the shared account.
"""

import json
from pathlib import Path

SEED = Path("/home/z/my-project/elvictoria/backend/prisma/seed-data/prototype_db.json")

OLD_LAWYER_IDS = ["u_adaeze", "u_tunde", "u_nneka"]
SHARED_ID = "u_legal"
SHARED_NAME = "ELVICTORIA Legal"
SHARED_EMAIL = "legal@elvictoria.example"

data = json.loads(SEED.read_text())

# 1. Replace every occurrence of an old lawyer id anywhere in the seed
#    (cases, timeline actors, payments.requestedBy, notifications…).
raw = json.dumps(data)
for old in OLD_LAWYER_IDS:
    raw = raw.replace(f'"{old}"', f'"{SHARED_ID}"')
data = json.loads(raw)

# 2. Rebuild the users list: keep the FIRST lawyer entry (renamed to the
#    shared identity), drop the other lawyers, keep everyone else.
kept = []
shared_inserted = False
for u in data["users"]:
    if str(u.get("role", "")).lower() == "lawyer":
        if not shared_inserted:
            kept.append({
                "id": SHARED_ID,
                "name": SHARED_NAME,
                "email": SHARED_EMAIL,
                "phone": u.get("phone"),
                "role": u.get("role"),
                "organisation": "Property & Conveyancing Team",
                "city": u.get("city"),
                "registeredAt": u.get("registeredAt"),
                "status": u.get("status"),
                "passwordHash": u.get("passwordHash"),
            })
            shared_inserted = True
        # Additional lawyer entries are dropped entirely.
        continue
    kept.append(u)

if not shared_inserted:
    raise SystemExit("no lawyer user found in seed — aborting, file unchanged")

data["users"] = kept

# 3. Seed the (empty) bank-transfer settings so the admin form has its keys.
settings = data.setdefault("settings", {})
settings.setdefault("bankName", "")
settings.setdefault("bankAccountName", "")
settings.setdefault("bankAccountNumber", "")

SEED.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n")

# Sanity report
print("users now:", [(u["id"], u["name"], u["role"]) for u in data["users"] if u.get("role", "").lower() == "lawyer"])
for old in OLD_LAWYER_IDS:
    leftover = json.dumps(data).count(f'"{old}"')
    print(f"{old} leftover references: {leftover}")
