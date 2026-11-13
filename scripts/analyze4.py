#!/usr/bin/env python3
"""Pass 4: brace-match and dump every top-level data literal in the app region."""
import os, re

OUT = "/home/z/my-project/scripts/out"
js = open(f"{OUT}/bundle.js", encoding="utf-8").read()

def match_literal(js, start):
    """start = index of opening '[' or '{'. Return index after matching close, respecting quotes."""
    depth = 0
    i = start
    n = len(js)
    in_str = None
    while i < n:
        c = js[i]
        if in_str:
            if c == "\\":
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in "\"'`":
            in_str = c
        elif c in "[{(":
            depth += 1
        elif c in "]})":
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    return -1

# scan the app-code region for `NAME=[` / `NAME={` definitions
region_start = 150000
region_end = min(len(js), 270000)
region = js  # search globally but record positions
defs = []
for m in re.finditer(r'(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(\{|\[)', js):
    name, brace = m.group(1), m.group(2)
    start = m.start(2)
    end = match_literal(js, start)
    if end == -1:
        continue
    size = end - start
    defs.append((name, start, end, size))

print("literals found (name, pos, size):")
for name, s, e, size in defs:
    if size > 300:
        print(f"  {name:28s} pos={s:7d} size={size:7d}")

os.makedirs(f"{OUT}/data", exist_ok=True)
saved = []
for name, s, e, size in defs:
    if size > 200:
        lit = js[s:e]
        fn = f"{OUT}/data/{name}.js"
        with open(fn, "w", encoding="utf-8") as f:
            f.write(lit)
        saved.append(name)
print("saved:", saved)
