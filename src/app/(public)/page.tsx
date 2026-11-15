"use client";

/**
 * Home page — hero with property search, "Why ELVICTORIA" and featured
 * listings. Structure and classes are lifted from the prototype: dark
 * wine hero over a photo with left gradient, gold eyebrow, DM Serif
 * headline, white search card, wine-tinted feature cards. Search results
 * come from the real database through the Express API.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { usePropertyTypes } from "@/lib/property-types";
import { PropertyCard, type PropertyCardData } from "@/components/platform/property-card";
import { Button, Select, ShieldIcon, CheckIcon, ScaleIcon, SearchIcon, CreditCardIcon } from "@/components/platform/ui-bits";

type FeaturedResponse = { properties: PropertyCardData[] };

export default function HomePage() {
  const router = useRouter();
  const [featured, setFeatured] = useState<PropertyCardData[] | null>(null);
  const [deal, setDeal] = useState<"sale" | "rent">("sale");
  const [state, setState] = useState("");
  const [category, setCategory] = useState("");
  const propertyTypes = usePropertyTypes();

  useEffect(() => {
    apiFetch<FeaturedResponse>("/properties/featured")
      .then((d) => setFeatured(d.properties.slice(0, 6)))
      .catch(() => setFeatured([]));
  }, []);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    params.set("type", deal);
    if (state) params.set("state", state);
    if (category) params.set("category", category);
    router.push(`/properties?${params.toString()}`);
  }

  return (
    <main>
      {/* ---------------------------------------------------------- hero */}
      <section className="relative isolate overflow-hidden bg-brand-950">
        <img
          src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=82"
          alt="Contemporary detached home at dusk"
          className="object-cover absolute inset-0 -z-10 h-full w-full opacity-70"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand-950 via-brand-950/80 to-brand-950/20" />
        <div className="container-page py-20 sm:py-28 lg:py-32">
          <div className="max-w-2xl">
            <p className="eyebrow text-gold-300">Property in Lagos and Enugu, handled with care</p>
            <h1 className="mt-4 font-display text-4xl leading-[1.1] text-white sm:text-5xl lg:text-6xl">
              Find Your Next Property with Confidence.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">
              Explore properties for sale and rent, with enquiries and transactions coordinated
              through our legal team — so you never deal with strangers and your details stay
              confidential.
            </p>
          </div>

          <form noValidate onSubmit={submitSearch} aria-label="Property search" className="mt-10 max-w-4xl rounded-2xl bg-white p-3 shadow-lift sm:p-4">
            <div className="mb-3 inline-flex rounded-lg bg-brand-50 p-1" role="group" aria-label="Buy or rent">
              {(["sale", "rent"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDeal(option)}
                  aria-pressed={deal === option}
                  className={`rounded-md px-5 py-1.5 text-sm font-semibold transition ${
                    deal === option ? "bg-brand-800 text-white shadow" : "text-ink-soft"
                  }`}
                >
                  {option === "sale" ? "Buy" : "Rent"}
                </button>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
                <option value="">All states</option>
                <option value="Lagos">Lagos</option>
                <option value="Enugu">Enugu</option>
              </Select>
              <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Property type">
                <option value="">All property types</option>
                {(propertyTypes ?? []).map((type) => (
                  <option key={type.id} value={type.name}>{type.name}</option>
                ))}
              </Select>
              <Button type="submit" size="lg">
                <SearchIcon className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2" aria-label="Why ELVICTORIA">
            {[
              { icon: <ScaleIcon className="h-4 w-4" />, label: "Lawyer-managed transactions" },
              { icon: <ShieldIcon className="h-4 w-4" />, label: "Confidential by default" },
              { icon: <ShieldIcon className="h-4 w-4" />, label: "Reviewed listings, fewer scams" },
            ].map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm text-white/85">
                <span className="text-gold-300">{item.icon}</span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* --------------------------------------------------- why section */}
      <section className="container-page pt-16 sm:pt-20">
        <div className="mb-8 max-w-2xl">
          <p className="eyebrow">Why ELVICTORIA</p>
          <h2 className="mt-1.5 font-display text-3xl sm:text-4xl">
            Lawyers handle everything — not strangers.
          </h2>
          <p className="mt-3 text-base text-ink-soft">
            Property search in Nigeria often means unknown agents, shared phone numbers and requests for
            upfront fees. On ELVICTORIA, our lawyers stand between you and every transaction — giving
            buyers, renters and owners peace of mind.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: <ScaleIcon className="h-5 w-5" />,
              title: "Lawyers handle every enquiry",
              body: "A qualified ELVICTORIA lawyer manages your enquiry from first question to completion. You never deal with an unknown middleman.",
            },
            {
              icon: <ShieldIcon className="h-5 w-5" />,
              title: "Your details stay confidential",
              body: "Your phone number and email are never published. They are shared only when your lawyer authorises it for your transaction, and every disclosure is recorded.",
            },
            {
              icon: <CheckIcon className="h-5 w-5" />,
              title: "Every listing is reviewed",
              body: "Our lawyers review each property before it goes live, and can reject or withdraw listings that do not meet our standards.",
            },
            {
              icon: <CreditCardIcon className="h-5 w-5" />,
              title: "Safer payments",
              body: "Payment requests come only from your lawyer, inside your account and linked to your case — never to a personal account.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-brand-100 bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                {item.icon}
              </span>
              <p className="mt-4 text-lg font-semibold text-ink-strong">{item.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ featured */}
      <section className="container-page py-16 sm:py-20">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Featured</p>
            <h2 className="mt-1.5 font-display text-3xl">Selected properties</h2>
          </div>
          <Link href="/properties" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            View all properties
          </Link>
        </div>

        {featured === null ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[16/10] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brand-200 bg-white p-8 text-center text-sm text-ink-muted">
            Featured listings will appear here once properties are approved.{" "}
            <Link href="/sell" className="font-semibold text-brand-700">
              List a property
            </Link>
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
