"use client";

/** Staff helpdesk — ticket queue with fraud flagging and filters. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { priorityBadge, statusBadge } from "@/lib/tickets";
import {
  Badge, Button, Card, EmptyState, Input, PageLoader, Select,
  ChevronLeftIcon, ChevronRightIcon, AlertTriangleIcon,
} from "@/components/platform/ui-bits";

type TicketRow = {
  id: string;
  reference: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
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
  const [priority, setPriority] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (targetPage: number) => {
    const data = await apiFetch<{ tickets: TicketRow[]; pages: number }>("/tickets/staff", {
      query: {
        status: status || undefined,
        priority: priority || undefined,
        q: search.trim() || undefined,
        page: targetPage,
        pageSize: 15,
      },
    }).catch(() => null);
    if (data) {
      setTickets(data.tickets);
      setPages(data.pages);
      setPage(targetPage);
    } else {
      setTickets([]);
    }
  }, [status, priority, search]);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Help Desk</h1>
      <p className="mt-1.5 text-ink-muted">
        Support tickets from clients and providers. Suspected fraud is flagged for immediate attention.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status filter" className="w-44">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </Select>
        <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority filter" className="w-44">
          <option value="">All priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </Select>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search reference, subject or email…"
          aria-label="Search tickets"
          className="w-64"
        />
        {(status || priority || search.trim()) && (
          <Button
            variant="outline"
            onClick={() => {
              setStatus("");
              setPriority("");
              setSearch("");
            }}
          >
            Clear filters
          </Button>
        )}
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
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={statusBadge(ticket.status).tone}>{statusBadge(ticket.status).label}</Badge>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityBadge(ticket.priority).tone}`}>
                    {priorityBadge(ticket.priority).label}
                  </span>
                </div>
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
