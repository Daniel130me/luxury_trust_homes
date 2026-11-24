"use client";

/** Staff (admin) listing edit — full field edit of any listing at any time.
 *  Photos and video stay provider-managed (PropertyForm hides them here). */
import { useParams } from "next/navigation";
import { PropertyForm } from "@/components/platform/property-form";

export default function StaffEditListingPage() {
  const params = useParams<{ id: string }>();
  return <PropertyForm mode="edit" propertyId={params.id} staffMode />;
}
