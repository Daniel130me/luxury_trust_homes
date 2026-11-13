#!/usr/bin/env python3
"""Analyse the ELVICTORIA prototype HTML bundle.

Extracts:
  1. The <style> block (design tokens: colours, fonts, radii).
  2. Embedded base64 photos -> photo files.
  3. The main JS bundle -> route paths, UI strings, data objects.
Outputs plain-text reports under scripts/out/ for review.
"""
import base64, json, os, re
from collections import Counter

SRC = "/home/z/my-project/upload/elvictoria_with_photos.html"
OUT = "/home/z/my-project/scripts/out"
os.makedirs(f"{OUT}/photos", exist_ok=True)

html = open(SRC, encoding="utf-8").read()
print(f"file size: {len(html)} bytes")

# ---------------------------------------------------------------- style block
m = re.search(r"<style[^>]*>(.*?)</style>", html, re.S)
css = m.group(1) if m else ""
open(f"{OUT}/style.css", "w", encoding="utf-8").write(css)
print(f"style bytes: {len(css)}")

colors = Counter(re.findall(r"#[0-9a-fA-F]{6}\b", css))
print("top hex colours:", colors.most_common(25))
print("font families:", sorted(set(re.findall(r"font-family:([^;}]+)", css))))
radii = sorted(set(re.findall(r"border-radius:\s*([^;}]+)", css)))
print("radii sample:", radii[:15])

# ------------------------------------------------------------- embedded photos
photos = re.findall(r"data:image/([a-zA-Z+]+);base64,([A-Za-z0-9+/=]+)", html)
print(f"embedded photos: {len(photos)}")
manifest = []
for i, (ext, b64) in enumerate(photos):
    try:
        raw = base64.b64decode(b64)
    except Exception:
        continue
    name = f"photo_{i:02d}.{'jpg' if ext == 'jpeg' else ext}"
    with open(f"{OUT}/photos/{name}", "wb") as f:
        f.write(raw)
    manifest.append({"file": name, "bytes": len(raw)})
json.dump(manifest, open(f"{OUT}/photos/manifest.json", "w"), indent=1)
print("photo sizes:", [p["bytes"] for p in manifest][:30])

# ------------------------------------------------------------------- js bundle
scripts = re.findall(r"<script[^>]*>(.*?)</script>", html, re.S)
js = max(scripts, key=len)
open(f"{OUT}/bundle.js", "w", encoding="utf-8").write(js)
print(f"bundle bytes: {len(js)}")

# route-like strings
routes = sorted(set(re.findall(r'"(/(?:[a-z0-9\-]+(?:/[a-z0-9\-\:]+)?))"', js)))
open(f"{OUT}/routes.txt", "w").write("\n".join(routes))
print("routes found:", len(routes))
for r in routes:
    print("  ", r)

# localStorage keys
print("localStorage keys:", sorted(set(re.findall(r'localStorage\.(?:get|set|remove)Item\("([^"]+)"', js))))

# navigate / href targets
navs = re.findall(r'(?:navigate|push)\("([^"]+)"', js)
print("navigate targets:", Counter(navs).most_common(40))

# readable UI strings (not classname-like)
words = re.findall(r'"([A-Za-z0-9 ,\.\'\-\(\)/&%₦:+]{4,90})"', js)
def ui_like(s):
    if re.fullmatch(r"[a-z0-9\-/ _]+", s) and " " not in s:
        return False
    alpha = sum(c.isalpha() for c in s)
    return alpha >= 4 and (" " in s or s.isupper() or s.istitle())
ui, seen, ordered = words, set(), []
for w in ui:
    if w not in seen:
        seen.add(w)
        ordered.append(w)
print(f"unique ui-ish strings: {len(ordered)}")
open(f"{OUT}/strings_ui.txt", "w").write("\n".join(ordered))

# Naira price strings
prices = sorted(set(re.findall(r'"(₦[^"]{2,40})"', js)))
open(f"{OUT}/prices.txt", "w").write("\n".join(prices))
print("price strings:", prices[:30])

# domain keywords occurrence counts
for key in ["bedrooms", "bathrooms", "sqm", "propertyType", "listingType", "caseNumber", "enquiry", "lawyer", "vendor", "saved", "Flutterwave", "payment"]:
    print(f"key '{key}' occurrences: {len(re.findall(re.escape(key), js))}")
