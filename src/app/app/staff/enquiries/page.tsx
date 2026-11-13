"use client";

/** Staff enquiries — tabs (All / Needs attention / Unassigned / Escalated). */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CASE_STATUS_LABELS, formatDate } from "@/lib/format";
import {
  Button, Card, EmptyState, Input, PageLoader, SearchIcon, StatusBadge,
  ChevronLeftIcon, ChevronRightIcon,
} from "@/components/platform/ui-bits";

type EnquiryRow = {
  id: string;
  reference: string;
  status: string;
  purpose: string;
  submittedAt: string;
  lawyer?: { id: string; name: string } | null;
  client: { id: string; name: string; email: string; phone?: string | null };
  property: { id: string; reference: string; title: string };
  escalations: Array<{ id: string }>;
  case?: { id: string; reference: string } | null;
};

const TABS = [
  { value: "all", label: "All" },
  { value: "attention", label: "Needs attention" },
  { value: "unassigned", label: "Unassigned" },
  { value: "escalated", label: "Escalated" },
];

export default function StaffEnquiriesPage() {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState<EnquiryRow[] | null>(null);
  const [view, setView] = useState("all");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("view");
    if (initial) setView(initial);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (targetPage: number) => {
      const data = await apiFetch<{ enquiries: EnquiryRow[]; pages: number; total: number }>(
        "/staff/enquiries",
        {
          query: {
            view,
            status: status || undefined,
            search: debouncedSearch || undefined,
            page: targetPage,
            pageSize: 15,
          },
        },
      ).catch(() => null);
      if (data) {
        setEnquiries(data.enquiries);
        setPages(data.pages);
        setPage(targetPage);
        setCounts((c) => ({ ...c, [view]: data.total }));
      } else {
        setEnquiries([]);
      }
    },
    [view, status, debouncedSearch],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-serif text-3xl text-ink-strong">Enquiries</h1>
      <p className="mt-1.5 text-ink-muted">
        Every enquiry submitted by buyers and renters, managed by the legal team.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="View">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            role="tab"
            aria-selected={view === tab.value}
            onClick={() => setView(tab.value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              view === tab.value ? "bg-brand-700 text-white" : "bg-white text-ink-soft ring-1 ring-zinc-200 hover:bg-brand-50"
            }`}
          >
            {tab.label}
            {counts[tab.value] != null && <span className="ml-1.5 opacity-80">{counts[tab.value]}</span>}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative max-w-md flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference, property, client or message"
            aria-label="Search enquiries"
            className="pl-10"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Status filter"
          className="w-52 rounded-lg border border-zinc-200 bg-white px-3.5 py-2.5 text-sm text-ink-strong focus:border-brand-500 focus:outline-none"
        >
          <option value="">All statuses</option>
          {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {enquiries === null ? (
        <PageLoader />
      ) : enquiries.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No enquiries found" description="Try a different view or search term." />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Enquiry</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Buyer / Renter</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Lawyer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {enquiries.map((enquiry) => (
                  <tr
                    key={enquiry.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    onClick={() => router.push(`/app/staff/matters/${enquiry.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-strong">{enquiry.case?.reference ?? enquiry.reference}</p>
                      <p className="text-xs text-ink-muted">
                        {enquiry.reference}
                        {enquiry.escalations.length > 0 && (
                          <span className="ml-1.5 font-semibold text-amber-700">· Escalated</span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-strong">{enquiry.property.title}</p>
                      <p className="text-xs text-ink-muted">{enquiry.property.reference}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {enquiry.client.name}
                      <span className="block text-xs text-ink-muted">{enquiry.client.email}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(enquiry.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={enquiry.status} label={CASE_STATUS_LABELS[enquiry.status]} />
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{enquiry.lawyer?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
