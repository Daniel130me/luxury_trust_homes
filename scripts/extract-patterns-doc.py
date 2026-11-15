#!/usr/bin/env python3
"""Build a compact pattern reference (patterns.md) from the clean prototype
DOM fragments: shell structure, tabs, tables, stepper, chat bubbles, forms,
button variants, page headers — everything needed to restyle the app."""
import re
from pathlib import Path

CLEAN = Path("/home/z/my-project/scripts/out/proto-dom/clean")
OUT = Path("/home/z/my-project/scripts/out/proto-dom/patterns.md")


def grab(fname, start, end, collapse=True, limit=40):
    text = (CLEAN / fname).read_text()
    m = re.search(start + r"(.*)" + end, text, re.S)
    if not m:
        return f"(not found: {start})"
    chunk = m.group(0)
    if collapse:
        chunk = re.sub(r"<svg[^>]*>.*?</svg>", "[svg]", chunk, flags=re.S)
    lines = [ln.strip() for ln in chunk.split("\n") if ln.strip()]
    return "\n".join(lines[:limit])


def classes(fname, pattern, limit=12):
    text = (CLEAN / fname).read_text()
    found = re.findall(r'class="([^"]*' + pattern + r'[^"]*)"', text)
    seen, out = set(), []
    for c in found:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return "\n".join(out[:limit])


parts = []
parts.append("# Prototype UI patterns (from rendered DOM)\n")

parts.append("## App shell (body children order, client-dashboard)")
parts.append(grab("client-dashboard.html", r"<body[^>]*>", r"<aside", limit=8))

parts.append("\n## Tabs (client-enquiries)")
parts.append(classes("client-enquiries.html", r'aria-selected'))

parts.append("\n## Table (staff-cases)")
parts.append(grab("staff-cases.html", r"<table", r"</thead>", limit=30))
parts.append("\nTable body row:")
parts.append(grab("staff-cases.html", r"<tbody", r"</tr>", limit=30))

parts.append("\n## Stepper/timeline dots (client-enquiry-detail)")
parts.append(classes("client-enquiry-detail.html", r"-left-6"))

parts.append("\n## Thread messages (client-enquiry-detail)")
parts.append(grab("client-enquiry-detail.html", r'Messages with', r"</main>", limit=50))

parts.append("\n## Button variants across screens")
for pat in ["bg-brand-800 text-white", "bg-gold-400 ", "border-brand-300", "bg-red-600", "text-brand-700 hover:bg-brand-50", "bg-emerald-600", "bg-white text"]:
    parts.append(f"### {pat}\n" + classes("property-detail.html", pat, 4))
    parts.append(classes("staff-matter.html", pat, 4))

parts.append("\n## Page header block (staff-dashboard h1 area)")
parts.append(grab("staff-dashboard.html", r"<main", r"Total listings", limit=30))

parts.append("\n## Stat tile with icon tile (staff-dashboard)")
parts.append(grab("staff-dashboard.html", r'Total listings', r"Pending approvals", limit=20))

parts.append("\n## Login card (login.html)")
parts.append(grab("login.html", r"<main", r"</main>", limit=60))

parts.append("\n## Mobile bottom nav (client-dashboard)")
parts.append(grab("client-dashboard.html", r"safe-area-inset-bottom", r"</body>", limit=25, collapse=False))

OUT.write_text("\n".join(parts))
print(f"wrote {OUT} ({len(OUT.read_text())//1024}KB)")
