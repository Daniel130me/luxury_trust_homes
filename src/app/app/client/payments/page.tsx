"use client";

/** Client payments — Requests | All payments tabs (prototype layout). */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PAYMENT_STATUS_LABELS, formatDate, formatNaira } from "@/lib/format";
import { Card, EmptyState, PageLoader, StatusBadge } from "@/components/platform/ui-bits";

type PaymentRow = {
  id: string;
  reference: string;
  amount: number;
  description: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  createdAt: string;
  case?: { id: string; reference: string } | null;
};

const REQUEST_STATUSES = ["OUTSTANDING", "AWAITING_PAYMENT", "PENDING_CONFIRMATION", "FAILED"];

export default function ClientPaymentsPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [tab, setTab] = useState<"requests" | "all">("requests");

  const load = useCallback(async () => {
    const data = await apiFetch<{ payments: PaymentRow[] }>("/client/payments", {
      query: { pageSize: 50 },
    }).catch(() => null);
    setPayments(data?.payments ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = (payments ?? []).filter((p) =>
    tab === "requests" ? REQUEST_STATUSES.includes(p.status) : true,
  );

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payments</h1>
      <p className="mt-1.5 text-ink-muted">
        Payment requests from your lawyer and your payment history.
      </p>

      <div className="mt-4 flex rounded-lg bg-brand-50 p-1 w-fit" role="tablist" aria-label="Payment view">
        {(["requests", "all"] as const).map((option) => (
          <button
            key={option}
            role="tab"
            aria-selected={tab === option}
            onClick={() => setTab(option)}
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              tab === option ? "bg-brand-800 text-white" : "text-brand-700 hover:bg-brand-100"
            }`}
          >
            {option === "requests" ? `Requests ${(payments ?? []).filter((p) => REQUEST_STATUSES.includes(p.status)).length}` : `All payments ${(payments ?? []).length}`}
          </button>
        ))}
      </div>

      {payments === null ? (
        <PageLoader />
      ) : rows.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={tab === "requests" ? "No payment requests" : "No payments yet"}
            description="Payment requests raised by your lawyer will appear here, linked to your case."
          />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {rows.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <p className="font-bold text-ink-strong">{formatNaira(payment.amount)}</p>
                      <p className="text-xs text-ink-muted">{payment.description}</p>
                    </td>
                    <td className="px-4 py-3">
                      {payment.case && (
                        <Link href={`/app/client/enquiries/${payment.case.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                          {payment.case.reference}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{payment.reference}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(payment.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      {REQUEST_STATUSES.includes(payment.status) && (
                        <button
                          onClick={() => router.push(`/app/client/payments/${payment.id}`)}
                          className="rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-brand-800"
                        >
                          {payment.status === "FAILED" ? "Try again" : "View payment"}
                        </button>
                      )}
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
