"use client";

/** Staff listings review queue — status tabs, search, review actions. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PROPERTY_STATUS_LABELS, formatDateTime, formatNaira } from "@/lib/format";
import {
  Button, Card, EmptyState, Input, PageLoader, Select, StatusBadge, SearchIcon, ChevronLeftIcon, ChevronRightIcon,
} from "@/components/platform/ui-bits";

type StaffListing = {
  id: string;
  reference: string;
  title: string;
  category: string;
  listingType: string;
  price: number;
  state: string;
  lga: string;
  area: string;
  status: string;
  availability: string;
  createdAt: string;
  images?: Array<{ url: string; label: string }>;
  provider?: { id: string; name: string; organisation?: string | null };
};

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "APPROVED", label: "Approved" },
  { value: "CHANGES_REQUESTED", label: "Changes requested" },
  { value: "REJECTED", label: "Not approved" },
];

export default function StaffListingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canModerate = user?.role === "LAWYER";

  const [listings, setListings] = useState<StaffListing[] | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("status") ?? "";
    if (initial) setStatus(initial);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (targetPage: number) => {
      const data = await apiFetch<{ properties: StaffListing[]; pages: number; total: number }>(
        "/staff/listings",
        { query: { status: status || undefined, search: debouncedSearch || undefined, page: targetPage, pageSize: 12 } },
      ).catch(() => null);
      if (data) {
        setListings(data.properties);
        setPages(data.pages);
        setTotal(data.total);
        setPage(targetPage);
      } else {
        setListings([]);
      }
    },
    [status, debouncedSearch],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Listings</h1>
      <p className="mt-1.5 text-ink-muted">
        {canModerate
          ? "Review provider submissions before they go live."
          : "Every listing on the platform, including review status."}
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Status filter">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              status === tab.value ? "bg-brand-800 text-white" : "bg-white text-ink-soft ring-1 ring-brand-200 hover:bg-brand-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative mt-4 max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, reference or area"
          aria-label="Search listings"
          className="pl-10"
        />
      </div>

      {listings === null ? (
        <PageLoader />
      ) : listings.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No listings found" description="Try a different status or search term." />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Listing</th>
                  <th className="px-4 py-3 font-semibold">Provider</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {listings.map((listing) => (
                  <tr
                    key={listing.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    onClick={() => router.push(`/app/staff/listings/${listing.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {listing.images?.[0] && (
                           
                          <img src={listing.images[0].url} alt="" className="h-10 w-14 rounded-md object-cover" loading="lazy" />
                        )}
                        <div>
                          <p className="font-medium text-ink-strong">{listing.title}</p>
                          <p className="text-xs text-ink-muted">
                            {listing.reference} · {listing.area}, {listing.lga}, {listing.state}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {listing.provider?.name}
                      {listing.provider?.organisation && (
                        <span className="block text-xs text-ink-muted">{listing.provider.organisation}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-strong">
                      {formatNaira(listing.price)}
                      {listing.listingType === "RENT" && <span className="text-xs font-normal text-ink-muted"> / yr</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDateTime(listing.createdAt).split(",")[0]}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={listing.status} label={PROPERTY_STATUS_LABELS[listing.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm text-ink-muted">Page {page} of {pages} · {total} listings</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => void load(page + 1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
