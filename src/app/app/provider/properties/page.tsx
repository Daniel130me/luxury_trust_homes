"use client";

/** Provider properties — status filter tabs + listing cards (own listings). */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { PROPERTY_STATUS_LABELS, STATUS_TONES, formatNaira } from "@/lib/format";
import { Button, Card, EmptyState, PageLoader, StatusBadge } from "@/components/platform/ui-bits";

type ProviderProperty = {
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
  feedback?: string | null;
  updatedAt: string;
  images?: Array<{ url: string; label: string }>;
};

const TABS = [
  { value: "", label: "All" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "APPROVED", label: "Approved" },
  { value: "CHANGES_REQUESTED", label: "Changes requested" },
  { value: "REJECTED", label: "Not approved" },
  { value: "DRAFT", label: "Drafts" },
];

export default function ProviderPropertiesPage() {
  const [properties, setProperties] = useState<ProviderProperty[] | null>(null);
  const [status, setStatus] = useState("");

  const load = useCallback(async (statusFilter: string) => {
    const data = await apiFetch<{ properties: ProviderProperty[] }>("/provider/properties", {
      query: { status: statusFilter || undefined },
    }).catch(() => null);
    setProperties(data?.properties ?? []);
  }, []);

  useEffect(() => {
    void load(status);
  }, [load, status]);

  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My properties</h1>
          <p className="mt-1.5 text-ink-muted">
            Listings are reviewed by our legal team before they appear publicly.
          </p>
        </div>
        <Link href="/app/provider/properties/new">
          <Button>Add property</Button>
        </Link>
      </div>

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

      {properties === null ? (
        <PageLoader />
      ) : properties.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No properties here yet"
            description="Add your first listing — our legal team reviews and publishes it."
            action={
              <Link href="/app/provider/properties/new">
                <Button>Add property</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Card key={property.id} className="overflow-hidden">
              <Link href={`/app/provider/properties/${property.id}`} className="block">
                <div className="relative aspect-[4/3] bg-slate-100">
                  {property.images?.[0] ? (
                     
                    <img src={property.images[0].url} alt={property.images[0].label} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-full place-items-center text-sm text-ink-muted">No photograph yet</div>
                  )}
                  <span className="absolute left-3 top-3">
                    <StatusBadge status={property.status} label={PROPERTY_STATUS_LABELS[property.status]} />
                  </span>
                </div>
              </Link>
              <div className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  {property.area}, {property.lga}, {property.state}
                </p>
                <h2 className="mt-1 font-semibold text-ink-strong">{property.title}</h2>
                <p className="mt-1 text-sm font-bold text-brand-700">
                  {formatNaira(property.price)}
                  {property.listingType === "RENT" && <span className="text-xs font-medium text-ink-muted"> / year</span>}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {property.reference} · {property.availability === "AVAILABLE" ? "Available" : property.availability === "UNDER_OFFER" ? "Under offer" : "Unavailable"}
                </p>
                {property.feedback && property.status !== "APPROVED" && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{property.feedback}</p>
                )}
                <div className="mt-3 flex gap-2 border-t border-brand-50 pt-3">
                  <Link href={`/app/provider/properties/${property.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">View</Button>
                  </Link>
                  <Link href={`/app/provider/properties/${property.id}/edit`} className="flex-1">
                    <Button size="sm" className="w-full">Edit</Button>
                  </Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
