"use client";

/** Client dashboard — stats, recent case updates and quick actions. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatRelative, CASE_STATUS_LABELS } from "@/lib/format";
import {
  Card, EnvelopeIcon, CheckCircleIcon, ClockIcon, CreditCardIcon, PageLoader,
  SectionHeader, StatCard,
} from "@/components/platform/ui-bits";

type Summary = {
  activeEnquiries: number;
  ongoingTransactions: number;
  completed: number;
  pendingPayments: number;
  unread: number;
  recentUpdates: Array<{
    id: string;
    at: string;
    note?: string | null;
    label: string;
    case: { id: string; enquiryId?: string; reference: string; status: string; property: { title: string; images?: Array<{ url: string; label: string }> } };
  }>;
};

export default function ClientDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<Summary>("/client/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [user]);

  if (!user || summary === null) return <PageLoader />;

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {firstName}</h1>
      <p className="mt-1.5 text-ink-muted">
        Follow your enquiries and transactions, managed by the Elvictoria legal team.
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/app/client/enquiries" className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800">
          My enquiries
        </Link>
        <Link href="/properties" className="rounded-lg border border-brand-700 px-4 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50">
          Browse properties
        </Link>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active enquiries" value={summary.activeEnquiries} icon={<EnvelopeIcon className="h-5 w-5" />} href="/app/client/enquiries" />
        <StatCard label="Ongoing transactions" value={summary.ongoingTransactions} icon={<ClockIcon className="h-5 w-5" />} href="/app/client/enquiries" />
        <StatCard label="Completed" value={summary.completed} icon={<CheckCircleIcon className="h-5 w-5" />} />
        <StatCard label="Pending payments" value={summary.pendingPayments} icon={<CreditCardIcon className="h-5 w-5" />} href="/app/client/payments" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Recent updates" />
          {summary.recentUpdates.length === 0 ? (
            <Card className="p-6 text-sm text-ink-muted">
              No updates yet. Submit an enquiry and your lawyer will keep you informed here.
            </Card>
          ) : (
            <Card className="divide-y divide-brand-50">
              {summary.recentUpdates.map((update) => (
                <Link
                  key={update.id}
                  href={`/app/client/enquiries/${update.case.enquiryId ?? update.case.id}`}
                  className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-brand-50/40"
                >
                  {update.case.property.images?.[0] && (
                     
                    <img
                      src={update.case.property.images[0].url}
                      alt={update.case.property.images[0].label}
                      className="h-14 w-20 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-strong">{update.case.property.title}</p>
                    <p className="truncate text-sm text-ink-muted">{update.note ?? update.label}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-ink-muted">{formatRelative(update.at)}</p>
                    <p className="text-xs font-semibold text-brand-700">{CASE_STATUS_LABELS[update.case.status]}</p>
                  </div>
                </Link>
              ))}
            </Card>
          )}
        </section>

        <section>
          <SectionHeader title="Notifications" action={<Link href="/app/notifications" className="text-sm font-semibold text-brand-700 hover:text-brand-800">View all</Link>} />
          <Card className="p-6 text-sm text-ink-muted">
            {summary.unread > 0
              ? `You have ${summary.unread} unread notification${summary.unread === 1 ? "" : "s"}.`
              : "You are all caught up."}
          </Card>
        </section>
      </div>
    </div>
  );
}
