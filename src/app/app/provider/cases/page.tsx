"use client";

/** Provider cases — enquiries & cases on the provider's listings. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CASE_STATUS_LABELS, formatDate } from "@/lib/format";
import { Card, EmptyState, PageLoader, StatusBadge } from "@/components/platform/ui-bits";

type ProviderCase = {
  id: string;
  reference: string;
  status: string;
  openedAt?: string | null;
  enquiry: { reference: string; purpose: string };
  property: { id: string; reference: string; title: string; images?: Array<{ url: string; label: string }> };
  client: { name: string };
};

export default function ProviderCasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<ProviderCase[] | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ cases: ProviderCase[] }>("/provider/cases").catch(() => null);
    setCases(data?.cases ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-serif text-3xl text-ink-strong">Enquiries & cases</h1>
      <p className="mt-1.5 text-ink-muted">
        Every enquiry on your listings is handled by an ELVICTORIA lawyer.
      </p>

      {cases === null ? (
        <PageLoader />
      ) : cases.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No enquiries yet"
            description="When a buyer or renter enquires about one of your listings, the case appears here."
          />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Buyer / Renter</th>
                  <th className="px-4 py-3 font-semibold">Opened</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cases.map((kase) => (
                  <tr
                    key={kase.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    onClick={() => router.push(`/app/provider/cases/${kase.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-strong">{kase.reference}</p>
                      <p className="text-xs text-ink-muted">{kase.enquiry.reference}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {kase.property.images?.[0] && (
                           
                          <img src={kase.property.images[0].url} alt="" className="h-10 w-14 rounded-md object-cover" loading="lazy" />
                        )}
                        <span className="font-medium text-ink-strong">{kase.property.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{kase.client.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{kase.openedAt ? formatDate(kase.openedAt) : "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={kase.status} label={CASE_STATUS_LABELS[kase.status]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
