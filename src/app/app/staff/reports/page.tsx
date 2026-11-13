"use client";

/** Staff reports — listing mix, case pipeline, payment outcomes, trend. */
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { CASE_STATUS_LABELS, CATEGORY_LABELS, PAYMENT_STATUS_LABELS, formatNaira } from "@/lib/format";
import { Card, PageLoader, SectionHeader } from "@/components/platform/ui-bits";

type Reports = {
  listingsByCategory: Array<{ category: string; count: number }>;
  casesByStatus: Array<{ status: string; count: number }>;
  paymentsByStatus: Array<{ status: string; count: number; amount: number }>;
  usersByRole: Array<{ role: string; count: number }>;
  paymentsTrend: Array<{ month: string; amount: number }>;
};

const ROLE_LABELS: Record<string, string> = {
  LAWYER: "Lawyers",
  SUPPORT: "Support staff",
  PROVIDER: "Providers",
  CLIENT: "Buyers / Renters",
};

export default function StaffReportsPage() {
  const [reports, setReports] = useState<Reports | null>(null);

  useEffect(() => {
    apiFetch<Reports>("/reports")
      .then(setReports)
      .catch(() => setReports(null));
  }, []);

  if (!reports) return <PageLoader />;

  const maxCategory = Math.max(1, ...reports.listingsByCategory.map((r) => r.count));
  const maxStatus = Math.max(1, ...reports.casesByStatus.map((r) => r.count));
  const maxTrend = Math.max(1, ...reports.paymentsTrend.map((r) => r.amount));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="font-serif text-3xl text-ink-strong">Reports</h1>
      <p className="mt-1.5 text-ink-muted">Platform-wide operational overview.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeader title="Listings by type" />
          <ul className="mt-2 space-y-2.5">
            {reports.listingsByCategory.map((row) => (
              <li key={row.category} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">{CATEGORY_LABELS[row.category] ?? row.category}</span>
                  <span className="font-semibold text-ink-strong">{row.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-brand-600" style={{ width: `${(row.count / maxCategory) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Matters by status" />
          <ul className="mt-2 space-y-2.5">
            {reports.casesByStatus.map((row) => (
              <li key={row.status} className="text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-soft">{CASE_STATUS_LABELS[row.status] ?? row.status}</span>
                  <span className="font-semibold text-ink-strong">{row.count}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-zinc-100">
                  <div className="h-2 rounded-full bg-gold-500" style={{ width: `${(row.count / maxStatus) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Payments by outcome" />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted">
                <th className="pb-2 font-semibold">Status</th>
                <th className="pb-2 font-semibold">Count</th>
                <th className="pb-2 text-right font-semibold">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {reports.paymentsByStatus.map((row) => (
                <tr key={row.status}>
                  <td className="py-2 text-ink-soft">{PAYMENT_STATUS_LABELS[row.status] ?? row.status}</td>
                  <td className="py-2 font-semibold text-ink-strong">{row.count}</td>
                  <td className="py-2 text-right font-medium text-ink-strong">{formatNaira(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-5">
          <SectionHeader title="Users by role" />
          <ul className="mt-2 space-y-2 text-sm">
            {reports.usersByRole.map((row) => (
              <li key={row.role} className="flex items-center justify-between">
                <span className="text-ink-soft">{ROLE_LABELS[row.role] ?? row.role}</span>
                <span className="font-semibold text-ink-strong">{row.count}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {reports.paymentsTrend.length > 0 && (
        <Card className="mt-6 p-5">
          <SectionHeader title="Successful payments by month" description="Settled transactions processed through Flutterwave." />
          <div className="mt-4 flex items-end gap-4" style={{ height: 180 }} role="img" aria-label="Monthly payments chart">
            {reports.paymentsTrend.map((point) => (
              <div key={point.month} className="flex min-w-12 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-ink-muted">{formatNaira(point.amount)}</span>
                <div
                  className="w-full rounded-t-md bg-brand-600"
                  style={{ height: `${Math.max(6, (point.amount / maxTrend) * 130)}px` }}
                />
                <span className="text-[10px] text-ink-muted">{point.month}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
