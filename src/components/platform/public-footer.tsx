"use client";

/**
 * Public footer — matches the prototype: dark brand-950 band, wide brand
 * column with white logo variant and serif tagline, Explore links and an
 * Office column with gold icons. Contact details come from the platform
 * settings where available.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Logo, MapPinIcon, EnvelopeIcon, ClockIcon } from "./ui-bits";

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

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

  const contact = [
    { icon: <MapPinIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />, value: office.address ?? "14B Ademola Adetokunbo Crescent, Victoria Island, Lagos" },
    { icon: <PhoneIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />, value: office.phone ?? "+234 201 330 4410" },
    { icon: <EnvelopeIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />, value: office.email ?? "hello@elvictoria.example" },
    { icon: <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />, value: office.hours ?? "Monday – Friday, 8:30am – 5:30pm (WAT)" },
  ];

  return (
    <footer className="bg-brand-950 text-brand-200">
      <div className="container-page grid gap-10 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-4 font-display text-xl text-white">Lawyers handle everything — not strangers.</p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-brand-200">
            Luxury Trust Homes — powered by Elvictoria Attorneys and Solicitors — connects buyers and renters with property owners, landlords and agents in Lagos and Enugu.
            Every enquiry is coordinated by our legal team, from first contact to completion.
          </p>
        </div>
        <nav aria-label="Explore">
          <p className="mb-3 text-sm font-semibold text-white">Explore</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-white" href="/properties?type=sale">Properties for sale</Link></li>
            <li><Link className="hover:text-white" href="/properties?type=rent">Properties for rent</Link></li>
            <li><Link className="hover:text-white" href="/about">How Luxury Trust Homes works</Link></li>
            <li><Link className="hover:text-white" href="/sell">List a property</Link></li>
            <li><Link className="hover:text-white" href="/help">Help Desk</Link></li>
            <li><Link className="hover:text-white" href="/contact">Contact</Link></li>
            <li><Link className="hover:text-white" href="/terms">Terms and Conditions</Link></li>
            <li><Link className="hover:text-white" href="/privacy">Privacy Policy</Link></li>
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-sm font-semibold text-white">Office</p>
          <ul className="space-y-2.5 text-sm">
            {contact.map((item) => (
              <li key={item.value} className="flex gap-2">
                {item.icon}
                {item.value}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-900">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-brand-400 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Elvictoria Attorneys and Solicitors. All rights reserved.</p>
          <p>Property information is supplied by listing providers and reviewed by our legal team before publication.</p>
        </div>
      </div>
    </footer>
  );
}
