"use client";

/**
 * Make a payment — payment method choice (debit card via Flutterwave
 * hosted checkout, or bank transfer confirmed by the lawyer), plus the
 * security note and summary panel from the prototype.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { PAYMENT_STATUS_LABELS, formatDateTime, formatNaira } from "@/lib/format";
import {
  Alert, Button, Card, PageLoader, StatusBadge, ChevronLeftIcon,
} from "@/components/platform/ui-bits";

type Attempt = {
  id: string;
  at: string;
  method: string;
  outcome: string;
  message?: string | null;
  processorReference?: string | null;
};

type PaymentDetail = {
  id: string;
  reference: string;
  amount: number;
  description: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
  case?: { id: string; reference: string; status: string; property?: { reference: string; title: string; images?: Array<{ url: string; label: string }> } } | null;
  requestedBy?: { name: string } | null;
  attempts: Attempt[];
};

type Method = "card" | "transfer" | null;
type BankDetails = { bankName?: string; bankAccountName?: string; bankAccountNumber?: string };

export default function PaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [missing, setMissing] = useState(false);
  // Bank transfer is the primary method — selected by default.
  const [method, setMethod] = useState<Method>("transfer");
  const [transferNote, setTransferNote] = useState("");
  const [bank, setBank] = useState<BankDetails | null>(null);
  const [bankUnavailable, setBankUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ payment: PaymentDetail }>(`/client/payments/${id}`);
      setPayment(data.payment);
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Bank details are gated server-side and only load once the payer has an
  // active payment request — exactly when this page offers a payment method.
  useEffect(() => {
    if (!payment || !["OUTSTANDING", "AWAITING_PAYMENT", "FAILED"].includes(payment.status)) return;
    apiFetch<{ details: BankDetails }>("/client/payments/bank-details")
      .then((d) => setBank(d.details))
      .catch(() => setBankUnavailable(true));
  }, [payment?.id, payment?.status]);

  // After returning from the hosted checkout, verify the session server-side.
  useEffect(() => {
    const processorReference = new URLSearchParams(window.location.search).get("ref");
    if (!processorReference || !payment || payment.status === "SUCCESSFUL") return;
    void (async () => {
      setBusy(true);
      try {
        const result = await apiFetch<{ status: string }>(`/client/payments/${payment.id}/verify`, {
          method: "POST",
          body: { processorReference },
        });
        if (result.status === "SUCCESSFUL") {
          setNotice("Payment successful. Thank you.");
        } else if (result.status === "FAILED") {
          setNotice("The payment attempt was unsuccessful. You can try again.");
        } else {
          setNotice("Your payment is still processing. We will confirm shortly.");
        }
        await load();
      } catch (err) {
        setError(err instanceof ApiRequestError ? err.message : "Could not verify the payment. It remains pending.");
        toast.error(err instanceof ApiRequestError ? err.message : "Could not verify the payment. It remains pending.");
      } finally {
        setBusy(false);
        // Clean the query string so refresh does not re-verify.
        window.history.replaceState({}, "", `/app/client/payments/${payment.id}`);
      }
    })();
     
  }, [payment?.id]);

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="font-medium text-ink-strong">Payment not found.</p>
        <Link href="/app/client/payments" className="mt-3 inline-block text-sm font-semibold text-brand-700">
          ← Back to payments
        </Link>
      </div>
    );
  }
  if (!payment) return <PageLoader />;

  const unpaid = ["OUTSTANDING", "AWAITING_PAYMENT", "FAILED"].includes(payment.status);
  const pendingTransfer = payment.status === "PENDING_CONFIRMATION";

  async function payByCard() {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ link: string; processorReference: string }>(
        `/client/payments/${payment.id}/pay`,
        { method: "POST" },
      );
      // Redirect to the Flutterwave hosted checkout.
      window.location.href = data.link;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not start the payment. Please try again.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not start the payment. Please try again.");
      setBusy(false);
    }
  }

  async function reportTransfer() {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/client/payments/${payment.id}/transfer`, {
        method: "POST",
        body: { note: transferNote || undefined },
      });
      setNotice("Your transfer has been reported and is awaiting confirmation by the legal team.");
      setMethod(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not report the transfer.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not report the transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/client/payments" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        Payments
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
        <p className="text-sm text-ink-muted">{payment.reference}</p>
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Make a payment</h1>

      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* ------------------------------------------------ payment body */}
        <Card className="p-5 sm:p-6">
          {payment.status === "SUCCESSFUL" ? (
            <Alert tone="success">
              This payment was completed{payment.paidAt ? ` on ${formatDateTime(payment.paidAt)}` : ""}. Thank you.
            </Alert>
          ) : pendingTransfer ? (
            <Alert tone="info">
              Your bank transfer has been reported and is awaiting confirmation by your lawyer. Once
              confirmed, this payment will be marked received.
            </Alert>
          ) : unpaid ? (
            <>
              <fieldset>
                <legend className="text-sm font-semibold text-ink-strong">Payment method</legend>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {/* Primary: manual bank transfer into ELVICTORIA's account. */}
                  <button
                    onClick={() => setMethod("transfer")}
                    aria-pressed={method === "transfer"}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      method === "transfer" ? "border-brand-700 bg-brand-50" : "border-brand-100 hover:border-brand-300"
                    }`}
                  >
                    <p className="font-semibold text-ink-strong">
                      Bank transfer <span className="ml-1 rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-bold text-white">PRIMARY</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">Pay into the Elvictoria Attorneys and Solicitors account — confirmed by the legal team</p>
                  </button>
                  <button
                    onClick={() => setMethod("card")}
                    aria-pressed={method === "card"}
                    className={`rounded-xl border-2 p-4 text-left transition-colors ${
                      method === "card" ? "border-brand-700 bg-brand-50" : "border-brand-100 hover:border-brand-300"
                    }`}
                  >
                    <p className="font-semibold text-ink-strong">Debit card</p>
                    <p className="mt-0.5 text-xs text-ink-muted">Alternative — instant payment via Flutterwave</p>
                  </button>
                </div>
              </fieldset>

              {method === "card" && (
                <div className="mt-4">
                  <Button onClick={() => void payByCard()} loading={busy} className="w-full sm:w-auto">
                    Continue to secure checkout
                  </Button>
                </div>
              )}

              {method === "transfer" && (
                <div className="mt-4 space-y-3">
                  <Alert tone="info">
                    Transfer {formatNaira(payment.amount)} into the Elvictoria Attorneys and Solicitors account below, then
                    report the transfer here. The legal team confirms receipt against your case.
                  </Alert>

                  {/* The account details are fetched only for eligible payers. */}
                  {bank && (bank.bankName || bank.bankAccountName || bank.bankAccountNumber) ? (
                    <dl className="rounded-lg border border-brand-100 bg-white p-4 text-sm">
                      {bank.bankName && (
                        <div className="flex justify-between gap-4 py-1">
                          <dt className="text-ink-muted">Bank</dt>
                          <dd className="font-semibold text-ink-strong">{bank.bankName}</dd>
                        </div>
                      )}
                      {bank.bankAccountName && (
                        <div className="flex justify-between gap-4 py-1">
                          <dt className="text-ink-muted">Account name</dt>
                          <dd className="font-semibold text-ink-strong">{bank.bankAccountName}</dd>
                        </div>
                      )}
                      {bank.bankAccountNumber && (
                        <div className="flex justify-between gap-4 py-1">
                          <dt className="text-ink-muted">Account number</dt>
                          <dd className="font-mono text-base font-bold tracking-wide text-ink-strong">{bank.bankAccountNumber}</dd>
                        </div>
                      )}
                    </dl>
                  ) : bankUnavailable ? (
                    <Alert tone="info">
                      Bank details are temporarily unavailable. Please use the debit card option, or
                      contact support for the transfer account.
                    </Alert>
                  ) : null}

                  <textarea
                    value={transferNote}
                    onChange={(e) => setTransferNote(e.target.value)}
                    rows={2}
                    placeholder="Optional note (e.g. transfer date, bank, last 4 digits)"
                    className="w-full rounded-lg border border-brand-100 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    aria-label="Transfer note"
                  />
                  <Button onClick={() => void reportTransfer()} loading={busy} className="w-full sm:w-auto">
                    I have made the transfer
                  </Button>
                </div>
              )}

            </>
          ) : (
            <p className="text-sm text-ink-muted">
              This payment is {PAYMENT_STATUS_LABELS[payment.status].toLowerCase()}. Check the requests
              tab for actions.
            </p>
          )}
        </Card>

        {/* ----------------------------------------------------- summary */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-ink-strong">Summary</h2>
          {payment.case?.property?.images?.[0] && (
             
            <img
              src={payment.case.property.images[0].url}
              alt={payment.case.property.images[0].label}
              className="mt-3 aspect-[16/10] w-full rounded-lg object-cover"
              loading="lazy"
            />
          )}
          <dl className="mt-4 space-y-2.5 text-sm">
            <SummaryRow term="Payment" value={payment.reference} />
            <SummaryRow term="Amount" value={formatNaira(payment.amount)} strong />
            <SummaryRow term="Description" value={payment.description} />
            {payment.case && <SummaryRow term="Case" value={payment.case.reference} />}
            {payment.case?.property && <SummaryRow term="Property" value={payment.case.property.title} />}
            <SummaryRow term="Due" value={formatDateTime(payment.dueDate).split(",")[0]} />
            {payment.requestedBy && <SummaryRow term="Requested by" value={payment.requestedBy.name} />}
          </dl>
          {payment.attempts.length > 0 && (
            <div className="mt-4 border-t border-brand-50 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Attempts</p>
              <ul className="mt-2 space-y-1.5 text-xs text-ink-muted">
                {payment.attempts.slice(0, 4).map((attempt) => (
                  <li key={attempt.id}>
                    {formatDateTime(attempt.at)} · {attempt.method === "CARD" ? "Card" : "Transfer"} ·{" "}
                    <span className={attempt.outcome === "SUCCESSFUL" ? "text-emerald-700" : attempt.outcome === "FAILED" ? "text-red-600" : "text-amber-600"}>
                      {attempt.outcome}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ term, value, strong }: { term: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-ink-muted">{term}</dt>
      <dd className={`text-right ${strong ? "text-base font-bold text-ink-strong" : "font-medium text-ink-strong"}`}>
        {value}
      </dd>
    </div>
  );
}
