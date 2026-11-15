"use client";

/** Single help desk ticket view — shared detail page (/app/help/[id]). */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, PageLoader } from "@/components/platform/ui-bits";

type TicketMessage = { id: string; at: string; fromStaff: boolean; body: string; author?: { name?: string } | null };
type Ticket = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  messages: TicketMessage[];
};

export default function HelpTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    apiFetch<{ ticket: Ticket }>(`/tickets/mine/${id}`)
      .then((d) => setTicket(d.ticket))
      .catch(() => setMissing(true));
  }, [id]);

  if (missing) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="font-medium text-ink-strong">Ticket not found.</p>
      </div>
    );
  }
  if (!ticket) return <PageLoader />;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">{ticket.reference} · {ticket.category}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        </div>
        <Badge tone={ticket.status === "RESOLVED" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}>
          {ticket.status === "RESOLVED" ? "Resolved" : "Open"}
        </Badge>
      </div>

      <Card className="mt-6 divide-y divide-brand-50 p-0">
        {ticket.messages.map((message) => (
          <div key={message.id} className="px-5 py-4">
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span className="font-semibold text-ink-strong">
                {message.fromStaff ? "ELVICTORIA Support" : (message.author?.name ?? "You")}
              </span>
              <span>{formatDateTime(message.at)}</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{message.body}</p>
          </div>
        ))}
      </Card>
      <p className="mt-3 text-xs text-ink-muted">
        To continue this conversation, open the ticket under the Help Desk.
      </p>
    </div>
  );
}
