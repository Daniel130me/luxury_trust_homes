"use client";

/** Provider property detail — own listing view with status timeline. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CATEGORY_LABELS, PROPERTY_STATUS_LABELS, AVAILABILITY_LABELS, formatDateTime, formatNaira } from "@/lib/format";
import { Button, Card, EmptyState, PageLoader, StatusBadge, ChevronLeftIcon } from "@/components/platform/ui-bits";

type PropertyDetail = {
  id: string;
  reference: string;
  title: string;
  category: string;
  listingType: string;
  price: number;
  state: string;
  region?: string | null;
  lga: string;
  area: string;
  address: string;
  beds?: number | null;
  baths?: number | null;
  toilets?: number | null;
  sqm?: number | null;
  parking?: number | null;
  furnishing?: string | null;
  description: string;
  features: string[];
  status: string;
  availability: string;
  feedback?: string | null;
  cautionDeposit?: number | null;
  serviceCharge?: number | null;
  images: Array<{ id: string; url: string; label: string }>;
  history: Array<{ id: string; at: string; action: string; note?: string | null; actor?: { name?: string } | null }>;
  updatedAt: string;
};

export default function ProviderPropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    apiFetch<{ property: PropertyDetail }>(`/provider/properties/${id}`)
      .then((d) => setProperty(d.property))
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <EmptyState title="Property not found" description="This listing may have been removed." />
      </div>
    );
  }
  if (!property) return <PageLoader />;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/provider/properties" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        My properties
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={property.status} label={PROPERTY_STATUS_LABELS[property.status]} />
        <p className="text-sm text-ink-muted">{property.reference}</p>
      </div>
      <h1 className="mt-1 font-serif text-3xl text-ink-strong">{property.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {CATEGORY_LABELS[property.category]} · {property.area}, {property.lga}, {property.state}
      </p>

      {property.feedback && property.status !== "APPROVED" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Feedback from the legal team:</p>
          <p className="mt-1">{property.feedback}</p>
        </div>
      )}

      {property.images.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {property.images.map((image, index) => (
            <div key={image.id} className="relative">
              { }
              <img src={image.url} alt={image.label} className="aspect-[4/3] w-full rounded-lg object-cover" loading="lazy" />
              {index === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-brand-700 px-2 py-0.5 text-[10px] font-bold text-white">Cover</span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink-strong">About this property</h2>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{property.description}</p>
          {property.features.length > 0 && (
            <>
              <h3 className="mt-4 font-semibold text-ink-strong">Features</h3>
              <ul className="mt-2 grid grid-cols-2 gap-1.5 text-sm text-ink-soft">
                {property.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>
            </>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Detail term="Availability" value={AVAILABILITY_LABELS[property.availability]} />
            <Detail term="Listing" value={property.listingType === "SALE" ? "For sale" : "For rent"} />
            {property.beds != null && <Detail term="Bedrooms" value={String(property.beds)} />}
            {property.baths != null && <Detail term="Bathrooms" value={String(property.baths)} />}
            {property.sqm != null && <Detail term="Size" value={`${property.sqm.toLocaleString("en-NG")} sqm`} />}
            {property.serviceCharge != null && <Detail term="Service charge" value={formatNaira(property.serviceCharge)} />}
            {property.cautionDeposit != null && <Detail term="Caution deposit" value={formatNaira(property.cautionDeposit)} />}
            <Detail term="Updated" value={formatDateTime(property.updatedAt)} />
          </dl>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <p className="text-sm text-ink-muted">Asking price</p>
            <p className="mt-1 text-xl font-bold text-ink-strong">{formatNaira(property.price)}</p>
            <div className="mt-4 flex gap-2">
              <Link href={`/app/provider/properties/${property.id}/edit`} className="flex-1">
                <Button size="sm" className="w-full">Edit</Button>
              </Link>
            </div>
            {property.status === "APPROVED" && (
              <p className="mt-3 text-xs leading-relaxed text-ink-muted">
                Editing an approved listing sends it back to the legal team for review.
              </p>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-ink-strong">History</h3>
            <ol className="mt-3 space-y-2.5">
              {property.history.map((entry) => (
                <li key={entry.id} className="text-xs text-ink-muted">
                  <p className="font-medium capitalize text-ink-strong">{entry.action.replace(/_/g, " ")}</p>
                  <p>{formatDateTime(entry.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Detail({ term, value }: { term: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-muted">{term}</dt>
      <dd className="mt-0.5 font-medium text-ink-strong">{value}</dd>
    </div>
  );
}
