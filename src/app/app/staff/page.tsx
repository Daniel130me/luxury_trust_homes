"use client";

/** Staff dashboard — stat cards, attention queue and matters by status. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CASE_STATUS_LABELS, formatNairaCompact, formatDate } from "@/lib/format";
import {
  Card, PageLoader, StatCard, BuildingIcon, FileIcon, CheckCircleIcon, UsersIcon,
  EnvelopeIcon, BriefcaseIcon, AlertTriangleIcon, ClockIcon, CreditCardIcon,
} from "@/components/platform/ui-bits";

type StaffSummary = {
  listings: { total: number; pendingReview: number; approved: number; activePublic: number };
  users: number;
  enquiriesTotal: number;
  openCases: number;
  completedCases: number;
  requiringAttention: number;
  pendingPayments: { count: number; amount: number };
  successfulPayments: { count: number; amount: number };
  mattersByStatus: Record<string, number>;
  unassignedCount: number;
  escalatedCount: number;
  attentionList: Array<{
    id: string;
    reference: string;
    status: string;
    submittedAt: string;
    property: { reference: string; title: string };
    client: { name: string };
    escalations?: Array<{ note: string }>;
  }>;
};

export default function StaffDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<StaffSummary | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<StaffSummary>("/staff/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [user]);

  if (!user || summary === null) return <PageLoader />;

  const firstName = user.name.split(" ")[0];
  const mattersByStatus = Object.entries(summary.mattersByStatus);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Good day, {firstName}</h1>
      <p className="mt-1.5 text-ink-muted">
        {summary.openCases} open case{summary.openCases === 1 ? "" : "s"}. {summary.requiringAttention} matter{summary.requiringAttention === 1 ? "" : "s"} need{summary.requiringAttention === 1 ? "s" : ""} attention across the platform.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Total listings" value={summary.listings.total} hint="Excludes provider drafts" icon={<BuildingIcon className="h-5 w-5" />} href="/app/staff/listings" />
        <StatCard label="Pending approvals" value={summary.listings.pendingReview} icon={<FileIcon className="h-5 w-5" />} href="/app/staff/listings?status=PENDING_REVIEW" />
        <StatCard label="Active public listings" value={summary.listings.activePublic} icon={<CheckCircleIcon className="h-5 w-5" />} href="/app/staff/listings?status=APPROVED" />
        <StatCard label="Registered users" value={summary.users} icon={<UsersIcon className="h-5 w-5" />} href="/app/staff/users" />
        <StatCard label="Total enquiries" value={summary.enquiriesTotal} icon={<EnvelopeIcon className="h-5 w-5" />} href="/app/staff/enquiries" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Open cases" value={summary.openCases} icon={<BriefcaseIcon className="h-5 w-5" />} href="/app/staff/cases" />
        <StatCard label="Requiring attention" value={summary.requiringAttention} icon={<AlertTriangleIcon className="h-5 w-5" />} href="/app/staff/enquiries?view=attention" />
        <StatCard label="Completed cases" value={summary.completedCases} icon={<CheckCircleIcon className="h-5 w-5" />} href="/app/staff/cases?view=closed" />
        <StatCard
          label="Pending payments"
          value={summary.pendingPayments.count}
          hint={formatNairaCompact(summary.pendingPayments.amount)}
          icon={<ClockIcon className="h-5 w-5" />}
          href="/app/staff/payments?status=outstanding"
        />
        <StatCard
          label="Successful payments"
          value={summary.successfulPayments.count}
          hint={formatNairaCompact(summary.successfulPayments.amount)}
          icon={<CreditCardIcon className="h-5 w-5" />}
          href="/app/staff/payments?status=SUCCESSFUL"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink-strong">Enquiries requiring attention</h2>
              <p className="text-sm text-ink-muted">Unassigned, escalated, awaiting a reply or awaiting payment confirmation.</p>
            </div>
            <Link href="/app/staff/enquiries" className="text-sm font-semibold text-brand-700 hover:text-brand-800">
              View all
            </Link>
          </div>
          {summary.attentionList.length === 0 ? (
            <Card className="p-6 text-sm text-ink-muted">Nothing needs attention right now.</Card>
          ) : (
            <Card className="divide-y divide-brand-50">
              {summary.attentionList.map((enquiry) => (
                <Link
                  key={enquiry.id}
                  href={`/app/staff/matters/${enquiry.id}`}
                  className="block px-4 py-3.5 transition-colors hover:bg-brand-50/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-ink-strong">
                      <span className="text-ink-muted">{enquiry.reference}</span> — {enquiry.property.title}
                    </p>
                    <span className="text-xs text-ink-muted">{formatDate(enquiry.submittedAt)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {enquiry.client.name} · {CASE_STATUS_LABELS[enquiry.status]}
                    {enquiry.escalations?.[0] && (
                      <span className="ml-2 font-semibold text-amber-700">Escalated: {enquiry.escalations[0].note}</span>
                    )}
                  </p>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-ink-strong">Matters by status</h2>
          </div>
          <Card className="p-5">
            {mattersByStatus.length === 0 ? (
              <p className="text-sm text-ink-muted">No cases yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {mattersByStatus
                  .sort((a, b) => (CASE_STATUS_LABELS[a[0]] ?? "").localeCompare(CASE_STATUS_LABELS[b[0]] ?? ""))
                  .map(([status, count]) => (
                    <li key={status} className="flex items-center justify-between text-sm">
                      <span className="text-ink-soft">{CASE_STATUS_LABELS[status] ?? status}</span>
                      <span className="font-semibold text-ink-strong">{count}</span>
                    </li>
                  ))}
              </ul>
            )}
            <Link href="/app/staff/cases" className="mt-4 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800">
              Open the case board →
            </Link>
          </Card>
        </section>
      </div>
    </div>
  );
}
