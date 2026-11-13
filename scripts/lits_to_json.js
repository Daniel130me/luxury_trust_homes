// Convert prototype data literals (minified JS with helper calls) to JSON.
// Stubs replace runtime helpers (Q = date formatter, xn = id suffixer, ...).
const fs = require("fs");
const path = require("path");
const dir = "/home/z/my-project/scripts/out/data";
const out = "/home/z/my-project/scripts/out/data/json";
fs.mkdirSync(out, { recursive: true });

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".lit"));
for (const f of files) {
  const lit = fs.readFileSync(path.join(dir, f), "utf8");
  // Discover helper calls used inside the literal: NAME( — collect candidate names
  const helpers = new Set();
  for (const m of lit.matchAll(/([A-Za-z_$][\w$]{0,30})\(/g)) helpers.add(m[1]);
  // Common bundled helper names to stub (anything not a keyword/string method)
  const keywords = new Set(["if", "for", "while", "switch", "catch", "function", "return"]);
  const stubSrc = [];
  for (const h of helpers) {
    if (keywords.has(h)) continue;
    // identity function returning readable marker for debugging
    stubSrc.push(`${h}: (...a) => a.length ? (typeof a[0] === "string" ? a[0] : a[0]) : undefined`);
  }
  try {
    const json = new Function(`return ({${stubSrc.join(",")}}) => (${lit})`)(
      Object.fromEntries(stubSrc.map((s) => [s.split(":")[0], (...a) => (a.length ? a[0] : undefined)]))
    );
    fs.writeFileSync(path.join(out, f.replace(".lit", ".json")), JSON.stringify(json, null, 1));
    console.log("OK", f, Array.isArray(json) ? `${json.length} items` : typeof json);
  } catch (e) {
    console.log("FAIL", f, e.message.slice(0, 120));
  }
}
