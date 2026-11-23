"use client";

/** Staff users — search, role filter, activate/deactivate. */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import {
  Button, Card, EmptyState, Input, PageLoader, Select, SearchIcon, Badge,
} from "@/components/platform/ui-bits";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  status: string;
  providerKind?: string | null;
  organisation?: string | null;
  city?: string | null;
  registeredAt: string;
  _count?: { properties: number };
};

const ROLE_LABELS: Record<string, string> = {
  LAWYER: "Lawyer / Administrator",
  SUPPORT: "Support staff",
  PROVIDER: "Property provider",
  CLIENT: "Buyer / Renter",
};

export default function StaffUsersPage() {
  const router = useRouter();
  const { user: me } = useAuth();
  const canManage = me?.role === "LAWYER";

  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const data = await apiFetch<{ users: UserRow[] }>("/users", {
      query: { search: debouncedSearch || undefined, role: role || undefined, pageSize: 50 },
    }).catch(() => null);
    setUsers(data?.users ?? []);
  }, [debouncedSearch, role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleStatus(target: UserRow) {
    setBusyId(target.id);
    setError(null);
    try {
      await apiFetch(`/users/${target.id}/status`, {
        method: "PATCH",
        body: { status: target.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE" },
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Could not update the account.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Users</h1>
      <p className="mt-1.5 text-ink-muted">
        Buyers, renters, providers and Elvictoria staff.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative max-w-md flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email or organisation"
            aria-label="Search users"
            className="pl-10"
          />
        </div>
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role filter" className="w-56">
          <option value="">All roles</option>
          <option value="LAWYER">Lawyers</option>
          <option value="SUPPORT">Support staff</option>
          <option value="PROVIDER">Providers</option>
          <option value="CLIENT">Buyers / Renters</option>
        </Select>
      </div>

      {users === null ? (
        <PageLoader />
      ) : users.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No users found" description="Try a different search or role filter." />
        </div>
      ) : (
        <Card className="mt-6 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-brand-100 bg-brand-50 text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Listings</th>
                  <th className="px-4 py-3 font-semibold">Registered</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  {canManage && <th className="px-4 py-3 font-semibold"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {users.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer transition-colors hover:bg-brand-50/40"
                    onClick={() => router.push(`/app/staff/users/${row.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink-strong">{row.name}</p>
                      <p className="text-xs text-ink-muted">{row.email}</p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">
                      {ROLE_LABELS[row.role]}
                      {row.organisation && <span className="block text-xs text-ink-muted">{row.organisation}</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{row.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-soft">{row._count?.properties ?? 0}</td>
                    <td className="px-4 py-3 text-ink-muted">{formatDate(row.registeredAt)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={row.status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>
                        {row.status === "ACTIVE" ? "Active" : "Deactivated"}
                      </Badge>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {row.role !== "LAWYER" && row.id !== me?.id && (
                          <Button
                            size="sm"
                            variant={row.status === "ACTIVE" ? "danger" : "outline"}
                            onClick={() => void toggleStatus(row)}
                            loading={busyId === row.id}
                          >
                            {row.status === "ACTIVE" ? "Deactivate" : "Reactivate"}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
