"use client";

/**
 * Property card used on the home page, catalogue and saved list.
 * Markup and classes are lifted 1:1 from the prototype's rendered card:
 * 16/10 cover with brand-50 placeholder, wine listing chip, round save
 * button, gold category eyebrow, semibold title, pin location row,
 * bed/bath/size feature icons, price + reference footer.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { CATEGORY_LABELS, AVAILABILITY_LABELS, formatNaira } from "@/lib/format";
import { BedIcon, BathIcon, AreaIcon, HeartIcon } from "./ui-bits";
import { useToast } from "@/hooks/use-toast";

export type PropertyCardData = {
  id: string;
  reference: string;
  title: string;
  category: string;
  listingType: string;
  price: number;
  state: string;
  lga: string;
  area: string;
  region?: string | null;
  beds?: number | null;
  baths?: number | null;
  sqm?: number | null;
  availability?: string;
  images?: Array<{ url: string; label: string }>;
};

export function PropertyCard({
  property,
  initiallySaved = false,
  onUnsaved,
}: {
  property: PropertyCardData;
  initiallySaved?: boolean;
  onUnsaved?: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saved, setSaved] = useState(initiallySaved);
  const cover = property.images?.[0];

  async function toggleSave(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (saved) {
      await apiFetch(`/saved/${property.id}`, { method: "DELETE" }).catch(() => undefined);
      setSaved(false);
      onUnsaved?.();
      return;
    }
    try {
      await apiFetch("/saved", { method: "POST", body: { propertyId: property.id } });
      setSaved(true);
      toast({ title: "Property saved", description: "Find it anytime under Saved properties." });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : "Sign in to save properties",
        description: err instanceof Error ? undefined : "Create a free account to keep track of homes you like.",
        variant: "destructive",
      });
      if (!(err instanceof Error)) router.push("/login?next=/properties");
    }
  }

  return (
    <Link
      href={`/properties/${property.reference}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-brand-100/80 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-brand-50">
        {cover ? (
          <img
            src={cover.url}
            alt={cover.label || property.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-muted">No photograph yet</div>
        )}
        <span className="absolute left-3 top-3 rounded-md px-2 py-1 text-xs font-semibold shadow-sm bg-brand-900 text-white">
          {property.listingType === "SALE" ? "For Sale" : "For Rent"}
        </span>
        {property.availability === "UNDER_OFFER" && (
          <span className="absolute left-3 top-11 rounded-md px-2 py-1 text-xs font-semibold shadow-sm bg-gold-400 text-brand-950">
            {AVAILABILITY_LABELS.UNDER_OFFER}
          </span>
        )}
        <span className="absolute right-3 top-3">
          <button
            onClick={toggleSave}
            aria-label={saved ? "Remove from saved properties" : "Save property"}
            aria-pressed={saved}
            title={saved ? "Remove from saved properties" : "Save property"}
            className="rounded-full bg-white/95 p-2 shadow-sm ring-1 ring-black/5 transition hover:scale-105"
          >
            <HeartIcon className={`h-4 w-4 ${saved ? "text-brand-700" : "text-ink-soft"}`} filled={saved} />
          </button>
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-gold-600">
          {CATEGORY_LABELS[property.category] ?? property.category}
          {property.region ? (
            <span className="text-ink-muted"> · {property.state} {property.region}</span>
          ) : null}
        </p>
        <h3 className="line-clamp-2 font-semibold text-ink-strong group-hover:text-brand-700">{property.title}</h3>
        <p className="flex items-center gap-1 text-sm text-ink-muted">
          {property.area}, {property.lga}, {property.state}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          {property.beds != null && (
            <span className="inline-flex items-center gap-1.5">
              <BedIcon className="h-4 w-4 text-brand-400" /> {property.beds} beds
            </span>
          )}
          {property.baths != null && (
            <span className="inline-flex items-center gap-1.5">
              <BathIcon className="h-4 w-4 text-brand-400" /> {property.baths} baths
            </span>
          )}
          {property.sqm != null && (
            <span className="inline-flex items-center gap-1.5">
              <AreaIcon className="h-4 w-4 text-brand-400" /> {property.sqm.toLocaleString("en-NG")} sqm
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          <p className="text-lg font-semibold text-ink-strong">
            {formatNaira(property.price)}
            {property.listingType === "RENT" && <span className="text-xs font-medium text-ink-muted"> / year</span>}
          </p>
          <span className="text-xs text-ink-muted">{property.reference}</span>
        </div>
      </div>
    </Link>
  );
}
