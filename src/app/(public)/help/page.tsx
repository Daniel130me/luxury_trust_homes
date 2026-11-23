"use client";

/** Public help page — answers, ticket tracking by reference, and a route into the signed-in Help Desk. */
import Link from "next/link";
import { useState } from "react";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { priorityBadge, statusBadge } from "@/lib/tickets";
import { Alert, Badge, Button, Card, Field, Input } from "@/components/platform/ui-bits";

const FAQS = [
  {
    q: "How are enquiries handled?",
    a: "Every enquiry is submitted through the platform and assigned to an Elvictoria lawyer. Your lawyer reviews it, contacts the property provider, and keeps you updated inside your account. You never deal with unknown agents or middlemen.",
  },
  {
    q: "Who can see my contact details?",
    a: "Your phone number and email are never published on a listing. They are shared with the other party only when your lawyer authorises it for your transaction, and every disclosure is recorded against the case.",
  },
  {
    q: "How do payments work?",
    a: "Payment requests are raised by your lawyer inside your account and linked to your case. You can pay by debit card through Flutterwave's secure checkout, or by bank transfer which your lawyer confirms. We will never ask you to pay into a personal account.",
  },
  {
    q: "Are listings verified?",
    a: "Yes. Every listing is reviewed by our legal team before it appears publicly, and listings that do not meet our standards are rejected or withdrawn.",
  },
  {
    q: "I am a property owner — how do I list?",
    a: "Register as a provider, add your listing with photos and location details, and submit it for review. Once approved it appears in the public catalogue and enquiries arrive through the legal team.",
  },
];

type TrackedMessage = { id: string; at: string; fromStaff: boolean; body: string; author?: { name?: string } | null };
type TrackedTicket = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  messages: TrackedMessage[];
};

/** Track a ticket by its reference number + the email used on it — no login needed. */
function TrackTicketCard() {
  const [reference, setReference] = useState("");
  const [email, setEmail] = useState("");
  const [ticket, setTicket] = useState<TrackedTicket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function track(event: React.FormEvent) {
    event.preventDefault();
    if (!reference.trim() || !email.trim()) return;
    setBusy(true);
    setError(null);
    setTicket(null);
    try {
      const data = await apiFetch<{ ticket: TrackedTicket }>("/tickets/track", {
        query: { reference: reference.trim(), email: email.trim() },
      });
      setTicket(data.ticket);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "No ticket found for that reference and email.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-8 p-5 sm:p-6">
      <p className="font-semibold text-ink-strong">Track an existing ticket</p>
      <p className="mt-1 text-sm text-ink-muted">
        Enter the reference number we issued (it looks like ELV-HD-0001) together with the email address on the ticket.
      </p>
      <form onSubmit={track} className="mt-4 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
        <Field label="Reference number">
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="ELV-HD-0001" aria-label="Ticket reference" />
        </Field>
        <Field label="Email address">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email on the ticket" />
        </Field>
        <Button type="submit" loading={busy} disabled={!reference.trim() || !email.trim()}>
          Track ticket
        </Button>
      </form>

      {error && <div className="mt-4"><Alert tone="error">{error}</Alert></div>}

      {ticket && (
        <div className="mt-5 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-strong">
              <span className="text-ink-muted">{ticket.reference}</span> — {ticket.subject}
            </p>
            <div className="flex gap-1.5">
              <Badge tone={statusBadge(ticket.status).tone}>{statusBadge(ticket.status).label}</Badge>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityBadge(ticket.priority).tone}`}>
                {priorityBadge(ticket.priority).label}
              </span>
            </div>
          </div>
          <div className="mt-3 space-y-3">
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
                  {message.fromStaff ? "Elvictoria Support" : "You"} · {formatDateTime(message.at)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">Last updated {formatDateTime(ticket.updatedAt)}.</p>
        </div>
      )}
    </Card>
  );
}

export default function HelpPage() {
  const { user } = useAuth();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-600">Help Desk</p>
      <h1 className="mt-2 font-serif text-4xl text-ink-strong">How can we help?</h1>
      <p className="mt-3 leading-relaxed text-ink-soft">
        Answers to the questions we hear most. For anything else, open a ticket in the Help Desk and
        our support team will respond.
      </p>

      <div className="mt-8 space-y-3">
        {FAQS.map((faq) => (
          <details key={faq.q} className="group rounded-xl border border-brand-100 bg-white p-5 open:shadow-sm">
            <summary className="cursor-pointer list-none font-semibold text-ink-strong marker:hidden">
              <span className="flex items-center justify-between gap-3">
                {faq.q}
                <span className="text-brand-700 transition-transform group-open:rotate-45" aria-hidden>＋</span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{faq.a}</p>
          </details>
        ))}
      </div>

      <TrackTicketCard />

      <Card className="mt-8 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold text-ink-strong">Still need help?</p>
          <p className="text-sm text-ink-muted">
            {user ? "Open a ticket and our support team will respond." : "Sign in to open a support ticket."}
          </p>
        </div>
        {user ? (
          <Link href="/app/help">
            <Button>Open the Help Desk</Button>
          </Link>
        ) : (
          <Link href="/login">
            <Button>Sign in</Button>
          </Link>
        )}
      </Card>
    </main>
  );
}
