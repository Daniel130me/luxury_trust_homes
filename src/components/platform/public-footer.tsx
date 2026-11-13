"use client";

/**
 * Public footer — matches the prototype's footer navigation and the
 * platform settings pulled from the backend where available.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Logo } from "./ui-bits";

export function PublicFooter() {
  const [office, setOffice] = useState<{ address?: string; phone?: string; email?: string; hours?: string }>({});

  useEffect(() => {
    // Settings are public-safe contact details for the footer.
    fetchSettings();
    async function fetchSettings() {
      try {
        const data = await apiFetch<{ settings: Record<string, string> }>("/settings/public").catch(() => null);
        if (data) {
          setOffice({
            address: data.settings.officeAddress,
            phone: data.settings.officePhone,
            email: data.settings.officeEmail,
            hours: data.settings.officeHours,
          });
        }
      } catch {
        // Static footer content still renders without settings.
      }
    }
  }, []);

  return (
    <footer className="mt-auto border-t border-zinc-200/70 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
            Property in Lagos and Enugu, handled with care. Every enquiry and transaction is coordinated
            through the ELVICTORIA legal team.
          </p>
        </div>
        <nav aria-label="Properties">
          <p className="text-sm font-semibold text-ink-strong">Properties</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link className="hover:text-brand-700" href="/properties?type=sale">Properties for sale</Link></li>
            <li><Link className="hover:text-brand-700" href="/properties?type=rent">Properties for rent</Link></li>
            <li><Link className="hover:text-brand-700" href="/properties">Explore all</Link></li>
            <li><Link className="hover:text-brand-700" href="/sell">List a property</Link></li>
          </ul>
        </nav>
        <nav aria-label="Company">
          <p className="text-sm font-semibold text-ink-strong">Company</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            <li><Link className="hover:text-brand-700" href="/about">How ELVICTORIA works</Link></li>
            <li><Link className="hover:text-brand-700" href="/help">Help Desk</Link></li>
            <li><Link className="hover:text-brand-700" href="/contact">Contact</Link></li>
          </ul>
        </nav>
        <div>
          <p className="text-sm font-semibold text-ink-strong">Our office</p>
          <ul className="mt-3 space-y-2 text-sm text-ink-muted">
            {office.address && <li>{office.address}</li>}
            {office.phone && <li>{office.phone}</li>}
            {office.email && <li>{office.email}</li>}
            {office.hours && <li>{office.hours}</li>}
            {!office.address && (
              <>
                <li>14B Ademola Adetokunbo Crescent, Victoria Island, Lagos</li>
                <li>+234 201 330 4410</li>
                <li>hello@elvictoria.example</li>
                <li>Monday – Friday, 8:30am – 5:30pm (WAT)</li>
              </>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-ink-muted sm:px-6">
          <p>© {new Date().getFullYear()} ELVICTORIA. All rights reserved.</p>
          <p className="flex gap-4">
            <Link className="hover:text-brand-700" href="/terms">Terms and Conditions</Link>
            <Link className="hover:text-brand-700" href="/privacy">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
