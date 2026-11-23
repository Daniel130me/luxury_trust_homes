#!/usr/bin/env python3
"""Rebrand the app: site name -> "Luxury Trust Homes"; law firm ->
"Elvictoria Attorneys and Solicitors".

Each entry is (file, old_substring, new_substring, expected_count). A failed
assertion (wrong match count) aborts the run so no partial rebrand ships.
Code comments in globals.css / api.ts / seed.ts are deliberately left alone:
they are internal documentation, not user-visible branding.
"""
import pathlib

ROOT = pathlib.Path("/home/z/my-project")

F = "Luxury Trust Homes"          # site name
FIRM = "Elvictoria Attorneys and Solicitors"  # law firm (full)
SHORT = "Elvictoria"              # law firm, short form for tight UI labels

EDITS = [
    # ---- shared components ----
    ("src/components/platform/ui-bits.tsx",
     'aria-label="ELVICTORIA home"', f'aria-label="{F} home"', 1),
    ("src/components/platform/ui-bits.tsx",
     'EL<span className="text-gold-500">V</span>ICTORIA',
     f'Luxury <span className="text-gold-500">Trust</span> Homes', 1),
    ("src/components/platform/public-footer.tsx",
     "ELVICTORIA connects buyers and renters with property owners, landlords and agents in Lagos and Enugu.",
     f"{F} — powered by {FIRM} — connects buyers and renters with property owners, landlords and agents in Lagos and Enugu.", 1),
    ("src/components/platform/public-footer.tsx",
     "How ELVICTORIA works", f"How {F} works", 1),
    ("src/components/platform/public-footer.tsx",
     "© {new Date().getFullYear()} ELVICTORIA. All rights reserved.",
     f"© {{new Date().getFullYear()}} {FIRM}. All rights reserved.", 1),
    ("src/components/platform/workspace-shell.tsx",
     "visible to ELVICTORIA staff only.", f"visible to {SHORT} staff only.", 1),
    ("src/components/platform/workspace-shell.tsx",
     "handled by the ELVICTORIA legal team.", f"handled by the {SHORT} legal team.", 1),

    # ---- metadata ----
    ("src/app/layout.tsx",
     '"ELVICTORIA — Property with Legal Confidence"',
     f'"{F} — Property with Legal Confidence"', 1),
    ("src/app/layout.tsx",
     '"%s | ELVICTORIA"', f'"%s | {F}"', 1),

    # ---- public pages ----
    ("src/app/(public)/page.tsx",
     'aria-label="Why ELVICTORIA"', f'aria-label="Why {F}"', 1),
    ("src/app/(public)/page.tsx",
     '<p className="eyebrow">Why ELVICTORIA</p>',
     f'<p className="eyebrow">Why {F}</p>', 1),
    ("src/app/(public)/page.tsx",
     "On ELVICTORIA, our lawyers stand between you",
     f"On {F}, our lawyers stand between you", 1),
    ("src/app/(public)/page.tsx",
     "A qualified ELVICTORIA lawyer manages your enquiry",
     f"A qualified {SHORT} lawyer manages your enquiry", 1),
    ("src/app/(public)/terms/page.tsx",
     "1. About ELVICTORIA", f"1. About {F}", 1),
    ("src/app/(public)/terms/page.tsx",
     "ELVICTORIA is a property platform operated by ELVICTORIA Attorneys that facilitates property",
     f"{F} is a property platform operated by {FIRM} that facilitates property", 1),
    ("src/app/(public)/terms/page.tsx",
     "ELVICTORIA legal team", f"{SHORT} legal team", 1),
    ("src/app/(public)/terms/page.tsx",
     "ELVICTORIA will never ask you to pay into a personal account",
     f"{F} will never ask you to pay into a personal account", 1),
    ("src/app/(public)/privacy/page.tsx",
     "ELVICTORIA does not store card details.", f"{F} does not store card details.", 1),
    ("src/app/(public)/properties/page.tsx",
     "reviewed by the ELVICTORIA legal team", f"reviewed by the {SHORT} legal team", 1),
    ("src/app/(public)/help/page.tsx",
     "assigned to an ELVICTORIA lawyer", f"assigned to an {SHORT} lawyer", 1),
    ("src/app/(public)/help/page.tsx",
     '"ELVICTORIA Support"', f'"{SHORT} Support"', 1),
    ("src/app/(public)/about/page.tsx",
     "1. About ELVICTORIA", f"1. About {F}", 1),
    ("src/app/(public)/about/page.tsx",
     "ELVICTORIA is a property platform operated by ELVICTORIA Attorneys that facilitates property",
     f"{F} is a property platform operated by {FIRM} that facilitates property", 1),
    ("src/app/(public)/about/page.tsx",
     "Flutterwave. ELVICTORIA will", f"Flutterwave. {F} will", 1),
    ("src/app/(public)/sell/page.tsx",
     "ELVICTORIA connects your property", f"{F} connects your property", 1),
    ("src/app/(auth)/login/page.tsx",
     "New to ELVICTORIA?", f"New to {F}?", 1),

    # ---- in-app surfaces ----
    ("src/app/app/client/payments/[id]/page.tsx",
     "Pay into the ELVICTORIA account — confirmed by the legal team",
     f"Pay into the {FIRM} account — confirmed by the legal team", 1),
    ("src/app/app/client/payments/[id]/page.tsx",
     "into the ELVICTORIA account below, then",
     f"into the {FIRM} account below, then", 1),
    ("src/app/app/client/payments/[id]/page.tsx",
     "ELVICTORIA will never ask you to pay into a personal account, or to pay anyone by",
     f"{F} will never ask you to pay into a personal account, or to pay anyone by", 1),
    ("src/app/app/client/page.tsx",
     "managed by the ELVICTORIA legal team.", f"managed by the {SHORT} legal team.", 1),
    ("src/app/app/client/enquiries/[id]/page.tsx",
     "Messages with the ELVICTORIA legal team",
     f"Messages with the {SHORT} legal team", 1),
    ("src/app/app/client/enquiries/[id]/page.tsx",
     "· ELVICTORIA Legal", f"· {SHORT} Legal", 1),
    ("src/app/app/client/enquiries/page.tsx",
     "lawyer from the ELVICTORIA legal team.",
     f"lawyer from the {SHORT} legal team.", 1),
    ("src/app/app/provider/cases/[id]/page.tsx",
     "Messages with the ELVICTORIA legal team",
     f"Messages with the {SHORT} legal team", 1),
    ("src/app/app/provider/cases/[id]/page.tsx",
     "· ELVICTORIA Legal", f"· {SHORT} Legal", 1),
    ("src/app/app/provider/cases/page.tsx",
     "an ELVICTORIA lawyer.", f"an {SHORT} lawyer.", 1),
    ("src/app/app/staff/matters/[enquiryId]/page.tsx",
     "· ELVICTORIA Legal", f"· {SHORT} Legal", 1),
    ("src/app/app/staff/settings/page.tsx",
     "The ELVICTORIA account shown to a payer at the payment stage.",
     f"The {FIRM} account shown to a payer at the payment stage.", 1),
    ("src/app/app/staff/users/page.tsx",
     "providers and ELVICTORIA staff.", f"providers and {SHORT} staff.", 1),
    ("src/app/app/help/[id]/page.tsx",
     '"ELVICTORIA Support"', f'"{SHORT} Support"', 1),
    ("src/app/app/staff/helpdesk/[id]/page.tsx",
     '"ELVICTORIA Support"', f'"{SHORT} Support"', 1),

    # ---- backend user-facing strings ----
    ("elvictoria/backend/src/lib/flutterwave.ts",
     'title: "ELVICTORIA",', f'title: "{F}",', 1),
    ("elvictoria/backend/src/modules/auth/service.ts",
     "Please contact ELVICTORIA support.", f"Please contact {SHORT} support.", 2),
]

applied = 0
for rel, old, new, expected in EDITS:
    path = ROOT / rel
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    # Idempotent: an entry whose replacement is already present and whose old
    # string no longer matches counts as done (the script may be re-run after
    # a mid-list abort).
    if count == 0 and new in text:
        continue
    assert count == expected, (
        f"{rel}: expected {expected} match(es) for {old[:60]!r}, found {count}"
    )
    path.write_text(text.replace(old, new), encoding="utf-8")
    applied += 1

print(f"OK: {applied} edits applied across {len({e[0] for e in EDITS})} files")
