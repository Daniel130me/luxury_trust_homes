"use client";

/** Client enquiries list — Active / Closed tabs (prototype layout). */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDate, CASE_STATUS_LABELS } from "@/lib/format";
import { Button, Card, EmptyState, PageLoader, StatusBadge } from "@/components/platform/ui-bits";

type EnquiryRow = {
  id: string;
  reference: string;
  status: string;
  purpose: string;
  submittedAt: string;
  property: { id: string; reference: string; title: string; images?: Array<{ url: string; label: string }> };
  case?: { id: string; reference: string } | null;
};

export default function ClientEnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<EnquiryRow[] | null>(null);
  const [tab, setTab] = useState<"active" | "closed">("active");

  const load = useCallback(async () => {
    const data = await apiFetch<{ enquiries: EnquiryRow[] }>("/enquiries/mine").catch(() => null);
    setEnquiries(data?.enquiries ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = (enquiries ?? []).filter((e) =>
    tab === "closed"
      ? ["COMPLETED", "CANCELLED"].includes(e.status)
      : !["COMPLETED", "CANCELLED"].includes(e.status),
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My enquiries</h1>
      <p className="mt-1.5 text-ink-muted">
        Every enquiry you submit is handled by a lawyer from the Elvictoria legal team.
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex rounded-lg bg-brand-50 p-1" role="tablist" aria-label="Enquiry state">
          {(["active", "closed"] as const).map((option) => (
            <button
              key={option}
              role="tab"
              aria-selected={tab === option}
              onClick={() => setTab(option)}
              className={`rounded-md px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                tab === option ? "bg-brand-800 text-white" : "text-brand-700 hover:bg-brand-100"
              }`}
            >
              {option} {(enquiries ?? []).filter((e) => (option === "closed" ? ["COMPLETED", "CANCELLED"].includes(e.status) : !["COMPLETED", "CANCELLED"].includes(e.status))).length}
            </button>
          ))}
        </div>
        <Link href="/properties">
          <Button variant="outline" size="sm">Browse properties</Button>
        </Link>
      </div>

      {enquiries === null ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={tab === "active" ? "No active enquiries" : "No closed enquiries"}
            description={tab === "active" ? "Enquire about any reviewed listing and your lawyer takes it from there." : undefined}
            action={tab === "active" ? (
              <Link href="/properties"><Button>Browse properties</Button></Link>
            ) : undefined}
          />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {rows.map((enquiry) => (
                  <tr
                    key={enquiry.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    onClick={() => router.push(`/app/client/enquiries/${enquiry.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {enquiry.property.images?.[0] && (
                           
                          <img src={enquiry.property.images[0].url} alt="" className="h-10 w-14 rounded-md object-cover" loading="lazy" />
                        )}
                        <span className="font-medium text-ink-strong">{enquiry.property.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-ink-strong">{enquiry.case?.reference ?? enquiry.reference}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(enquiry.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={enquiry.status} label={CASE_STATUS_LABELS[enquiry.status]} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-brand-700">View</span>
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
