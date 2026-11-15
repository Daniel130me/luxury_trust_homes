#!/usr/bin/env python3
"""Isolate the rendered body markup from prototype DOM dumps.

Each dump in scripts/out/proto-dom/*.html is a full SPA export (embedded
<style> + <script> + the rendered DOM). This script strips style/script
and writes clean body fragments to proto-dom/clean/<name>.html so the
class patterns can be inspected per screen.
"""
import json
import re
from pathlib import Path

SRC = Path("/home/z/my-project/scripts/out/proto-dom")
DST = SRC / "clean"
DST.mkdir(exist_ok=True)

for f in sorted(SRC.glob("*.html")):
    html = f.read_text()
    # eval sometimes returns a JSON-quoted string — unescape when present.
    if html.startswith('"') and html.rstrip().endswith('"'):
        html = json.loads(html)
    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
    if not body:
        print(f"{f.name}: no body found")
        continue
    frag = body.group(1)
    frag = re.sub(r"<style\b.*?</style>", "", frag, flags=re.S)
    frag = re.sub(r"<script\b.*?</script>", "", frag, flags=re.S)
    frag = re.sub(r"<link\b[^>]*>", "", frag)
    # pretty-print: newline before each opening tag for greppability
    frag = re.sub(r"><", ">\n<", frag)
    out = DST / f.name
    out.write_text(frag)
    print(f"{f.name}: {len(frag)//1024}KB -> clean/{f.name}")
