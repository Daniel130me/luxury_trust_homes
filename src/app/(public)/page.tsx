"use client";

/**
 * Home page — hero with property search, "Why ELVICTORIA" and featured
 * listings, all matching the reviewed prototype. Search results come from
 * the real database through the Express API.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PropertyCard, type PropertyCardData } from "@/components/platform/property-card";
import { Button, Card, Select, SearchIcon, ScaleIcon, ShieldIcon, CheckCircleIcon } from "@/components/platform/ui-bits";

type FeaturedResponse = { properties: PropertyCardData[] };

export default function HomePage() {
  const router = useRouter();
  const [featured, setFeatured] = useState<PropertyCardData[] | null>(null);
  const [deal, setDeal] = useState<"sale" | "rent">("sale");
  const [state, setState] = useState("");
  const [category, setCategory] = useState("");

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
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-brand-900"
          aria-hidden
          style={{
            backgroundImage:
              "linear-gradient(100deg, rgba(43,10,17,0.92) 0%, rgba(79,21,32,0.82) 45%, rgba(122,35,51,0.55) 100%), url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1600&q=70&auto=format&fit=crop')",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:py-20">
          <div className="text-white">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-300">
              Property in Lagos and Enugu, handled with care
            </p>
            <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">
              Find Your Next Property with Confidence.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85">
              Explore properties for sale and rent, with enquiries and transactions coordinated
              through our legal team — so you never deal with strangers and your details stay
              confidential.
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/85">
              {[
                { icon: <ScaleIcon className="h-4 w-4" />, label: "Lawyer-managed transactions" },
                { icon: <ShieldIcon className="h-4 w-4" />, label: "Confidential by default" },
                { icon: <CheckCircleIcon className="h-4 w-4" />, label: "Reviewed listings, fewer scams" },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  <span className="text-gold-300">{item.icon}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Search card */}
          <Card className="self-center p-5 sm:p-6">
            <form onSubmit={submitSearch} aria-label="Property search" className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-brand-50 p-1" role="group" aria-label="Buy or rent">
                {(["sale", "rent"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setDeal(option)}
                    aria-pressed={deal === option}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                      deal === option ? "bg-brand-700 text-white" : "text-brand-700 hover:bg-brand-100"
                    }`}
                  >
                    {option === "sale" ? "Buy" : "Rent"}
                  </button>
                ))}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-strong">State</span>
                  <Select value={state} onChange={(e) => setState(e.target.value)} aria-label="State">
                    <option value="">All states</option>
                    <option value="Lagos">Lagos</option>
                    <option value="Enugu">Enugu</option>
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-strong">Property type</span>
                  <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Property type">
                    <option value="">All property types</option>
                    <option value="DETACHED_DUPLEX">Detached Duplex</option>
                    <option value="SEMI_DETACHED_DUPLEX">Semi-Detached Duplex</option>
                    <option value="APARTMENT">Apartment</option>
                    <option value="TERRACE">Terrace House</option>
                    <option value="BUNGALOW">Bungalow</option>
                    <option value="LAND">Residential Land</option>
                    <option value="COMMERCIAL">Commercial Property</option>
                  </Select>
                </label>
              </div>
              <Button type="submit" className="w-full">
                <SearchIcon className="h-4 w-4" />
                Search
              </Button>
            </form>
          </Card>
        </div>
      </section>

      {/* --------------------------------------------------- why section */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Why ELVICTORIA</p>
        <h2 className="mt-2 max-w-2xl font-serif text-3xl text-ink-strong sm:text-4xl">
          Lawyers handle everything — not strangers.
        </h2>
        <p className="mt-3 max-w-3xl leading-relaxed text-ink-soft">
          Property search in Nigeria often means unknown agents, shared phone numbers and requests for
          upfront fees. On ELVICTORIA, our lawyers stand between you and every transaction — giving
          buyers, renters and owners peace of mind.
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              icon: <CheckCircleIcon className="h-5 w-5" />,
              title: "Every listing is reviewed",
              body: "Our lawyers review each property before it goes live, and can reject or withdraw listings that do not meet our standards.",
            },
            {
              icon: <CreditCardIconSmall />,
              title: "Safer payments",
              body: "Payment requests come only from your lawyer, inside your account and linked to your case — never to a personal account.",
            },
          ].map((item) => (
            <Card key={item.title} className="p-5">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-700">
                {item.icon}
              </span>
              <h3 className="mt-3 font-semibold text-ink-strong">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------ featured */}
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Featured</p>
            <h2 className="mt-2 font-serif text-3xl text-ink-strong">Selected properties</h2>
          </div>
          <Link href="/properties" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
            View all properties →
          </Link>
        </div>

        {featured === null ? (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-zinc-100" />
            ))}
          </div>
        ) : featured.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-ink-muted">
            Featured listings will appear here once properties are approved.{" "}
            <Link href="/sell" className="font-semibold text-brand-700">
              List a property
            </Link>
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CreditCardIconSmall() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}
