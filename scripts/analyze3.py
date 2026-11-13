#!/usr/bin/env python3
"""Pass 3: locate the sample-data section, extract entity objects, svg icons, urls."""
import json, os, re

OUT = "/home/z/my-project/scripts/out"
js = open(f"{OUT}/bundle.js", encoding="utf-8").read()

# where does data live?
for anchor in ["u_adaeze", "pf_", "c_2001", "enq_", "pay_300", "t_5001", "reference:"]:
    idxs = [m.start() for m in re.finditer(re.escape(anchor), js)]
    print(f"{anchor}: {len(idxs)} hits, first at {idxs[0] if idxs else None}, last {idxs[-1] if idxs else None}")

# the 6 urls
urls = sorted(set(re.findall(r'"(https?://[^"\s]{10,300})"', js)))
print("\nurls:")
for u in urls:
    print("  ", u[:200])

# svg data uris
svgs = re.findall(r'data:image/svg\+xml[^"\')\s]{0,80}', js)
print(f"\nsvg data uris: {len(svgs)}")
for s in svgs[:5]:
    print("  ", s[:80])
base64_any = re.findall(r'data:[a-z]+/[a-z0-9.+-]+;base64', js)
print("any base64 uris:", len(base64_any))

# const declarations (names of data stores)
consts = re.findall(r'const ([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(\[|\{)', js)
from collections import Counter
print("\nconst names (unique, with array/object):")
names = [c[0] for c in consts]
# print those that look domain-y (uppercase or long)
dom = [n for n in dict.fromkeys(names) if n.isupper() or len(n) > 6]
print(len(dom), dom[:80])

# function/var declarations near app code start (first occurrence of 'ELVICTORIA' or app strings)
i = js.find("u_adaeze")
print("\n--- context around first u_adaeze (user object) ---")
print(js[max(0, i-700): i+1400])
