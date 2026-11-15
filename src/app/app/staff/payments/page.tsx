"use client";

/**
 * Staff payments — summary cards (Received / Awaiting / Transfers to
 * confirm / Failed), status tabs, search and the full request table.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PAYMENT_STATUS_LABELS, formatDateTime, formatNaira, formatNairaCompact } from "@/lib/format";
import {
  Button, Card, EmptyState, Input, PageLoader, StatusBadge, SearchIcon, ChevronLeftIcon, ChevronRightIcon,
} from "@/components/platform/ui-bits";

type PaymentRow = {
  id: string;
  reference: string;
  amount: number;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  case?: { id: string; reference: string } | null;
  payer?: { id: string; name: string } | null;
  requestedBy?: { id: string; name: string } | null;
};

type Summary = {
  received: { count: number; amount: number };
  awaiting: { count: number; amount: number };
  transfersToConfirm: { count: number; amount: number };
  failed: { count: number; amount: number };
  outstanding: { count: number; amount: number };
};

const TABS = [
  { value: "", label: "All" },
  { value: "OUTSTANDING", label: "Outstanding" },
  { value: "AWAITING_PAYMENT", label: "Awaiting Payment" },
  { value: "PENDING_CONFIRMATION", label: "Pending Confirmation" },
  { value: "SUCCESSFUL", label: "Successful" },
  { value: "FAILED", label: "Failed" },
];

export default function StaffPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialStatus = params.get("status");
    if (initialStatus) setStatus(initialStatus);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (targetPage: number) => {
      const data = await apiFetch<{ payments: PaymentRow[]; pages: number; summary: Summary }>(
        "/staff/payments",
        {
          query: {
            status: status || undefined,
            search: debouncedSearch || undefined,
            page: targetPage,
            pageSize: 15,
          },
        },
      ).catch(() => null);
      if (data) {
        setPayments(data.payments);
        setSummary(data.summary);
        setPages(data.pages);
        setPage(targetPage);
      } else {
        setPayments([]);
      }
    },
    [status, debouncedSearch],
  );

  useEffect(() => {
    void load(1);
    // Focus a payment arriving from ?focus=pay_xxx — scroll to it.
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payments</h1>
      <p className="mt-1.5 text-ink-muted">
        Payment requests raised against cases and their processing outcomes. Card payments are
        processed through Flutterwave (test mode).
      </p>

      {summary && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label="Received" value={formatNairaCompact(summary.received.amount)} hint={`${summary.received.count} payments`} tone="text-emerald-700" />
          <SummaryCard label="Awaiting payment" value={formatNairaCompact(summary.awaiting.amount)} hint={`${summary.awaiting.count} requests`} tone="text-brand-700" />
          <SummaryCard label="Transfers to confirm" value={String(summary.transfersToConfirm.count)} hint={formatNairaCompact(summary.transfersToConfirm.amount)} tone="text-amber-700" />
          <SummaryCard label="Failed" value={String(summary.failed.count)} hint={formatNairaCompact(summary.failed.amount)} tone="text-red-700" />
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Payment status">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => setStatus(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              status === tab.value ? "bg-brand-800 text-white" : "bg-white text-ink-soft ring-1 ring-brand-200 hover:bg-brand-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative mt-4 max-w-md">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payments by reference, case or payer"
          aria-label="Search payments"
          className="pl-10"
        />
      </div>

      {payments === null ? (
        <PageLoader />
      ) : payments.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No payments found" description="Try a different status or search term." />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Payer</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    onClick={() => router.push(`/app/staff/payments/${payment.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-ink-strong">{payment.reference}</td>
                    <td className="px-4 py-3">
                      {payment.case ? (
                        <span className="font-medium text-brand-700">{payment.case.reference}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{payment.payer?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-bold text-ink-strong">{formatNaira(payment.amount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDateTime(payment.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm text-ink-muted">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => void load(page + 1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}

function SummaryCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-ink-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}
