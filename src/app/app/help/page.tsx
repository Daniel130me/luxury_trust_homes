"use client";

/** Signed-in Help Desk — ticket list + new ticket form (client/provider). */
import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { priorityBadge, statusBadge, ticketAcceptsReplies } from "@/lib/tickets";
import {
  Alert, Badge, Button, Card, EmptyState, Field, Input, PageLoader, SectionHeader, Select, Textarea,
} from "@/components/platform/ui-bits";

type TicketMessage = { id: string; at: string; fromStaff: boolean; body: string; author?: { name?: string } | null };
type Ticket = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  messages: TicketMessage[];
};

const CATEGORIES = [
  { value: "enquiries", label: "Enquiries & cases" },
  { value: "payments", label: "Payments" },
  { value: "listings", label: "Listings" },
  { value: "account", label: "Account & profile" },
  { value: "fraud", label: "Suspected fraud" },
  { value: "other", label: "Something else" },
];

export default function HelpDeskPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replying, setReplying] = useState(false);

  // New ticket form
  const [form, setForm] = useState({ category: "enquiries", subject: "", body: "", phone: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await apiFetch<{ tickets: Ticket[] }>("/tickets/mine").catch(() => null);
    setTickets(data?.tickets ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTicket(event: React.FormEvent) {
    event.preventDefault();
    const local: Record<string, string> = {};
    if (form.subject.trim().length < 5) local.subject = "Summarise the issue.";
    if (form.body.trim().length < 10) local.body = "Describe the issue in a little more detail.";
    setFormErrors(local);
    if (Object.keys(local).length > 0) return;

    setSubmitting(true);
    try {
      const data = await apiFetch<{ ticket: Ticket }>("/tickets", {
        method: "POST",
        body: { ...form, phone: form.phone || undefined },
      });
      setForm({ category: "enquiries", subject: "", body: "", phone: "" });
      // Standard support-desk confirmation: the reference number is what
      // the user quotes in any correspondence, so show it prominently.
      setNotice(
        `Your ticket has been created. Your reference number is ${data.ticket.reference} — quote it in any correspondence with our support team.`,
      );
      setCreatedId(data.ticket.id);
      await load();
    } catch (err) {
      setFormErrors(err instanceof ApiRequestError ? (err.fields ?? { form: err.message }) : { form: "Could not create the ticket." });
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(ticketId: string) {
    if (!reply.trim()) return;
    setReplying(true);
    try {
      await apiFetch(`/tickets/mine/${ticketId}/reply`, { method: "POST", body: { body: reply } });
      setReply("");
      await load();
    } catch (err) {
      setNotice(err instanceof ApiRequestError ? err.message : "Could not send the reply.");
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <SectionHeader title="Help Desk" description="Raise a ticket and our support team will help you." />

      {notice && <Alert tone="success">{notice}</Alert>}

      {/* ------------------------------------------------- new ticket */}
      <Card className="p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-ink-strong">Open a new ticket</h2>
        <form onSubmit={createTicket} className="mt-4 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="What is it about?" required>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category">
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Phone number (optional)">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Subject" error={formErrors.subject} required>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <Field label="Details" error={formErrors.body} required>
            <Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </Field>
          {formErrors.form && <Alert tone="error">{formErrors.form}</Alert>}
          <Button type="submit" loading={submitting}>
            Submit ticket
          </Button>
        </form>
      </Card>

      {/* -------------------------------------------------- tickets */}
      <div>
        <SectionHeader title="Your tickets" />
        {tickets === null ? (
          <PageLoader />
        ) : tickets.length === 0 ? (
          <EmptyState title="No tickets yet" description="When you contact support, the conversation appears here." />
        ) : (
          <Card className="divide-y divide-brand-50">
            {tickets.map((ticket) => (
              <div key={ticket.id}>
                <button
                  onClick={() => setOpenTicket(openTicket === ticket.id ? null : ticket.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-brand-50/40"
                  aria-expanded={openTicket === ticket.id}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-strong">
                      <span className="text-ink-muted">{ticket.reference}</span> — {ticket.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {ticket.category} · updated {formatDateTime(ticket.updatedAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone={statusBadge(ticket.status).tone}>{statusBadge(ticket.status).label}</Badge>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityBadge(ticket.priority).tone}`}>
                      {priorityBadge(ticket.priority).label}
                    </span>
                  </div>
                </button>
                {openTicket === ticket.id && (
                  <div className="border-t border-brand-50 bg-brand-50/60 px-4 py-4">
                    <div className="space-y-3">
                      {ticket.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                            message.fromStaff
                              ? "bg-white text-ink-strong border border-brand-100"
                              : "ml-auto bg-brand-800 text-white"
                          }`}
                        >
                          <p>{message.body}</p>
                          <p className={`mt-1 text-[10px] ${message.fromStaff ? "text-ink-muted" : "text-white/70"}`}>
                            {message.fromStaff ? "ELVICTORIA Support" : user?.name} · {formatDateTime(message.at)}
                          </p>
                        </div>
                      ))}
                    </div>
                    {ticketAcceptsReplies(ticket.status) && (
                      <div className="mt-3 flex gap-2">
                        <Input
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Write a reply…"
                          aria-label={`Reply to ${ticket.reference}`}
                        />
                        <Button onClick={() => void sendReply(ticket.id)} loading={replying} disabled={!reply.trim()}>
                          Send
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}
