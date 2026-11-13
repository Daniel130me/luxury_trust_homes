#!/usr/bin/env python3
"""Sanitize literals: replace helper calls with their first string argument,
then eval to JSON via node. Files that still fail are kept as .txt for manual reading."""
import os, re, subprocess

D = "/home/z/my-project/scripts/out/data"
J = f"{D}/json"
os.makedirs(J, exist_ok=True)

CALL_RE = re.compile(
    r'\b(?:Q|Je|Gt|_n|Sn|Ga|y1|m1|l1|j1|g1|b1|jw|zf|k1|N0|R0|T0|C0|I0|M0|E0|L0)\(\s*("(?:[^"\\]|\\.)*")\s*(?:,\s*("(?:[^"\\]|\\.)*"))?\s*\)'
)
CALL_ANY = re.compile(r'\b([A-Za-z_$][\w$]{0,24})\((\s*(?:"(?:[^"\\]|\\.)*")|\s*\'(?:[^\'\\]|\\.)*\')\s*(?:,[^()]*)?\)')

for f in sorted(os.listdir(D)):
    if not f.endswith(".lit"):
        continue
    raw = open(f"{D}/{f}", encoding="utf-8").read()
    txt = CALL_RE.sub(r"\1", raw)
    txt = CALL_ANY.sub(r"\1", txt)
    # any remaining bare call -> drop it entirely by replacing `NAME(...)` only when single simple arg failed
    has_jsx = "jsx(" in raw or "jsxs(" in raw or ".map(" in raw
    has_backtick = "`" in txt
    out = f"{J}/{f[:-4]}.json"
    script = f'''
const fs = require("fs");
let lit = {txt!r};
let stubs = {{}};
const names = [...lit.matchAll(/([A-Za-z_$][\\w$]{{0,24}})\\(/g)].map(m=>m[1]);
for (const n of new Set(names)) stubs[n] = (...a) => (typeof a[0] === "string" ? a[0] : a[0]);
let val;
try {{ val = new Function("stubs", "with(stubs){{ return (" + lit + "); }}")(stubs); }}
catch (e) {{
  fs.writeFileSync({out.replace(".json", ".txt")!r}, lit);
  console.log("FAIL", {f!r}, e.message.slice(0,100));
  process.exit(0);
}}
fs.writeFileSync({out!r}, JSON.stringify(val, null, 1));
console.log("OK", {f!r}, Array.isArray(val) ? val.length + " items" : typeof val, {f"{has_jsx=}"} , {f"{has_backtick=}"} );
'''
    r = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip()[:200])
