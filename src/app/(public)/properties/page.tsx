"use client";

/**
 * Property catalogue — search box, cascading filters (state → region →
 * LGA → area), listing type, property type, price band, bedrooms, sort and
 * grid/list toggle. All queries hit the real database with pagination.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatNaira, CATEGORY_LABELS } from "@/lib/format";
import { PropertyCard, type PropertyCardData } from "@/components/platform/property-card";
import {
  Button, Card, Input, Select, EmptyState, PageLoader, SearchIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from "@/components/platform/ui-bits";

type Response = { properties: PropertyCardData[]; total: number; page: number; pages: number };
const PRICE_BANDS = [
  { value: "", label: "Any price" },
  { value: "0-50000000", label: "Under ₦50M" },
  { value: "50000000-100000000", label: "₦50M – ₦100M" },
  { value: "100000000-200000000", label: "₦100M – ₦200M" },
  { value: "200000000-999999999999", label: "Above ₦200M" },
];

export default function PropertiesPage() {
  const router = useRouter();
  const params = useSearchParams();

  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [type, setType] = useState(params.get("type") ?? "");
  const [state, setState] = useState(params.get("state") ?? "");
  const [region, setRegion] = useState(params.get("region") ?? "");
  const [lga, setLga] = useState(params.get("lga") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [priceBand, setPriceBand] = useState("");
  const [beds, setBeds] = useState("");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [page, setPage] = useState(1);

  // Debounced search input (performance: avoids a request per keystroke).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchResults = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const [priceMin, priceMax] = priceBand ? priceBand.split("-") : ["", ""];
        const result = await apiFetch<Response>("/properties", {
          query: {
            search: debouncedSearch || undefined,
            type: type || undefined,
            state: state || undefined,
            region: region || undefined,
            lga: lga || undefined,
            category: category || undefined,
            priceMin: priceMin || undefined,
            priceMax: priceMax || undefined,
            beds: beds || undefined,
            sort: sort || undefined,
            page: targetPage,
            pageSize: 12,
          },
        });
        setData(result);
        setPage(targetPage);
      } catch {
        setData({ properties: [], total: 0, page: 1, pages: 0 });
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, type, state, region, lga, category, priceBand, beds, sort],
  );

  useEffect(() => {
    void fetchResults(1);
  }, [fetchResults]);

  const hasFilters = useMemo(
    () => Boolean(debouncedSearch || type || state || region || lga || category || priceBand || beds),
    [debouncedSearch, type, state, region, lga, category, priceBand, beds],
  );

  const eyebrow =
    type === "sale" ? "Explore buying" : type === "rent" ? "Explore renting" : "Explore properties";
  const heading =
    type === "sale" ? "Properties for sale" : type === "rent" ? "Properties for rent" : "All properties";

  function clearFilters() {
    setSearch("");
    setType("");
    setState("");
    setRegion("");
    setLga("");
    setCategory("");
    setPriceBand("");
    setBeds("");
    router.replace("/properties");
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">{eyebrow}</p>
      <h1 className="mt-2 font-serif text-3xl text-ink-strong sm:text-4xl">{heading}</h1>
      <p className="mt-2 max-w-3xl leading-relaxed text-ink-soft">
        Every listing below has been reviewed by the ELVICTORIA legal team, and every enquiry is
        handled by a lawyer.
      </p>

      {/* ------------------------------------------------------ filters */}
      <Card className="mt-6 p-4 sm:p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by area, city, title or reference"
              aria-label="Search properties"
              className="pl-10"
            />
          </div>
          <Button onClick={() => void fetchResults(1)} className="shrink-0">
            Search
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Select value={type} onChange={(e) => setType(e.target.value)} aria-label="Buy or rent">
            <option value="">Buy or rent</option>
            <option value="sale">For sale</option>
            <option value="rent">For rent</option>
          </Select>
          <Select value={state} onChange={(e) => { setState(e.target.value); setLga(""); }} aria-label="State">
            <option value="">All states</option>
            <option value="Lagos">Lagos</option>
            <option value="Enugu">Enugu</option>
          </Select>
          <Select
            value={lga}
            onChange={(e) => setLga(e.target.value)}
            aria-label="Local Government Area"
            disabled={!state}
          >
            <option value="">All LGAs</option>
            {LGA_OPTIONS[state]?.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Property type">
            <option value="">All property types</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select value={priceBand} onChange={(e) => setPriceBand(e.target.value)} aria-label="Price range">
            {PRICE_BANDS.map((band) => (
              <option key={band.value} value={band.value}>{band.label}</option>
            ))}
          </Select>
          <Select value={beds} onChange={(e) => setBeds(e.target.value)} aria-label="Bedrooms">
            <option value="">Any bedrooms</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}+ bedrooms</option>
            ))}
          </Select>
        </div>
      </Card>

      {/* ------------------------------------------------------- results */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-bold text-ink-strong">{data ? data.total : "…"}</span> properties found
          {hasFilters && (
            <button onClick={clearFilters} className="ml-3 font-semibold text-brand-700 hover:text-brand-800">
              ✕ Clear filters
            </button>
          )}
        </p>
        <div className="flex items-center gap-3">
          <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className="w-44">
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </Select>
          <div className="flex overflow-hidden rounded-lg border border-zinc-200" role="group" aria-label="View">
            <button
              onClick={() => setView("grid")}
              aria-pressed={view === "grid"}
              className={`px-2.5 py-2 text-sm ${view === "grid" ? "bg-brand-700 text-white" : "bg-white text-ink-muted hover:bg-brand-50"}`}
              aria-label="Grid view"
            >
              <GridIcon />
            </button>
            <button
              onClick={() => setView("list")}
              aria-pressed={view === "list"}
              className={`px-2.5 py-2 text-sm ${view === "list" ? "bg-brand-700 text-white" : "bg-white text-ink-muted hover:bg-brand-50"}`}
              aria-label="List view"
            >
              <ListIcon />
            </button>
          </div>
        </div>
      </div>

      {loading && !data ? (
        <PageLoader label="Searching properties…" />
      ) : data && data.properties.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No properties match your search"
            description="Try a different search or category — new listings are reviewed and published by our legal team every week."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div
          className={`mt-6 gap-5 ${
            view === "grid"
              ? "grid sm:grid-cols-2 lg:grid-cols-3"
              : "grid grid-cols-1"
          }`}
        >
          {data?.properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {/* ---------------------------------------------------- pagination */}
      {data && data.pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void fetchResults(page - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
            Previous
          </Button>
          <span className="px-3 text-sm text-ink-muted">
            Page {page} of {data.pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => void fetchResults(page + 1)}>
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </main>
  );
}

/** LGAs per state, from the prototype geography. */
const LGA_OPTIONS: Record<string, string[]> = {
  Lagos: ["Eti-Osa", "Ibeju-Lekki", "Lagos Island", "Ikeja", "Lagos Mainland", "Kosofe", "Surulere", "Amuwo-Odofin", "Ojo", "Agege"],
  Enugu: ["Enugu North", "Enugu South", "Enugu East", "Nsukka", "Udi", "Oji River"],
};

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}
