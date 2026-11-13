#!/usr/bin/env python3
"""Final pass: assemble the complete prototype database (users, properties, cases,
payments, notifications, saved, tickets, settings) as one JSON file."""
import json, re, subprocess

OUT = "/home/z/my-project/scripts/out"
J = f"{OUT}/data/json"
js = open(f"{OUT}/bundle.js", encoding="utf-8").read()

def lit_of(name, start):
    """Extract literal starting at position of '=' target."""
    i = js.index(start)
    return i

# --- sanitize helper (same as before) ---
CALL_RE = re.compile(
    r'\b(?:Q|Je|Gt|_n|Sn|Ga|y1|m1|l1|j1|g1|b1|jw|zf|k1)\(\s*("(?:[^"\\]|\\.)*")\s*(?:,\s*("(?:[^"\\]|\\.)*"))?\s*\)'
)
CALL_ANY = re.compile(r'\b([A-Za-z_$][\w$]{0,24})\((\s*(?:"(?:[^"\\]|\\.)*")|\s*\'(?:[^\'\\]|\\.)*\')\s*(?:,[^()]*)?\)')

def sanitize(txt):
    txt = CALL_RE.sub(r"\1", txt)
    txt = CALL_ANY.sub(r"\1", txt)
    return txt

# --- locate literal boundaries by brace matching ---
def match_literal(js, start):
    depth = 0; i = start; n = len(js); in_str = None
    while i < n:
        c = js[i]
        if in_str:
            if c == "\\": i += 2; continue
            if c == in_str: in_str = None
            i += 1; continue
        if c in "\"'`": in_str = c
        elif c in "[{(": depth += 1
        elif c in "]})":
            depth -= 1
            if depth == 0: return i + 1
        i += 1
    return -1

# extract the master-DB literal e_245257 (starts at `{schemaVersion:`)
master_start = js.index("{schemaVersion:")
master_end = match_literal(js, master_start)
master_lit = sanitize(js[master_start:master_end])

script = f'''
const fs = require("fs");
const J = {J!r};

const load = (f) => JSON.parse(fs.readFileSync(J + "/" + f, "utf8"));
const users = load("a1_166090.json");
const properties = load("Bh_174397.json");
const cases = load("f1_195169.json");
const notifTuples = load("w1_232949.json");
const ticketsRaw = load("Uh_242532.json");
const interests = load("i1_170301.json");
const geo = load("ld_172073.json");
const photoLibrary = load("elvictoriaPhotoLibrary_357463.json");

// builders equivalent to prototype runtime
const l1 = () => users.map(u => {{
  const t = interests[u.id];
  return {{ ...u, status: u.status ?? "active", passwordHash: "2718b1cc4053e6c65de52847ef2d6d188361decc36e221dac73423de5536d91b",
    interest: t?.interest, preferredLocation: t?.preferredLocation ?? t?.location, alerts: t?.alerts }};
}});
const m1 = () => properties;
const g1 = () => cases;
const y1 = () => {{
  // payments live inside case objects as `payments` or a separate array in f1? inspect first item
  return [];
}};
const j1 = () => notifTuples.map(([userId, category, title, body, link, at, read]) =>
  ({{ id: "ntf_" + userId + "_" + at, userId, category, title, body, link, at, read }}));
const b1 = () => ticketsRaw.map(t => ({{
  id: "t_" + t.n, reference: "ELV-HD-" + t.n, userId: t.user, name: t.name, email: t.email,
  phone: t.phone, category: t.category, subject: t.subject, status: t.status, n: t.n,
  messages: (t.messages || []).map(([at, authorId, fromStaff, body]) => ({{ at, authorId, fromStaff, body }}))
}}));

const aliases = {{ $: "u_adaeze", K: "u_tunde", W: "u_nneka", Ss: "u_mariam", Qo: "u_obinna" }};
const p = {{ ...aliases, Wh: 4, l1, m1, g1, y1, j1, b1, Q: (s) => s, xn: (s) => s,
  n1: "2718b1cc4053e6c65de52847ef2d6d188361decc36e221dac73423de5536d91b", id: 0, h1: 0, v1: {{}}, k1: 0 }};
const names = Object.keys(p);
const db = new Function(...names, "return (" + {master_lit!r} + ")")(...names.map(n => p[n]));
fs.writeFileSync({OUT!r} + "/prototype_db.json", JSON.stringify(db, null, 1));
console.log("users", db.users.length, "properties", db.properties.length, "cases", db.cases.length,
  "payments", db.payments.length, "notifications", db.notifications.length, "saved", db.savedProperties.length,
  "tickets", db.tickets.length, "accessRequests", (db.accessRequests||[]).length);
console.log("settings:", JSON.stringify(db.settings).slice(0, 400));
console.log("case keys:", Object.keys(db.cases[0]).join(","));
console.log("payment sample:", JSON.stringify(db.payments[0]).slice(0, 300));
'''
r = subprocess.run(["node", "-e", script], capture_output=True, text=True)
print(r.stdout or r.stderr[:800])
