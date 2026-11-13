"use client";

/** Staff cases board — Open / Closed / All tabs with lawyer + status filters. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { CASE_STATUS_LABELS, formatDate } from "@/lib/format";
import {
  Button, Card, EmptyState, Input, PageLoader, Select, StatusBadge, SearchIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from "@/components/platform/ui-bits";

type CaseRow = {
  id: string;
  reference: string;
  status: string;
  openedAt?: string | null;
  enquiry: { id: string; reference: string; submittedAt: string };
  property: { reference: string; title: string };
  client: { id: string; name: string };
  lawyer?: { id: string; name: string } | null;
};

const TABS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
];

export default function StaffCasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[] | null>(null);
  const [view, setView] = useState("open");
  const [status, setStatus] = useState("");
  const [lawyerId, setLawyerId] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get("view");
    if (initialView) setView(initialView);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(
    async (targetPage: number) => {
      const data = await apiFetch<{ cases: CaseRow[]; pages: number; total: number }>("/staff/matters", {
        query: {
          view,
          status: status || undefined,
          lawyerId: lawyerId || undefined,
          search: debouncedSearch || undefined,
          page: targetPage,
          pageSize: 15,
        },
      }).catch(() => null);
      if (data) {
        setCases(data.cases);
        setPages(data.pages);
        setPage(targetPage);
        setCounts((c) => ({ ...c, [view]: data.total }));
      } else {
        setCases([]);
      }
    },
    [view, status, lawyerId, debouncedSearch],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="font-serif text-3xl text-ink-strong">Transaction cases</h1>
      <p className="mt-1.5 text-ink-muted">
        Matters with an opened transaction case, from assignment to close.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Case state">
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
            placeholder="Search by case, property or client"
            aria-label="Search cases"
            className="pl-10"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="w-56">
          <option value="">All statuses</option>
          {Object.entries(CASE_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select value={lawyerId} onChange={(e) => setLawyerId(e.target.value)} aria-label="Assigned lawyer" className="w-56">
          <option value="">All lawyers</option>
          <option value="me">Assigned to me</option>
        </Select>
      </div>

      {cases === null ? (
        <PageLoader />
      ) : cases.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No cases found" description="Try a different tab, status or search term." />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">Case</th>
                  <th className="px-4 py-3 font-semibold">Property</th>
                  <th className="px-4 py-3 font-semibold">Buyer / Renter</th>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Lawyer</th>
                  <th className="px-4 py-3 font-semibold">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {cases.map((kase) => (
                  <tr
                    key={kase.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    onClick={() => router.push(`/app/staff/matters/${kase.enquiry.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-strong">{kase.reference}</p>
                      <p className="text-xs text-ink-muted">{kase.enquiry.reference}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-ink-strong">{kase.property.title}</td>
                    <td className="px-4 py-3 text-ink-soft">{kase.client.name}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(kase.enquiry.submittedAt)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={kase.status} label={CASE_STATUS_LABELS[kase.status]} />
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{kase.lawyer?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-muted">{kase.openedAt ? formatDate(kase.openedAt) : "—"}</td>
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
