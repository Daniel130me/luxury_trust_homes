"use client";

/**
 * Client enquiry detail — status stepper, message thread with the legal
 * team, payment requests and progress history (prototype layout).
 *
 * Data comes from two role-scoped endpoints: /enquiries/:id (enquiry +
 * property + case reference) and /cases/:id (+ /threads) for the case
 * bundle — messages and timeline are NOT part of the enquiry payload.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { CASE_STATUS_LABELS, PURPOSE_LABELS, formatDateTime, formatNaira } from "@/lib/format";
import {
  Alert, Button, Card, PageLoader, StatusBadge, Textarea, ChevronLeftIcon,
} from "@/components/platform/ui-bits";
import { CaseStepper } from "@/components/platform/case-stepper";

type PaymentLite = {
  id: string;
  reference: string;
  amount: number;
  description: string;
  status: string;
  dueDate: string;
  paidAt?: string | null;
};

type EnquiryDetail = {
  id: string;
  reference: string;
  status: string;
  purpose: string;
  submittedAt: string;
  message: string;
  property: {
    id: string; reference: string; title: string; category: string; listingType: string; price: number;
    area: string; lga: string; state: string;
    images?: Array<{ url: string; label: string }>;
  };
  case?: { id: string; reference: string } | null;
};

type ThreadMessage = {
  id: string;
  at: string;
  body: string;
  thread: string;
  author: { id: string; name: string; role: string };
};

type TimelineEntry = { id: string; at: string; label: string; note?: string | null };

type CaseBundle = {
  case: { id: string; reference: string; status: string; lawyer?: { id: string; name: string } | null };
  timeline: TimelineEntry[];
  payments: PaymentLite[];
};

type CaseData = CaseBundle & { threads: string[]; messages: ThreadMessage[] };

export default function ClientEnquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [enquiry, setEnquiry] = useState<EnquiryDetail | null>(null);
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [missing, setMissing] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ enquiry: EnquiryDetail }>(`/enquiries/${id}`);
      const enquiry = data.enquiry;
      setEnquiry(enquiry);
      setCaseData(null);
      if (enquiry.case?.id) {
        // The case bundle carries threads, messages, timeline and payments.
        const caseId = enquiry.case.id;
        const [bundle, threads] = await Promise.all([
          apiFetch<CaseBundle>(`/cases/${caseId}`),
          apiFetch<{ threads: string[]; messages: ThreadMessage[] }>(`/cases/${caseId}/threads`),
        ]);
        setCaseData({ ...bundle, threads: threads.threads ?? [], messages: threads.messages ?? [] });
      }
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send() {
    if (!reply.trim() || !caseData) return;
    setSending(true);
    setSendError(null);
    try {
      await apiFetch(`/cases/${caseData.case.id}/messages`, {
        method: "POST",
        body: { thread: "CLIENT", body: reply },
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
        <p className="font-medium text-ink-strong">Enquiry not found.</p>
        <Link href="/app/client/enquiries" className="mt-3 inline-block text-sm font-semibold text-brand-700">
          ← Back to my enquiries
        </Link>
      </div>
    );
  }
  if (!enquiry) return <PageLoader />;

  const kase = caseData?.case ?? null;
  const closed = ["COMPLETED", "CANCELLED"].includes(enquiry.status);
  const messages = caseData?.messages ?? [];
  const timeline = caseData?.timeline ?? [];
  const outstandingPayments = (caseData?.payments ?? []).filter((p) =>
    ["OUTSTANDING", "AWAITING_PAYMENT", "PENDING_CONFIRMATION", "FAILED"].includes(p.status),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/client/enquiries" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        My enquiries
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={enquiry.status} label={CASE_STATUS_LABELS[enquiry.status]} />
        <p className="text-sm text-ink-muted">
          {kase ? `${kase.reference} · Enquiry ${enquiry.reference}` : `Enquiry ${enquiry.reference}`}
        </p>
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{enquiry.property.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Submitted {formatDateTime(enquiry.submittedAt)} · {PURPOSE_LABELS[enquiry.purpose] ?? enquiry.purpose}
      </p>

      <div className="mt-5">
        <CaseStepper status={enquiry.status} clientMode />
      </div>

      {/* -------------------------------------------- payment requests */}
      {outstandingPayments.length > 0 && (
        <Card className="mt-6 border-amber-200 bg-amber-50/60 p-5">
          <h2 className="text-lg font-semibold text-ink-strong">Payment requested</h2>
          {outstandingPayments.map((payment) => (
            <div key={payment.id} className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-strong">
                  {formatNaira(payment.amount)} — {payment.description}
                </p>
                <p className="text-xs text-ink-muted">
                  {payment.reference} · due {formatDateTime(payment.dueDate).split(",")[0]}
                </p>
              </div>
              <Link
                href={`/app/client/payments/${payment.id}`}
                className="rounded-lg bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                {payment.status === "FAILED" ? "Try again" : "Make a payment"}
              </Link>
            </div>
          ))}
        </Card>
      )}

      {/* ------------------------------------------------------- messages */}
      {kase && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink-strong">Messages with the ELVICTORIA legal team</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Ask questions or share information. Your lawyer coordinates with the property provider for you.
          </p>

          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto scroll-slim">
            {messages.map((message) => {
              const fromLawyer = message.author.role === "LAWYER" || message.author.role === "SUPPORT";
              return (
                <div key={message.id} className={`flex gap-3 ${!fromLawyer ? "flex-row-reverse" : ""}`}>
                  <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xs font-semibold text-white">
                    {(message.author.name ?? "?").split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${!fromLawyer ? "bg-brand-800 text-white" : "bg-brand-50"}`}>
                    <p className={`mb-0.5 text-xs font-semibold ${!fromLawyer ? "text-brand-100" : "text-brand-700"}`}>
                      {message.author.name}
                      {fromLawyer && <span className="font-normal opacity-80"> · ELVICTORIA Legal</span>}
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
              <label htmlFor="client-reply" className="mb-1.5 block text-sm font-medium text-ink-strong">
                Message to the legal team
              </label>
              <Textarea
                id="client-reply"
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write your message…"
              />
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
      )}

      {/* ------------------------------------------------------ progress */}
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
