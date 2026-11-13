#!/usr/bin/env python3
"""Pass 5: dump ALL array/object literal assignments (any declaration form)."""
import os, re, subprocess, json

OUT = "/home/z/my-project/scripts/out"
js = open(f"{OUT}/bundle.js", encoding="utf-8").read()

def match_literal(js, start):
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

os.makedirs(f"{OUT}/data", exist_ok=True)
results = []
seen_spans = []
for m in re.finditer(r'\b([A-Za-z_$][\w$]{0,30})\s*=\s*(\[|\{)', js):
    name, brace = m.group(1), m.group(2)
    start = m.start(2)
    if any(s <= start < e for s, e in seen_spans):
        continue
    end = match_literal(js, start)
    if end == -1:
        continue
    size = end - start
    if size >= 800 and start > 150000:
        seen_spans.append((start, end))
        lit = js[start:end]
        fn = f"{OUT}/data/{name}_{start}.lit"
        with open(fn, "w", encoding="utf-8") as f:
            f.write(lit)
        results.append((name, start, size, fn))

results.sort(key=lambda r: r[1])
print("big literals (name, pos, size):")
for name, s, size, fn in results:
    print(f"  {name:26s} pos={s:7d} size={size:7d}  -> {os.path.basename(fn)}")
