"use client";

/**
 * Property card used on the home page, catalogue and saved list.
 * Visual structure matches the prototype card: cover photo, listing badge,
 * save button, category · region eyebrow, title, location, bed/bath/size
 * row, price and reference.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { CATEGORY_LABELS, AVAILABILITY_LABELS, formatNaira } from "@/lib/format";
import { Badge, HeartIcon } from "./ui-bits";
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
      className="group block overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)] transition-shadow hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-100">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt={cover.label || property.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-ink-muted">No photograph yet</div>
        )}
        <span className="absolute left-3 top-3">
          <Badge tone="bg-brand-700/90 text-white">
            {property.listingType === "SALE" ? "For Sale" : "For Rent"}
          </Badge>
        </span>
        {property.availability === "UNDER_OFFER" && (
          <span className="absolute left-3 top-11">
            <Badge tone="bg-amber-500/90 text-white">{AVAILABILITY_LABELS.UNDER_OFFER}</Badge>
          </span>
        )}
        <button
          onClick={toggleSave}
          aria-label={saved ? "Remove from saved properties" : "Save property"}
          aria-pressed={saved}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-ink-soft shadow-sm transition-colors hover:text-brand-700"
        >
          <HeartIcon className="h-4.5 w-4.5" filled={saved} />
        </button>
      </div>

      <div className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
          {CATEGORY_LABELS[property.category] ?? property.category}
          {property.region ? ` · ${property.state} ${property.region}` : ""}
        </p>
        <h3 className="mt-1 font-serif text-lg leading-snug text-ink-strong group-hover:text-brand-700">
          {property.title}
        </h3>
        <p className="mt-0.5 text-sm text-ink-muted">
          {property.area}, {property.lga}, {property.state}
        </p>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {property.beds != null && <span>{property.beds} beds</span>}
          {property.baths != null && <span>{property.baths} baths</span>}
          {property.sqm != null && <span>{property.sqm.toLocaleString("en-NG")} sqm</span>}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
          <p className="text-base font-bold text-brand-700">{formatNaira(property.price)}
            {property.listingType === "RENT" && <span className="text-xs font-medium text-ink-muted"> / year</span>}
          </p>
          <p className="text-xs text-ink-muted">{property.reference}</p>
        </div>
      </div>
    </Link>
  );
}
