"use client";

/** Provider dashboard — listing stats, changes-requested alert, activity. */
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatRelative } from "@/lib/format";
import {
  Button, Card, PageLoader, SectionHeader, StatCard, AlertTriangleIcon,
} from "@/components/platform/ui-bits";

type Summary = {
  total: number;
  active: number;
  pendingReview: number;
  changesRequested: number;
  enquiries: number;
  inProgress: number;
  needsChanges: { id: string; reference: string; title: string; feedback?: string | null } | null;
  recentActivity: Array<{ id: string; at: string; label: string; note?: string | null; case: { id: string; reference: string } }>;
};

export default function ProviderDashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!user) return;
    apiFetch<Summary>("/provider/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [user]);

  if (!user || summary === null) return <PageLoader />;

  const firstName = user.name.split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Welcome, {firstName}</h1>
      {user.organisation && <p className="mt-1 text-ink-muted">{user.organisation}</p>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link href="/app/provider/properties/new" className="rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800">
          Add property
        </Link>
      </div>

      {summary.needsChanges && (
        <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangleIcon className="h-4 w-4" />
            {summary.changesRequested} listing{summary.changesRequested === 1 ? "" : "s"} need{summary.changesRequested === 1 ? "s" : ""} changes
          </p>
          <p className="mt-1 text-sm text-amber-800">
            {summary.needsChanges.reference} — {summary.needsChanges.title}: {summary.needsChanges.feedback}
          </p>
          <Link href={`/app/provider/properties/${summary.needsChanges.id}/edit`} className="mt-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800">
            Review feedback →
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total properties" value={summary.total} href="/app/provider/properties" />
        <StatCard label="Active listings" value={summary.active} href="/app/provider/properties" />
        <StatCard label="Pending review" value={summary.pendingReview} href="/app/provider/properties" />
        <StatCard label="Changes requested" value={summary.changesRequested} href="/app/provider/properties" />
        <StatCard label="Enquiries" value={summary.enquiries} href="/app/provider/cases" />
        <StatCard label="In progress" value={summary.inProgress} href="/app/provider/cases" />
      </div>

      <div className="mt-8">
        <SectionHeader title="Recent activity" />
        {summary.recentActivity.length === 0 ? (
          <Card className="p-6 text-sm text-ink-muted">
            No activity yet. Once enquiries arrive on your listings, updates appear here.
          </Card>
        ) : (
          <Card className="divide-y divide-brand-50">
            {summary.recentActivity.map((activity) => (
              <Link
                key={activity.id}
                href={`/app/provider/cases/${activity.case.id}`}
                className="block px-4 py-3.5 text-sm transition-colors hover:bg-brand-50/40"
              >
                <span className="font-medium text-ink-strong">{activity.case.reference}:</span>{" "}
                <span className="text-ink-soft">{activity.note ?? activity.label}</span>
                <span className="ml-2 text-xs text-ink-muted">{formatRelative(activity.at)}</span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
