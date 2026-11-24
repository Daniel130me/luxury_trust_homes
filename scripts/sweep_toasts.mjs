#!/usr/bin/env node
/**
 * Sweep: wire `toast.error(...)` into every simple one-line mutation catch.
 *
 * Pattern targeted (the dominant shape across app pages):
 *     } catch (err) {
 *       setError(err instanceof ApiRequestError ? err.message : "Could not X.");
 *   ->  toast.error(err instanceof ApiRequestError ? err.message : "Could not X.");
 *
 * The toast expression mirrors the setError expression exactly (pure
 * expression, no side effects). Object-shaped catches (fields maps,
 * status objects) are handled manually afterwards — they vary per form.
 * Idempotent: skips files already importing @/lib/toast with toast.error
 * already following the setError line.
 */
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "src/app/app/notifications/page.tsx",
  "src/app/app/help/page.tsx",
  "src/app/app/provider/cases/[id]/page.tsx",
  "src/app/app/client/payments/[id]/page.tsx",
  "src/app/app/client/enquiries/[id]/page.tsx",
  "src/app/app/staff/helpdesk/[id]/page.tsx",
  "src/app/app/staff/payments/[id]/page.tsx",
  "src/app/app/staff/settings/page.tsx",
  "src/app/app/staff/users/[id]/page.tsx",
  "src/app/app/staff/users/page.tsx",
  "src/app/app/staff/matters/[enquiryId]/page.tsx",
];

const simpleCatch =
  /^([ \t]+)(set\w+)\(err instanceof ApiRequestError \? err\.message : ("[^"\n]*")\);$/;

for (const path of files) {
  let src = readFileSync(path, "utf8");
  const lines = src.split("\n");
  const out = [];
  let inserted = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    const m = line.match(simpleCatch);
    if (m) {
      const next = lines[i + 1] ?? "";
      if (!next.includes("toast.error")) {
        out.push(`${m[1]}toast.error(err instanceof ApiRequestError ? err.message : ${m[3]});`);
        inserted++;
      }
    }
  }

  src = out.join("\n");

  if (inserted > 0 && !src.includes('from "@/lib/toast"')) {
    src = src.replace(
      /^(import \{ apiFetch[^"]*"[^"]*";\n)/m,
      `$1import { toast } from "@/lib/toast";\n`,
    );
  }

  writeFileSync(path, src);
  console.log(`${path}: ${inserted} catch(es) wired`);
}
