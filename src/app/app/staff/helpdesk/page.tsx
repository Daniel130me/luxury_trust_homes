"use client";

/** Staff helpdesk — ticket queue with fraud flagging and filters. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import {
  Badge, Button, Card, EmptyState, PageLoader, Select,
  ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon,
} from "@/components/platform/ui-bits";

type TicketRow = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; email: string } | null;
  name: string;
  email: string;
  messages: Array<{ id: string; at: string; fromStaff: boolean; body: string }>;
};

export default function StaffHelpdeskPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[] | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (targetPage: number) => {
    const data = await apiFetch<{ tickets: TicketRow[]; pages: number }>("/tickets/staff", {
      query: { status: status || undefined, page: targetPage, pageSize: 15 },
    }).catch(() => null);
    if (data) {
      setTickets(data.tickets);
      setPages(data.pages);
      setPage(targetPage);
    } else {
      setTickets([]);
    }
  }, [status]);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Help Desk</h1>
      <p className="mt-1.5 text-ink-muted">
        Support tickets from clients and providers. Suspected fraud is flagged for immediate attention.
      </p>

      <div className="mt-4 flex gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter" className="w-48">
          <option value="">All tickets</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
        </Select>
      </div>

      {tickets === null ? (
        <PageLoader />
      ) : tickets.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No tickets" description="Nothing in the queue — all clear." />
        </div>
      ) : (
        <Card className="mt-6 divide-y divide-brand-50 p-0">
          {tickets.map((ticket) => {
            const isFraud = ticket.category === "fraud";
            return (
              <button
                key={ticket.id}
                onClick={() => router.push(`/app/staff/helpdesk/${ticket.id}`)}
                className={`flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-brand-50/40 ${
                  isFraud ? "bg-red-50/40" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-strong">
                    <span className="text-ink-muted">{ticket.reference}</span> — {ticket.subject}
                    {isFraud && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        <AlertTriangleIcon className="h-3 w-3" />
                        SUSPECTED FRAUD
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {ticket.user?.name ?? ticket.name} ({ticket.user?.email ?? ticket.email}) · {ticket.category} ·{" "}
                    updated {formatDateTime(ticket.updatedAt)}
                  </p>
                  {ticket.messages.length > 0 && (
                    <p className="mt-1 truncate text-xs text-ink-muted">
                      Last message: {ticket.messages.at(-1)?.fromStaff ? "Staff" : "User"} — {ticket.messages.at(-1)?.body.slice(0, 90)}
                    </p>
                  )}
                </div>
                <Badge tone={ticket.status === "RESOLVED" ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}>
                  {ticket.status === "RESOLVED" ? "Resolved" : "Open"}
                </Badge>
              </button>
            );
          })}
        </Card>
      )}

      {pages > 1 && (
        <nav className="mt-5 flex items-center justify-center gap-2" aria-label="Pagination">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm text-ink-muted">Page {page} of {pages}</span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => void load(page + 1)}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
