"use client";

/**
 * Staff matter detail — the lawyer's control room for a transaction:
 * status stepper, Update status, Request payment, thread-scoped
 * communication (Client / Provider / Internal notes), contact disclosure,
 * and the full activity history.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { toast } from "@/lib/toast";
import { useAuth } from "@/lib/auth";
import {
  CASE_STATUS_LABELS, PAYMENT_STATUS_LABELS, PURPOSE_LABELS, formatDateTime, formatNaira,
} from "@/lib/format";
import {
  Alert, Badge, Button, Card, Field, Input, PageLoader, StatusBadge, Textarea, ChevronLeftIcon,
} from "@/components/platform/ui-bits";
import { CaseStepper } from "@/components/platform/case-stepper";

/**
 * The staff matters API returns the ENQUIRY object (the enquiry exists from
 * submission; the transaction case is attached once opened).
 */
type Matter = {
  id: string;
  reference: string;
  status: string;
  purpose: string;
  contactMethod: string;
  message: string;
  submittedAt: string;
  lawyer?: { id: string; name: string } | null;
  client: { id: string; name: string; email: string; phone?: string | null };
  escalations: Array<{ id: string; at: string; note: string; by?: { name?: string } | null }>;
  case?: {
    id: string;
    reference: string;
    status: string;
    openedAt?: string | null;
    payments: Array<{ id: string; reference: string; amount: number; description: string; status: string; dueDate: string; paidAt?: string | null }>;
  } | null;
  property: { id: string; reference: string; title: string; listingType: string; price: number; area: string; lga: string; state: string; images?: Array<{ url: string; label: string }> };
};

type ThreadMessage = { id: string; at: string; body: string; thread: string; author: { id: string; name: string; role: string } };
type TimelineEntry = { id: string; at: string; label: string; note?: string | null; visibility: string; actor?: { name?: string } | null };

const THREAD_TABS = [
  { key: "CLIENT", label: "Client" },
  { key: "PROVIDER", label: "Provider" },
  { key: "INTERNAL", label: "Internal notes" },
];

export default function MatterDetailPage() {
  const { enquiryId } = useParams<{ enquiryId: string }>();
  const { user } = useAuth();
  const canManage = user?.role === "LAWYER";

  const [matter, setMatter] = useState<Matter | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [threads, setThreads] = useState<{ threads: string[]; messages: ThreadMessage[] } | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeThread, setActiveThread] = useState("CLIENT");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const [statusOpen, setStatusOpen] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDesc, setPaymentDesc] = useState("");
  const [paymentDue, setPaymentDue] = useState("");

  const [editPayment, setEditPayment] = useState<{ id: string; reference: string; amount: number } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editReason, setEditReason] = useState("");

  const [deletePayment, setDeletePayment] = useState<{ id: string; reference: string; amount: number } | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ enquiry: Matter }>(`/staff/matters/${enquiryId}`);
      setMatter(data.enquiry);
      const caseId0 = data.enquiry.case?.id ?? null;
      setCaseId(caseId0);
      if (caseId0) {
        const [caseDetail, threadData] = await Promise.all([
          apiFetch<{ timeline: TimelineEntry[] }>(`/cases/${caseId0}`),
          apiFetch<{ threads: string[]; messages: ThreadMessage[] }>(`/cases/${caseId0}/threads`),
        ]);
        setTimeline(caseDetail.timeline);
        setThreads(threadData);
        setActiveThread((prev) => (threadData.threads.includes(prev) ? prev : threadData.threads[0] ?? "CLIENT"));
      }
    } catch {
      setError("Could not load this matter.");
    }
  }, [enquiryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCase() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/enquiries/${enquiryId}/open-case`, { method: "POST" });
      await load();
      setNotice("Transaction case opened.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not open the case.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not open the case.");
    } finally {
      setBusy(false);
    }
  }

  async function updateStatus() {
    if (!caseId || !nextStatus) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/cases/${caseId}/status`, {
        method: "PATCH",
        body: { status: nextStatus, note: statusNote || undefined },
      });
      setStatusOpen(false);
      setNextStatus("");
      setStatusNote("");
      await load();
      setNotice("Status updated.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update the status.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not update the status.");
    } finally {
      setBusy(false);
    }
  }

  async function requestPayment() {
    if (!caseId) return;
    const amount = Number(paymentAmount.replace(/[^0-9]/g, ""));
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/staff/payments", {
        method: "POST",
        body: {
          caseId,
          amount,
          description: paymentDesc,
          dueDate: paymentDue ? new Date(`${paymentDue}T12:00:00+01:00`).toISOString() : undefined,
        },
      });
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentDesc("");
      setPaymentDue("");
      await load();
      setNotice("Payment request raised — the client has been notified.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not raise the payment request.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not raise the payment request.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmTransfer(paymentId: string) {
    setBusy(true);
    try {
      await apiFetch(`/staff/payments/${paymentId}/confirm-transfer`, { method: "POST" });
      await load();
      setNotice("Transfer confirmed as received.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not confirm the transfer.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not confirm the transfer.");
    } finally {
      setBusy(false);
    }
  }

  /** Amount edits stay possible while the request is open: the client may
   *  dispute the figure or the matter may need re-scoping. Settled payments
   *  and transfers the client already reported are locked (backend guards). */
  async function savePaymentAmount() {
    if (!editPayment) return;
    const amount = Number(editAmount.replace(/[^0-9]/g, ""));
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/payments/${editPayment.id}/amount`, {
        method: "PATCH",
        body: { amount, reason: editReason || undefined },
      });
      setEditPayment(null);
      setEditReason("");
      await load();
      toast.success("Amount updated — client notified.");
      setNotice("Payment request amount updated — the client has been notified.");
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Could not update the amount.";
      toast.error(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeletePayment() {
    if (!deletePayment) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/staff/payments/${deletePayment.id}`, {
        method: "DELETE",
        body: { reason: deleteReason || undefined },
      });
      setDeletePayment(null);
      setDeleteReason("");
      await load();
      toast.success("Payment request deleted.");
      setNotice("The payment request was deleted — the client and provider have been notified.");
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Could not delete the payment request.";
      toast.error(message);
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function disclose(party: "client" | "provider") {
    if (!caseId) return;
    setBusy(true);
    try {
      await apiFetch(`/cases/${caseId}/disclose`, { method: "POST", body: { party } });
      await load();
      setNotice(`Contact details disclosed to the ${party}.`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not record the disclosure.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not record the disclosure.");
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage() {
    if (!caseId || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch(`/cases/${caseId}/messages`, {
        method: "POST",
        body: { thread: activeThread, body: reply },
      });
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not send the message.");
      toast.error(err instanceof ApiRequestError ? err.message : "Could not send the message.");
    } finally {
      setSending(false);
    }
  }

  if (!matter) {
    return error ? (
      <div className="mx-auto max-w-2xl py-16 text-center"><p className="font-medium text-ink-strong">{error}</p></div>
    ) : (
      <PageLoader />
    );
  }

  const kase = matter.case;
  const threadMessages = (threads?.messages ?? []).filter((m) => m.thread === activeThread);
  const closed = ["COMPLETED", "CANCELLED"].includes(matter.status);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/app/staff/cases" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        Cases
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StatusBadge status={matter.status} label={CASE_STATUS_LABELS[matter.status]} />
        <p className="text-sm text-ink-muted">Enquiry {matter.reference}</p>
        {kase && <Badge>{kase.reference}</Badge>}
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{matter.property.title}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Submitted {formatDateTime(matter.submittedAt)} · {PURPOSE_LABELS[matter.purpose] ?? matter.purpose} ·{" "}
        {matter.client.name} ({matter.client.email}
        {matter.client.phone ? `, ${matter.client.phone}` : ""})
      </p>

      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      {/* ------------------------------------------------- actions row */}
      <div className="mt-5 flex flex-wrap gap-3">
        {canManage && !kase && (
          <Button onClick={() => void openCase()} loading={busy}>
            Open transaction case
          </Button>
        )}
        {kase && canManage && !closed && (
          <>
            <Button variant="outline" onClick={() => { setStatusOpen(true); setNextStatus(kase.status); }}>
              Update status
            </Button>
            <Button variant="outline" onClick={() => setPaymentOpen(true)}>
              Request payment
            </Button>
          </>
        )}
      </div>

      {/* ----------------------------------------------- status stepper */}
      <div className="mt-5">
        <CaseStepper status={matter.status} />
      </div>

      {/* ------------------------------------------------- escalations */}
      {matter.escalations.length > 0 && (
        <Card className="mt-5 border-amber-200 bg-amber-50/70 p-4">
          <p className="text-sm font-semibold text-amber-800">Escalations</p>
          <ul className="mt-2 space-y-1.5 text-sm text-amber-800">
            {matter.escalations.map((escalation) => (
              <li key={escalation.id}>
                {escalation.note} — {escalation.by?.name ?? "staff"}, {formatDateTime(escalation.at)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ---------------------------------------------------- payments */}
      {kase && kase.payments.length > 0 && (
        <Card className="mt-5 p-5">
          <h2 className="text-base font-semibold text-ink-strong">Payment requests</h2>
          <ul className="mt-3 space-y-2.5">
            {kase.payments.map((payment) => (
              <li key={payment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-semibold text-ink-strong">
                    {formatNaira(payment.amount)} <span className="text-xs font-normal text-ink-muted">· {payment.description}</span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {payment.reference} · due {formatDateTime(payment.dueDate).split(",")[0]}
                    {payment.paidAt ? ` · paid ${formatDateTime(payment.paidAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={payment.status} label={PAYMENT_STATUS_LABELS[payment.status]} />
                  {canManage && ["OUTSTANDING", "AWAITING_PAYMENT", "FAILED"].includes(payment.status) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditPayment({ id: payment.id, reference: payment.reference, amount: payment.amount });
                        setEditAmount(String(payment.amount));
                        setEditReason("");
                      }}
                    >
                      Edit amount
                    </Button>
                  )}
                  {canManage && ["OUTSTANDING", "AWAITING_PAYMENT", "FAILED"].includes(payment.status) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDeletePayment({ id: payment.id, reference: payment.reference, amount: payment.amount });
                        setDeleteReason("");
                      }}
                    >
                      Delete
                    </Button>
                  )}
                  {canManage && payment.status === "PENDING_CONFIRMATION" && (
                    <Button size="sm" onClick={() => void confirmTransfer(payment.id)} loading={busy}>
                      Payment received — update stage
                    </Button>
                  )}
                  <Link href={`/app/staff/payments?focus=${payment.id}`} className="text-xs font-semibold text-brand-700 hover:text-brand-800">
                    Details
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* ----------------------------------------------- communication */}
      {kase && threads && (
        <Card className="mt-5 p-5 sm:p-6">
          <h2 className="text-base font-semibold text-ink-strong">Communication</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            Participants only see their own thread with the legal team. Buyers and providers never message each other.
          </p>

          <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Threads">
            {threads.threads.map((thread) => {
              const label = THREAD_TABS.find((t) => t.key === thread)?.label ?? thread;
              const count = threads.messages.filter((m) => m.thread === thread).length;
              return (
                <button
                  key={thread}
                  role="tab"
                  aria-selected={activeThread === thread}
                  onClick={() => setActiveThread(thread)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    activeThread === thread ? "bg-brand-800 text-white" : "bg-white text-ink-soft ring-1 ring-brand-200 hover:bg-brand-50"
                  }`}
                >
                  {label} · {count}
                </button>
              );
            })}
          </div>

          <div className="mt-4 max-h-96 space-y-3 overflow-y-auto scroll-slim">
            {threadMessages.length === 0 ? (
              <p className="text-sm text-ink-muted">No messages in this thread yet.</p>
            ) : (
              threadMessages.map((message) => {
                const fromStaff = message.author.role === "LAWYER" || message.author.role === "SUPPORT";
                return (
                  <div key={message.id} className={`flex gap-3 ${fromStaff ? "flex-row-reverse" : ""}`}>
                  <span aria-hidden className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-2xs font-semibold text-white">
                    {message.author.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${fromStaff ? "bg-brand-800 text-white" : "bg-brand-50"}`}>
                    <p className={`mb-0.5 text-xs font-semibold ${fromStaff ? "text-brand-100" : "text-brand-700"}`}>
                      {message.author.name}
                      {!fromStaff && <span className="font-normal opacity-80">{activeThread === "INTERNAL" ? " · Internal note" : " · Elvictoria Legal"}</span>}
                    </p>
                    <p className="whitespace-pre-line">{message.body}</p>
                    <p className={`mt-1 text-2xs ${fromStaff ? "text-brand-200" : "text-ink-muted"}`}>
                      {formatDateTime(message.at)}
                    </p>
                  </div>
                </div>
              );
              })
            )}
          </div>

          {!closed && (
            <div className="mt-4">
              <label htmlFor="matter-reply" className="mb-1.5 block text-sm font-medium text-ink-strong">
                Message to {activeThread === "CLIENT" ? "Client" : activeThread === "PROVIDER" ? "Provider" : "Internal note"}
              </label>
              <Textarea
                id="matter-reply"
                rows={3}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={activeThread === "INTERNAL" ? "Internal note — never shown to participants" : "Write your message…"}
              />
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-ink-muted">Ctrl/⌘ + Enter to send</p>
                <Button onClick={() => void sendMessage()} loading={sending} disabled={!reply.trim()}>
                  Send
                </Button>
              </div>
            </div>
          )}

          {canManage && (
            <div className="mt-4 rounded-lg border border-brand-50 bg-brand-50/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Contact disclosure (authorised by lawyers only)
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Sharing contact details records the disclosure against this case and notifies the recipient.
              </p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" variant="outline" onClick={() => void disclose("client")} disabled={busy}>
                  Share provider details with client
                </Button>
                <Button size="sm" variant="outline" onClick={() => void disclose("provider")} disabled={busy}>
                  Share client details with provider
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ---------------------------------------------- activity history */}
      <Card className="mt-5 p-5 sm:p-6">
        <h2 className="text-base font-semibold text-ink-strong">Activity history</h2>
        <p className="mt-0.5 text-sm text-ink-muted">Entries marked internal are not shown to participants.</p>
        <ol className="mt-3 space-y-0">
          {timeline.length === 0 ? (
            <li className="text-sm text-ink-muted">No activity yet.</li>
          ) : (
            timeline.map((entry, index) => (
              <li key={entry.id} className="relative flex gap-4 pb-4 last:pb-0">
                {index < timeline.length - 1 && (
                  <span className="absolute left-[7px] top-4 h-full w-px bg-brand-100" aria-hidden />
                )}
                <span
                  className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 ${entry.visibility === "INTERNAL" ? "border-slate-400 bg-slate-100" : "border-brand-500 bg-white"}`}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm text-ink-strong">
                    {entry.label}
                    {entry.visibility === "INTERNAL" && (
                      <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">INTERNAL</span>
                    )}
                  </p>
                  {entry.note && <p className="text-sm text-ink-muted">{entry.note}</p>}
                  <p className="text-xs text-ink-muted">
                    {formatDateTime(entry.at)}
                    {entry.actor?.name ? ` · ${entry.actor.name}` : ""}
                  </p>
                </div>
              </li>
            ))
          )}
        </ol>
      </Card>

      {/* ---------------------------------------------- status modal */}
      {statusOpen && (
        <Modal title="Update status" onClose={() => setStatusOpen(false)}>
          <Field label="New status" required>
            <select
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value)}
              className="w-full rounded-lg border border-brand-100 bg-white px-3.5 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
              aria-label="New status"
            >
              {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Note for participants (optional)" hint="Shown on the buyer and provider timelines.">
            <Textarea rows={3} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button onClick={() => void updateStatus()} loading={busy}>Update status</Button>
          </div>
        </Modal>
      )}

      {/* --------------------------------------------- payment modal */}
      {paymentOpen && (
        <Modal title="Request payment" onClose={() => setPaymentOpen(false)}>
          <Field label="Amount (₦)" required>
            <Input
              inputMode="numeric"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 4500000"
            />
          </Field>
          <Field label="Description" required hint="As agreed between the parties, e.g. “First year’s rent”.">
            <Input value={paymentDesc} onChange={(e) => setPaymentDesc(e.target.value)} />
          </Field>
          <Field label="Due date (optional)">
            <Input type="date" value={paymentDue} onChange={(e) => setPaymentDue(e.target.value)} />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button
              onClick={() => void requestPayment()}
              loading={busy}
              disabled={!paymentAmount || !paymentDesc.trim()}
            >
              Raise request
            </Button>
          </div>
        </Modal>
      )}

      {/* --------------------------------------- edit amount modal */}
      {editPayment && (
        <Modal title={`Edit amount — ${editPayment.reference}`} onClose={() => setEditPayment(null)}>
          <Field label="Amount (₦)" required hint="The client and provider are notified of the change immediately.">
            <Input
              inputMode="numeric"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value.replace(/[^0-9]/g, ""))}
            />
          </Field>
          <Field label="Reason (optional)" hint="Recorded on the case timeline and the audit log.">
            <Textarea
              rows={2}
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="e.g. Client negotiated the figure down"
            />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setEditPayment(null)}>Cancel</Button>
            <Button
              onClick={() => void savePaymentAmount()}
              loading={busy}
              disabled={!editAmount || Number(editAmount) === editPayment.amount}
            >
              Save new amount
            </Button>
          </div>
        </Modal>
      )}

      {/* ------------------------------------- delete payment modal */}
      {deletePayment && (
        <Modal title={`Delete payment request — ${deletePayment.reference}`} onClose={() => setDeletePayment(null)}>
          <p className="text-sm text-ink-soft">
            Delete the request for {formatNaira(deletePayment.amount)}? The client and provider are notified and
            the deletion is recorded on the case timeline and audit log. This cannot be undone.
          </p>
          <Field label="Reason (optional)" hint="Recorded on the case timeline and the audit log.">
            <Textarea
              rows={2}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="e.g. Raised in error — superseded by another request"
            />
          </Field>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeletePayment(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => void confirmDeletePayment()} loading={busy}>
              Delete request
            </Button>
          </div>
        </Modal>
      )}

    </div>
  );
}

/** Lightweight modal shell (focus-trap friendly, aria-labelled). */
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal aria-label={title}>
      <Card className="w-full max-w-md p-6">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl text-ink-strong">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-ink-muted hover:text-ink-strong">
            ✕
          </button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </Card>
    </div>
  );
}
