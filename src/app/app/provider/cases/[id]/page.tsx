"use client";

/**
 * Provider case detail — the provider's view of a live transaction:
 * stepper, thread with the legal team and progress history. The client's
 * contact details stay hidden until the lawyer authorises a disclosure.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CASE_STATUS_LABELS, PURPOSE_LABELS, formatDateTime, formatNaira, PAYMENT_STATUS_LABELS } from "@/lib/format";
import {
  Alert, Button, Card, PageLoader, StatusBadge, Textarea, ChevronLeftIcon,
} from "@/components/platform/ui-bits";
import { CaseStepper } from "@/components/platform/case-stepper";

type ProviderCaseDetail = {
  id: string;
  reference: string;
  status: string;
  openedAt?: string | null;
  enquiry: { id: string; reference: string; purpose: string; submittedAt: string };
  property: {
    id: string; reference: string; title: string; listingType: string; price: number;
    area: string; lga: string; state: string;
    images?: Array<{ url: string; label: string }>;
  };
  client: { id: string; name: string };
  lawyer?: { id: string; name: string } | null;
  payments: Array<{ id: string; reference: string; amount: number; status: string; dueDate: string; paidAt?: string | null }>;
};

export default function ProviderCaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [kase, setCase] = useState<ProviderCaseDetail | null>(null);
  const [timeline, setTimeline] = useState<Array<{ id: string; at: string; label: string; note?: string | null }>>([]);
  const [messages, setMessages] = useState<Array<{ id: string; at: string; body: string; author: { name: string; role: string } }>>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ case: ProviderCaseDetail }>(`/provider/cases/${id}`);
      setCase(data.case);
      const [caseData, threads] = await Promise.all([
        apiFetch<{ timeline: typeof timeline }>(`/cases/${id}`),
        apiFetch<{ messages: typeof messages }>(`/cases/${id}/threads`),
      ]);
      setTimeline(caseData.timeline);
      setMessages(threads.messages);
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await apiFetch(`/cases/${id}/messages`, {
        method: "POST",
        body: { thread: "PROVIDER", body: reply },
      });
      setReply("");
      await load();
    } catch (err) {
      setSendError(err instanceof ApiRequestError ? err.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="font-medium text-ink-strong">Case not found.</p>
        <Link href="/app/provider/cases" className="mt-3 inline-block text-sm font-semibold text-brand-700">
          ← Back to cases
        </Link>
      </div>
    );
  }
  if (!kase) return <PageLoader />;

  const closed = ["COMPLETED", "CANCELLED"].includes(kase.status);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/provider/cases" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        Enquiries & cases
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={kase.status} label={CASE_STATUS_LABELS[kase.status]} />
        <p className="text-sm text-ink-muted">
          {kase.reference} · Enquiry {kase.enquiry.reference}
        </p>
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{kase.property.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {kase.enquiry.submittedAt && `Submitted ${formatDateTime(kase.enquiry.submittedAt)} · `}
        {PURPOSE_LABELS[kase.enquiry.purpose] ?? kase.enquiry.purpose}
        {kase.lawyer && ` · Handled by ${kase.lawyer.name}`}
      </p>

      <div className="mt-5">
        <CaseStepper status={kase.status} />
      </div>

      {kase.payments.length > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="text-base font-semibold text-ink-strong">Payments</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {kase.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-ink-strong">
                  {formatNaira(payment.amount)} <span className="text-xs text-ink-muted">({payment.reference})</span>
                </span>
                <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink-strong">Messages with the Elvictoria legal team</h2>
        <p className="mt-0.5 text-sm text-ink-muted">
          Your lawyer coordinates with the buyer or renter for you — you never exchange details directly.
        </p>
        <div className="mt-4 max-h-96 space-y-3 overflow-y-auto scroll-slim">
          {messages.map((message) => {
            const fromLawyer = message.author.role === "LAWYER" || message.author.role === "SUPPORT";
            return (
              <div key={message.id} className={`flex gap-3 ${!fromLawyer ? "flex-row-reverse" : ""}`}>
                  <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xs font-semibold text-white">
                    {message.author.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${!fromLawyer ? "bg-brand-800 text-white" : "bg-brand-50"}`}>
                    <p className={`mb-0.5 text-xs font-semibold ${!fromLawyer ? "text-brand-100" : "text-brand-700"}`}>
                      {message.author.name}
                      {fromLawyer && <span className="font-normal opacity-80"> · Elvictoria Legal</span>}
                    </p>
                    <p className="whitespace-pre-line">{message.body}</p>
                    <p className={`mt-1 text-2xs ${!fromLawyer ? "text-brand-200" : "text-ink-muted"}`}>
                      {formatDateTime(message.at)}
                    </p>
                  </div>
                </div>
              );
          })}
        </div>
        {!closed && (
          <div className="mt-4">
            <label htmlFor="provider-reply" className="mb-1.5 block text-sm font-medium text-ink-strong">
              Message to the legal team
            </label>
            <Textarea id="provider-reply" rows={3} value={reply} onChange={(e) => setReply(e.target.value)} />
            {sendError && <Alert tone="error">{sendError}</Alert>}
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-ink-muted">Ctrl/⌘ + Enter to send</p>
              <Button onClick={() => void send()} loading={sending} disabled={!reply.trim()}>
                Send
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink-strong">Progress</h2>
        <ol className="mt-3 space-y-0">
          {timeline.map((entry, index) => (
            <li key={entry.id} className="relative flex gap-4 pb-4 last:pb-0">
              {index < timeline.length - 1 && (
                <span className="absolute left-[7px] top-4 h-full w-px bg-brand-100" aria-hidden />
              )}
              <span className="mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-brand-500 bg-white" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm text-ink-strong">{entry.note ?? entry.label}</p>
                <p className="text-xs text-ink-muted">{formatDateTime(entry.at)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
