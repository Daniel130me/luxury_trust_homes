#!/usr/bin/env python3
"""Deep extraction pass 2: images, routes w/ params, data objects, enums, roles."""
import json, os, re
from collections import Counter

OUT = "/home/z/my-project/scripts/out"
js = open(f"{OUT}/bundle.js", encoding="utf-8").read()

# ---------------------------------------------------------------- image urls
urls = sorted(set(re.findall(r'"(https?://[^"\s]{10,300})"', js)))
imgs = [u for u in urls if re.search(r"\.(jpe?g|png|webp|avif|gif)(\?|$)|unsplash|pexels|images\.|photo|r2\.dev", u, re.I)]
open(f"{OUT}/image_urls.txt", "w").write("\n".join(imgs))
print(f"total urls: {len(urls)}  image-ish urls: {len(imgs)}")
for u in imgs[:25]:
    print("  ", u[:120])

# --------------------------------------------------------------- routes (wide)
routes = sorted(set(re.findall(r'"(/[^"]{1,60})"', js)))
open(f"{OUT}/routes_wide.txt", "w").write("\n".join(routes))
print("\nwide routes:", len(routes))
for r in routes:
    print("  ", r[:90])

# template-literal routes (backticks)
tpl = sorted(set(re.findall(r"`(/[a-z][^`]{1,60})`", js)))
print("\ntemplate routes:")
for r in tpl:
    print("  ", r[:90])

# ------------------------------------------------------------------- ids sample
ids = Counter(re.findall(r'\bid:"([^"]{1,40})"', js))
print("\nid prefixes:", Counter(k.split("-")[0][:12] for k in ids).most_common(30))
print("sample ids:", list(ids)[:40])

# ------------------------------------------------------------ status-like enums
statuses = Counter(re.findall(r'(?:status|stage|role|state):"([a-z_\- ]{3,30})"', js))
open(f"{OUT}/enums.txt", "w").write("\n".join(f"{k}: {v}" for k, v in statuses.most_common(120)))
print("\nstatus/stage/role values:")
for k, v in statuses.most_common(60):
    print(f"   {k} x{v}")

# roles specifically
roles = re.findall(r'role:"([^"]{2,30})"', js)
print("\nroles:", Counter(roles).most_common(20))
roles2 = re.findall(r'"(admin|lawyer|staff|client|provider|buyer|renter|owner|agent)"', js)
print("role words:", Counter(roles2).most_common())

# ------------------------------------------------------------- form field labels
labels = sorted(set(re.findall(r'(?:label|placeholder|title):"([^"]{3,70})"', js)))
open(f"{OUT}/labels.txt", "w").write("\n".join(labels))
print(f"\nlabel/placeholder/title strings: {len(labels)}")

# --------------------------------------------------------------- nav item names
nav = sorted(set(re.findall(r'name:"([^"]{2,40})"', js)))
print("\nname: strings:", len(nav))
open(f"{OUT}/names.txt", "w").write("\n".join(nav))

# headings: h1/h2/h3 usage via jsx children text — grab strings followed by nothing
# instead: find strings that look like marketing headings (contain capitalized words + no colon)
heads = [s for s in re.findall(r'"([A-Z][A-Za-z0-9 ,\.\'\-&₦]{15,110})"', js)
         if not re.search(r'[{}<>]|className|http', s)]
open(f"{OUT}/headings.txt", "w").write("\n".join(dict.fromkeys(heads)))
print("\nheading-like strings:", len(dict.fromkeys(heads)))

# ----------------------------------------------------------- property-like objects
# find arrays of objects: look for "title:" near "price" near "location"
prop_objs = re.findall(r'\{[^{}]*?id:"(p\d+|prop[^"]*)"[^{}]*\}', js)
print("\nprop-id objects:", len(prop_objs))
for o in prop_objs[:6]:
    print("  ", o[:220])

# explicit data blocks: find "PHOTOS" or "properties" arrays
for pat in [r'const [A-Za-z_$]+\s*=\s*\[\{', r'properties\s*=\s*\[', r'\bdata\s*:\s*\[']:
    found = re.findall(pat, js)
    print(f"pattern {pat!r}: {len(found)}")

# look for the word 'photos' arrays with urls
ph = re.findall(r'photos:\[(.{0,400}?)\]', js)
print("photos arrays:", len(ph))
for p in ph[:8]:
    print("   ", p[:180])
