"use client";

/** Saved properties (shared /app/saved) — grid of the user's saved listings. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth, workspaceHome } from "@/lib/auth";
import { PropertyCard, type PropertyCardData } from "@/components/platform/property-card";
import { Button, EmptyState, PageLoader, SectionHeader } from "@/components/platform/ui-bits";

export default function SavedPage() {
  const { user, loading } = useAuth();
  const [properties, setProperties] = useState<PropertyCardData[] | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<{ properties: PropertyCardData[] }>("/saved")
      .then((d) => setProperties(d.properties))
      .catch(() => setProperties([]));
  }, [user]);

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeader title="Saved properties" description="Properties you have saved while browsing." />
      {properties === null ? (
        <PageLoader />
      ) : properties.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          description="Tap the heart on any property to keep it here for later."
          action={
            <Link href="/properties">
              <Button>Browse properties</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertyCard
              key={property.id}
              property={property}
              initiallySaved
              onUnsaved={() => setProperties((p) => p?.filter((x) => x.id !== property.id) ?? [])}
            />
          ))}
        </div>
      )}
    </div>
  );
}
