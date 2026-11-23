"use client";

/** Staff helpdesk ticket detail — conversation, reply, status & priority. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { priorityBadge, statusBadge, ticketAcceptsReplies, type TicketPriorityKey, type TicketStatusKey } from "@/lib/tickets";
import {
  Alert, Badge, Button, Card, PageLoader, Select, Textarea, ChevronLeftIcon, AlertTriangleIcon,
} from "@/components/platform/ui-bits";

type TicketMessage = { id: string; at: string; fromStaff: boolean; body: string; author?: { name?: string } | null };
type Ticket = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; phone?: string | null } | null;
  name: string;
  email: string;
  phone?: string | null;
  messages: TicketMessage[];
};

const STATUS_OPTIONS: TicketStatusKey[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITY_OPTIONS: TicketPriorityKey[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

export default function StaffTicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [missing, setMissing] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ ticket: Ticket }>(`/tickets/staff/${id}`);
      setTicket(data.ticket);
    } catch {
      setMissing(true);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function sendReply() {
    if (!reply.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/tickets/staff/${id}/reply`, { method: "POST", body: { body: reply } });
      setReply("");
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not send the reply.");
    } finally {
      setBusy(false);
    }
  }

  // One endpoint handles status and priority; the backend notifies the
  // ticket owner on the transitions they care about and audits the change.
  async function updateTicket(patch: { status?: string; priority?: string }) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/tickets/staff/${id}`, { method: "PATCH", body: patch });
      await load();
      setNotice("Ticket updated — the owner is notified where needed.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update the ticket.");
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return <div className="mx-auto max-w-2xl py-16 text-center"><p className="font-medium text-ink-strong">Ticket not found.</p></div>;
  }
  if (!ticket) return <PageLoader />;

  const isFraud = ticket.category === "fraud";

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/app/staff/helpdesk" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-brand-700">
        <ChevronLeftIcon className="h-4 w-4" />
        Help Desk
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Badge tone={statusBadge(ticket.status).tone}>{statusBadge(ticket.status).label}</Badge>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityBadge(ticket.priority).tone}`}>
          {priorityBadge(ticket.priority).label}
        </span>
        {isFraud && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white">
            <AlertTriangleIcon className="h-3 w-3" />
            SUSPECTED FRAUD
          </span>
        )}
        <p className="text-sm text-ink-muted">{ticket.reference} · {ticket.category}</p>
      </div>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{ticket.subject}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {ticket.user?.name ?? ticket.name} ({ticket.user?.email ?? ticket.email})
        {ticket.phone ? ` · ${ticket.phone}` : ""} · opened {formatDateTime(ticket.createdAt)}
      </p>

      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      <Card className="mt-6 divide-y divide-brand-50 p-0">
        {ticket.messages.map((message) => (
          <div key={message.id} className="px-5 py-4">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold text-ink-strong">
                {message.fromStaff ? "Elvictoria Support" : (message.author?.name ?? ticket.name)}
              </span>
              <span>{formatDateTime(message.at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{message.body}</p>
          </div>
        ))}
      </Card>

      {ticketAcceptsReplies(ticket.status) ? (
        <Card className="mt-4 p-5">
          {/* Status and priority sit with the reply so one screen manages the ticket. */}
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-medium text-ink-muted">
              Status
              <Select
                value={ticket.status}
                onChange={(e) => void updateTicket({ status: e.target.value })}
                disabled={busy}
                aria-label="Ticket status"
                className="mt-1 w-44"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>{statusBadge(option).label}</option>
                ))}
              </Select>
            </label>
            <label className="text-xs font-medium text-ink-muted">
              Priority
              <Select
                value={ticket.priority}
                onChange={(e) => void updateTicket({ priority: e.target.value })}
                disabled={busy}
                aria-label="Ticket priority"
                className="mt-1 w-44"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>{priorityBadge(option).label}</option>
                ))}
              </Select>
            </label>
          </div>
          <Textarea
            className="mt-4"
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your reply to the user…"
            aria-label="Reply"
          />
          <div className="mt-3 flex justify-end">
            <Button onClick={() => void sendReply()} loading={busy} disabled={!reply.trim()}>
              Send reply
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="text-sm text-ink-muted">
            This ticket is {statusBadge(ticket.status).label.toLowerCase()}. You can still reopen it or adjust the priority.
          </p>
          <div className="flex gap-3">
            <Select
              value={ticket.status}
              onChange={(e) => void updateTicket({ status: e.target.value })}
              disabled={busy}
              aria-label="Ticket status"
              className="w-44"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{statusBadge(option).label}</option>
              ))}
            </Select>
            <Select
              value={ticket.priority}
              onChange={(e) => void updateTicket({ priority: e.target.value })}
              disabled={busy}
              aria-label="Ticket priority"
              className="w-44"
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{priorityBadge(option).label}</option>
              ))}
            </Select>
          </div>
        </Card>
      )}
    </div>
  );
}
