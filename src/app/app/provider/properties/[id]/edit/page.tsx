"use client";

import { useParams } from "next/navigation";
import { PropertyForm } from "@/components/platform/property-form";

export default function EditPropertyPage() {
  const params = useParams<{ id: string }>();
  return <PropertyForm mode="edit" propertyId={params.id} />;
}
