"use client";

/**
 * Property types are admin-managed (see /properties/types). This hook
 * loads the active list once per mount for forms and search filters.
 */
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export type PropertyType = { id: string; name: string; active: boolean; sortOrder: number };

export function usePropertyTypes(): PropertyType[] | null {
  const [types, setTypes] = useState<PropertyType[] | null>(null);

  useEffect(() => {
    apiFetch<{ types: PropertyType[] }>("/properties/types")
      .then((d) => setTypes(d.types))
      .catch(() => setTypes([]));
  }, []);

  return types;
}
