"use client";

/** Staff payment detail — full attempt history and management actions. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PAYMENT_STATUS_LABELS, formatDateTime, formatNaira } from "@/lib/format";
import {
  Alert, Button, Card, Input, PageLoader, StatusBadge, ChevronLeftIcon,
} from "@/components/platform/ui-bits";

type Attempt = {
  id: string;
  at: string;
  method: string;
  outcome: string;
  message?: string | null;
  processorReference?: string | null;
  processorTxId?: string | null;
};

type PaymentDetail = {
  id: string;
  reference: string;
  amount: number;
  description: string;
  status: string;
  dueDate: string;
  createdAt: string;
  paidAt?: string | null;
  case?: { id: string; reference: string; status: string; property?: { reference: string; title: string; images?: Array<{ url: string; label: string }> } } | null;
  payer?: { id: string; name: string; email?: string } | null;
  requestedBy?: { id: string; name: string } | null;
  attempts: Attempt[];
};

export default function StaffPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const canManage = user?.role === "LAWYER";

  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [missing, setMissing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ payment: PaymentDetail }>(`/staff/payments/${id}`);
      setPayment(data.payment);
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmTransfer() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/payments/${id}/confirm-transfer`, { method: "POST" });
      await load();
      setNotice("Transfer confirmed as received. The case stage has been updated.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not confirm the transfer.");
    } finally {
      setBusy(false);
    }
  }

  async function markFailed() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/payments/${id}/fail`, { method: "POST", body: { reason: reason || undefined } });
      setNotice("Payment marked failed. The client can try again.");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update the payment.");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return <div className="mx-auto max-w-2xl py-16 text-center"><p className="font-medium text-ink-strong">Payment not found.</p></div>;
  }
  if (!payment) return <PageLoader />;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/staff/payments" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        Payments
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
        <p className="text-sm text-ink-muted">{payment.reference}</p>
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{formatNaira(payment.amount)}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {payment.description} · {payment.case?.reference ?? "—"}
        {payment.case?.property ? ` · ${payment.case.property.title}` : ""}
      </p>

      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-strong">Attempt history</h2>
          {payment.attempts.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No attempts recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {payment.attempts.map((attempt) => (
                <li key={attempt.id} className="rounded-lg border border-brand-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink-strong">
                      {attempt.method === "CARD" ? "Card" : "Bank transfer"} ·{" "}
                      <span
                        className={
                          attempt.outcome === "SUCCESSFUL"
                            ? "text-emerald-700"
                            : attempt.outcome === "FAILED"
                              ? "text-red-600"
                              : "text-amber-600"
                        }
                      >
                        {attempt.outcome}
                      </span>
                    </span>
                    <span className="text-xs text-ink-muted">{formatDateTime(attempt.at)}</span>
                  </div>
                  {attempt.message && <p className="mt-1 text-xs text-ink-muted">{attempt.message}</p>}
                  {attempt.processorReference && (
                    <p className="mt-1 text-xs text-ink-muted">Processor ref: {attempt.processorReference}{attempt.processorTxId ? ` · tx ${attempt.processorTxId}` : ""}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <dl className="space-y-2 text-sm">
              <Row term="Reference" value={payment.reference} />
              <Row term="Amount" value={formatNaira(payment.amount)} />
              <Row term="Status" value={PAYMENT_STATUS_LABELS[payment.status]} />
              <Row term="Created" value={formatDateTime(payment.createdAt)} />
              <Row term="Due" value={formatDateTime(payment.dueDate).split(",")[0]} />
              {payment.paidAt && <Row term="Paid" value={formatDateTime(payment.paidAt)} />}
              {payment.payer && <Row term="Payer" value={`${payment.payer.name}${payment.payer.email ? ` (${payment.payer.email})` : ""}`} />}
              {payment.requestedBy && <Row term="Requested by" value={payment.requestedBy.name} />}
            </dl>
            {payment.case && (
              <Link href={`/app/staff/matters/${payment.case.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-700 hover:text-brand-800">
                Open the case →
              </Link>
            )}
          </Card>

          {canManage && payment.status !== "SUCCESSFUL" && (
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-ink-strong">Management actions</h2>
              {payment.status === "PENDING_CONFIRMATION" && (
                <Button className="mt-3 w-full" onClick={() => void confirmTransfer()} loading={busy}>
                  Payment received — update stage
                </Button>
              )}
              <div className="mt-3">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for marking failed (optional)"
                  aria-label="Reason"
                />
                <Button variant="danger" className="mt-2 w-full" onClick={() => void markFailed()} loading={busy}>
                  Mark as failed
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-muted">{term}</dt>
      <dd className="text-right font-medium text-ink-strong">{value}</dd>
    </div>
  );
}
