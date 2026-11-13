"use client";

/** Staff helpdesk ticket detail — conversation, reply, resolve. */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  Alert, Badge, Button, Card, PageLoader, Textarea, ChevronLeftIcon, AlertTriangleIcon,
} from "@/components/platform/ui-bits";

type TicketMessage = { id: string; at: string; fromStaff: boolean; body: string; author?: { name?: string } | null };
type Ticket = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  user?: { id: string; name: string; email: string; phone?: string | null } | null;
  name: string;
  email: string;
  phone?: string | null;
  messages: TicketMessage[];
};

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

  async function resolve() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/tickets/staff/${id}/resolve`, { method: "POST" });
      await load();
      setNotice("Ticket resolved — the user has been notified.");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not resolve the ticket.");
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
        <Badge tone={ticket.status === "RESOLVED" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}>
          {ticket.status === "RESOLVED" ? "Resolved" : "Open"}
        </Badge>
        {isFraud && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-bold text-white">
            <AlertTriangleIcon className="h-3 w-3" />
            SUSPECTED FRAUD
          </span>
        )}
        <p className="text-sm text-ink-muted">{ticket.reference} · {ticket.category}</p>
      </div>
      <h1 className="mt-1 font-serif text-3xl text-ink-strong">{ticket.subject}</h1>
      <p className="mt-1 text-sm text-ink-muted">
        {ticket.user?.name ?? ticket.name} ({ticket.user?.email ?? ticket.email})
        {ticket.phone ? ` · ${ticket.phone}` : ""} · opened {formatDateTime(ticket.createdAt)}
      </p>

      {notice && <div className="mt-4"><Alert tone="success">{notice}</Alert></div>}
      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      <Card className="mt-6 divide-y divide-zinc-100 p-0">
        {ticket.messages.map((message) => (
          <div key={message.id} className="px-5 py-4">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold text-ink-strong">
                {message.fromStaff ? "ELVICTORIA Support" : (message.author?.name ?? ticket.name)}
              </span>
              <span>{formatDateTime(message.at)}</span>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{message.body}</p>
          </div>
        ))}
      </Card>

      {ticket.status !== "RESOLVED" && (
        <Card className="mt-4 p-5">
          <Textarea
            rows={3}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write your reply to the user…"
            aria-label="Reply"
          />
          <div className="mt-3 flex justify-end gap-3">
            <Button variant="outline" onClick={() => void resolve()} loading={busy}>
              Resolve ticket
            </Button>
            <Button onClick={() => void sendReply()} loading={busy} disabled={!reply.trim()}>
              Send reply
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
